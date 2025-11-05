"""Jupyter kernel management for code execution."""

from __future__ import annotations

import json
import logging
import os
import socket
import time
import asyncio
import threading
from datetime import datetime
from pathlib import Path
from typing import Any, Optional, Coroutine
from urllib.parse import parse_qs, urlparse

from collections import defaultdict

from jupyter_client import KernelManager as JupyterKernelManager
from jupyter_client.kernelspec import KernelSpecManager

logger = logging.getLogger(__name__)


class KernelManager:
    """Manages Jupyter kernel lifecycle and code execution."""

    def __init__(self, run_dir: Path):
        """Initialize kernel manager for a specific run directory."""

        self.run_dir = run_dir
        self.run_dir.mkdir(parents=True, exist_ok=True)

        self.kernel_manager: Optional[JupyterKernelManager] = None
        self.kernel_client = None

        # Stage-specific notebook tracking
        self.default_stage = "analysis"
        self.stage_notebooks: dict[str, dict[str, Any]] = {}
        self.stage_paths: dict[str, Path] = {}
        self.stage_exec_counts: dict[str, int] = defaultdict(int)
        self.stage_cell_history: dict[str, list[dict]] = {}  # Audit trail for cell operations
        self._bootstrap_initialized = False
        self.rtc_enabled = os.environ.get("OPENCODE_RTC_NOTEBOOK_SYNC") == "1"
        self._rtc_ready = False
        self._rtc_notebooks: dict[str, Any] = {}
        self._rtc_server = None
        self._rtc_loop = None
        self._rtc_thread = None
        self._rtc_shutdown = None
        self._rtc_ready_event = None
        self._rtc_port = None
        self._rtc_token = ""
        if self.rtc_enabled:
            try:
                from jupyter_ydoc.ynotebook import YNotebook  # type: ignore
                from pycrdt.websocket.websocket_server import WebsocketServer  # type: ignore

                self._YNotebook = YNotebook
                self._WebsocketServer = WebsocketServer

                self._rtc_token = os.urandom(16).hex()
                self._rtc_ready = True
                logger.info("RTC notebook sync enabled for run directory %s", run_dir)
            except Exception as error:
                self.rtc_enabled = False
                self._rtc_ready = False
                logger.warning(
                    "RTC notebook sync requested but dependencies missing: %s", error
                )

        self._ensure_stage(self.default_stage)

    def _normalize_stage(self, stage: Optional[str]) -> str:
        if not stage:
            return self.default_stage
        cleaned = stage.strip().lower().replace(" ", "_")
        return cleaned or self.default_stage

    def _stage_directory(self, stage_key: str) -> Path:
        stage_dir = self.run_dir / stage_key
        stage_dir.mkdir(parents=True, exist_ok=True)
        return stage_dir

    def _ensure_stage(self, stage: Optional[str]) -> str:
        stage_key = self._normalize_stage(stage)
        if stage_key not in self.stage_notebooks:
            notebook_path = self._stage_directory(stage_key) / f"{stage_key}.ipynb"
            notebook = self._load_or_create_notebook(notebook_path)
            self.stage_notebooks[stage_key] = notebook
            self.stage_paths[stage_key] = notebook_path
            self.stage_exec_counts.setdefault(stage_key, 0)
            self._ensure_rtc_notebook(stage_key)
        return stage_key

    def _rtc_room_name(self, stage_key: str) -> str:
        return stage_key

    def _ensure_rtc_notebook(self, stage_key: str):
        if not self._rtc_ready:
            return
        self._start_rtc_server()
        if not self._rtc_loop or stage_key in self._rtc_notebooks:
            return
        notebook = self.stage_notebooks.get(stage_key)
        if notebook is None:
            return
        try:
            info = self._run_in_rtc_loop(self._rtc_prepare_stage(stage_key, notebook))
            if info:
                self._rtc_notebooks[stage_key] = info
        except Exception as error:
            logger.warning(
                "Failed to initialize RTC notebook for stage %s: %s", stage_key, error
            )

    def _start_rtc_server(self):
        if not self._rtc_ready:
            return
        if self._rtc_loop:
            return

        try:
            from websockets.server import serve as ws_serve
            from websockets.exceptions import ConnectionClosed
        except ImportError:
            logger.error("websockets library required for RTC: pip install websockets")
            self._rtc_ready = False
            return

        port = self._allocate_port()
        self._rtc_port = port
        self._rtc_loop = asyncio.new_event_loop()
        self._rtc_server = self._WebsocketServer(log=logger)
        self._rtc_ready_event = threading.Event()
        shutdown_event_holder: dict[str, asyncio.Event] = {}

        # Channel adapter for pycrdt-websocket
        class WebsocketChannel:
            """Bridge between websockets Protocol and pycrdt Channel interface"""
            def __init__(self, websocket, path: str):
                self._websocket = websocket
                self.path = path
                self.client_id = id(websocket)

            def __aiter__(self):
                return self

            async def __anext__(self):
                try:
                    message = await self._websocket.recv()
                    if isinstance(message, str):
                        return message.encode()
                    return message
                except ConnectionClosed:
                    raise StopAsyncIteration
                except Exception:
                    raise StopAsyncIteration

            async def send(self, message: bytes):
                await self._websocket.send(message)

            async def recv(self) -> bytes:
                message = await self._websocket.recv()
                if isinstance(message, str):
                    return message.encode()
                return message

        async def handler(websocket, path):
            """Handle WebSocket connection with authentication"""
            try:
                # Parse authentication
                parsed = urlparse(path)
                params = parse_qs(parsed.query)
                token = params.get("token", [""])[0]
                stage_key = params.get("stage", [parsed.path.strip("/")])[0]

                # Validate token
                if token != self._rtc_token or not stage_key:
                    await websocket.close(code=4401, reason="unauthorized")
                    return

                # Normalize stage and create channel
                stage_key = self._normalize_stage(stage_key)
                room_path = self._rtc_room_name(stage_key)

                logger.info(f"RTC client connected: stage={stage_key}, room={room_path}")

                # Create channel and serve
                channel = WebsocketChannel(websocket, room_path)
                await self._rtc_server.serve(channel)

            except Exception as error:
                logger.warning(f"RTC connection error: {error}")

        async def runner():
            """Run RTC server with proper lifecycle"""
            shutdown_event = asyncio.Event()
            shutdown_event_holder["event"] = shutdown_event

            # Start WebsocketServer as background task (runs forever)
            logger.info("Starting WebsocketServer...")
            start_task = asyncio.create_task(self._rtc_server.start())

            # Wait for server to be ready
            await self._rtc_server.started.wait()
            logger.info("✅ WebsocketServer ready")

            # Start WebSocket listener
            logger.info(f"Starting WebSocket listener on 127.0.0.1:{port}...")
            server = await ws_serve(handler, "127.0.0.1", port)
            logger.info(f"✅ WebSocket server listening on port {port}")

            # Signal ready to main thread
            self._rtc_ready_event.set()

            # Store for cleanup
            shutdown_event_holder["start_task"] = start_task
            shutdown_event_holder["ws_server"] = server

            # Wait for shutdown signal
            await shutdown_event.wait()

            # Cleanup
            logger.info("Shutting down RTC server...")
            server.close()
            await server.wait_closed()
            self._rtc_server.stop()
            start_task.cancel()
            try:
                await start_task
            except asyncio.CancelledError:
                pass
            logger.info("RTC server stopped")

        def run():
            """Thread entry point"""
            asyncio.set_event_loop(self._rtc_loop)
            try:
                self._rtc_loop.run_until_complete(runner())
            except Exception as exc:
                logger.error("RTC server exited unexpectedly: %s", exc, exc_info=exc)
            finally:
                try:
                    self._rtc_loop.close()
                except Exception:
                    pass

        # Start server thread
        self._rtc_thread = threading.Thread(target=run, daemon=True)
        self._rtc_thread.start()

        # Wait for server to be ready
        if not self._rtc_ready_event.wait(timeout=10):
            logger.warning("RTC server failed to start within 10 seconds")
            self._rtc_ready = False
            return

        self._rtc_shutdown = shutdown_event_holder.get("event")
        logger.info(f"✅ RTC server ready on port {port}")

    def _run_in_rtc_loop(self, coro: Coroutine[Any, Any, Any]):
        if not self._rtc_loop:
            return None
        future = asyncio.run_coroutine_threadsafe(coro, self._rtc_loop)
        return future.result(timeout=5)

    async def _rtc_prepare_stage(self, stage_key: str, notebook: dict[str, Any] | None):
        room_name = self._rtc_room_name(stage_key)
        room = await self._rtc_server.get_room(room_name)  # type: ignore[arg-type]
        document = self._YNotebook(room.ydoc, room.awareness)
        if notebook:
            document.set(notebook)
        room.ready = True
        return {"room_name": room_name, "room": room, "doc": document}

    async def _rtc_set_notebook(self, info: dict[str, Any], notebook: dict[str, Any]):
        doc = info.get("doc")
        if doc is None:
            return
        doc.set(notebook)
        room = info.get("room")
        if room is not None:
            room.ready = True

    def _rtc_connection_payload(self) -> Optional[dict[str, Any]]:
        if not self._rtc_ready or not self._rtc_port:
            return None
        rooms = {
            stage: data.get("room_name", self._rtc_room_name(stage))
            for stage, data in self._rtc_notebooks.items()
        }
        return {
            "enabled": True,
            "host": "127.0.0.1",
            "port": self._rtc_port,
            "token": self._rtc_token,
            "rooms": rooms,
        }

    def _allocate_port(self) -> int:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.bind(("127.0.0.1", 0))
            return int(sock.getsockname()[1])

    def _stop_rtc_server(self):
        if not self._rtc_loop:
            return
        if self._rtc_server:
            self._rtc_loop.call_soon_threadsafe(self._rtc_server.stop)
        if self._rtc_shutdown:
            self._rtc_loop.call_soon_threadsafe(self._rtc_shutdown.set)
        if self._rtc_thread:
            self._rtc_thread.join(timeout=2)
        self._rtc_loop = None
        self._rtc_thread = None
        self._rtc_shutdown = None
        self._rtc_ready_event = None
        self._rtc_server = None
        self._rtc_port = None
        self._rtc_notebooks.clear()

    def _bootstrap_environment(self, primary_stage: str):
        if not self.kernel_client:
            return
        if not self._bootstrap_initialized:
            init_code = f"""
import json, pathlib
__OPENCODE_RUN_DIR = pathlib.Path({repr(str(self.run_dir))})
__OPENCODE_RUN_DIR.mkdir(parents=True, exist_ok=True)
__OPENCODE_STAGE = {repr(primary_stage)}

def jupyter_runner_artifact_store(name, data, format="json", stage=None):
    stage_key = (stage or __OPENCODE_STAGE) or 'analysis'
    root = __OPENCODE_RUN_DIR / 'artifacts' / stage_key
    root.mkdir(parents=True, exist_ok=True)
    if format == 'json':
        path = root / f"{ '{' }name{ '}' }.json"
        with path.open('w') as f:
            json.dump(data, f, indent=2)
    elif format == 'text':
        path = root / f"{ '{' }name{ '}' }.txt"
        with path.open('w') as f:
            f.write(str(data))
    elif format == 'binary':
        path = root / name
        with path.open('wb') as f:
            f.write(data)
    else:
        raise ValueError(f"Unsupported format: { '{' }format{ '}' }")
    print(f"[opencode] artifact saved: { '{' }path{ '}' }")
    return str(path)

def jupyter_runner_set_stage(stage):
    global __OPENCODE_STAGE
    __OPENCODE_STAGE = stage
    return __OPENCODE_STAGE

jupyter_runner_set_stage(__OPENCODE_STAGE)
"""
            self.kernel_client.execute(init_code, silent=True)
            self._bootstrap_initialized = True
        else:
            self.kernel_client.execute(
                f"jupyter_runner_set_stage({repr(primary_stage)})",
                silent=True,
            )

    def ensure_kernel(self, python_version: Optional[str] = None, stage: Optional[str] = None) -> dict[str, Any]:
        """
        Ensure a Jupyter kernel is running.

        Args:
            python_version: Specific Python version (e.g., "3.10"), or None for default

        Returns:
            dict with kernel info: {"status": "started"|"reused", "kernel_id": str}
        """
        if self.kernel_manager and self.kernel_manager.is_alive():
            logger.info("Reusing existing kernel")
            stage_key = self._ensure_stage(stage)
            self._bootstrap_environment(stage_key)
            result = {
                "status": "reused",
                "kernel_id": self.kernel_manager.kernel_id,
                "notebook_path": self.get_notebook_path(stage_key),
                "stage": stage_key,
            }
            rtc_info = self._rtc_connection_payload()
            if rtc_info:
                result["rtc"] = rtc_info
            return result

        # Get kernel spec
        ksm = KernelSpecManager()
        kernel_name = "python3"  # Default kernel
        if python_version:
            # Try to find specific version kernel
            specs = ksm.get_all_specs()
            version_kernel = f"python{python_version}"
            if version_kernel in specs:
                kernel_name = version_kernel

        logger.info(f"Starting new kernel: {kernel_name}")

        # Create and start kernel
        self.kernel_manager = JupyterKernelManager(kernel_name=kernel_name)
        self.kernel_manager.start_kernel()
        self.kernel_client = self.kernel_manager.client()
        self.kernel_client.start_channels()

        # Wait for kernel to be ready
        self.kernel_client.wait_for_ready(timeout=30)

        logger.info(f"Kernel started: {self.kernel_manager.kernel_id}")
        stage_key = self._ensure_stage(stage)
        self._bootstrap_environment(stage_key)
        result = {
            "status": "started",
            "kernel_id": self.kernel_manager.kernel_id,
            "notebook_path": self.get_notebook_path(stage_key),
            "stage": stage_key,
        }
        rtc_info = self._rtc_connection_payload()
        if rtc_info:
            result["rtc"] = rtc_info
        return result

    def execute_code(
        self,
        code: str,
        timeout: int = 60,
        silent: bool = False,
        stage: Optional[str] = None,
        markdown: Optional[list[str] | str] = None,
        replace_cell: Optional[int] = None,
        replace_last: bool = False,
    ) -> dict[str, Any]:
        """
        Execute code in the kernel.

        Args:
            code: Python code to execute
            timeout: Timeout in seconds
            silent: If True, don't store in kernel history
            stage: Notebook stage (analysis, eda, etc.)
            markdown: Optional markdown cell(s) to add before code
            replace_cell: If provided, replace cell at this index instead of appending
            replace_last: If True, replace the last code cell (useful for bug fixing)

        Returns:
            dict with execution results:
            {
                "status": "success"|"error",
                "execution_count": int,
                "outputs": list,  # stdout, stderr, display_data
                "error": Optional[dict],  # traceback if error
                "duration_ms": float
            }
        """
        if not self.kernel_manager or not self.kernel_client:
            raise RuntimeError("No kernel running. Call ensure_kernel() first.")

        start_time = time.time()
        stage_key = self._ensure_stage(stage)
        self.stage_exec_counts[stage_key] += 1

        markdown_cells: list[str] = []
        if markdown:
            if isinstance(markdown, str):
                candidates = [markdown]
            else:
                candidates = list(markdown)
            for entry in candidates:
                if not entry:
                    continue
                trimmed = str(entry).strip()
                if not trimmed:
                    continue
                self._add_markdown_cell(stage_key, trimmed)
                markdown_cells.append(trimmed)

        self.kernel_client.execute(f"jupyter_runner_set_stage({repr(stage_key)})", silent=True)

        # Create or replace cell
        if replace_cell is not None:
            cell_index = self._replace_code_cell(stage_key, replace_cell, code, self.stage_exec_counts[stage_key])
        elif replace_last:
            # Find the last code cell and replace it
            last_code_index = self._find_last_code_cell(stage_key)
            if last_code_index is not None:
                cell_index = self._replace_code_cell(stage_key, last_code_index, code, self.stage_exec_counts[stage_key])
            else:
                # No code cells yet, create new one
                cell_index = self._create_code_cell(stage_key, code, self.stage_exec_counts[stage_key])
        else:
            cell_index = self._create_code_cell(stage_key, code, self.stage_exec_counts[stage_key])
        outputs: list[dict[str, Any]] = []
        error_info = None
        status = "success"

        msg_id = self.kernel_client.execute(code, silent=silent)

        # Collect outputs - ONLY for this specific execution (match by msg_id)
        try:
            while True:
                try:
                    msg = self.kernel_client.get_iopub_msg(timeout=timeout)
                except Exception:
                    break

                # CRITICAL: Only process messages from THIS execution
                # Check if this message belongs to our execution by matching parent msg_id
                parent_msg_id = msg.get("parent_header", {}).get("msg_id")
                if parent_msg_id != msg_id:
                    # This message is from a different execution, skip it
                    continue

                msg_type = msg["header"]["msg_type"]
                content = msg["content"]

                if msg_type == "stream":
                    outputs.append(
                        {
                            "type": "stream",
                            "name": content["name"],
                            "text": content["text"],
                        }
                    )
                    self._update_code_cell_outputs(stage_key, cell_index, outputs, self.stage_exec_counts[stage_key])

                elif msg_type == "display_data" or msg_type == "execute_result":
                    outputs.append(
                        {
                            "type": msg_type,
                            "data": content.get("data", {}),
                            "metadata": content.get("metadata", {}),
                        }
                    )
                    self._update_code_cell_outputs(stage_key, cell_index, outputs, self.stage_exec_counts[stage_key])

                elif msg_type == "error":
                    status = "error"
                    error_info = {
                        "ename": content["ename"],
                        "evalue": content["evalue"],
                        "traceback": content["traceback"],
                    }
                    self._update_code_cell_outputs(stage_key, cell_index, outputs, self.stage_exec_counts[stage_key])

                elif msg_type == "status" and content["execution_state"] == "idle":
                    # Kernel finished executing THIS code
                    break

        except Exception as e:
            status = "error"
            error_info = {"ename": "TimeoutError", "evalue": str(e), "traceback": []}

        duration_ms = (time.time() - start_time) * 1000

        self._update_code_cell_outputs(stage_key, cell_index, outputs, self.stage_exec_counts[stage_key])

        result = {
            "status": status,
            "execution_count": self.stage_exec_counts[stage_key],
            "outputs": outputs,
            "error": error_info,
            "duration_ms": duration_ms,
            "notebook_path": self.get_notebook_path(stage_key),
            "stage": stage_key,
            "cell_index": cell_index,
            "markdown_cells": markdown_cells,
        }
        rtc_info = self._rtc_connection_payload()
        if rtc_info:
            result["rtc"] = rtc_info
        return result

    def get_variable(self, name: str) -> dict[str, Any]:
        """
        Retrieve a variable value from the kernel.

        Args:
            name: Variable name

        Returns:
            dict with variable info:
            {
                "name": str,
                "type": str,
                "value": Any,  # JSON-serializable representation
                "exists": bool
            }
        """
        # Try to get variable value and type
        code = f"""
import json
import sys
try:
    _var = {name}
    _type = type(_var).__name__
    _module = type(_var).__module__
    if _module != 'builtins':
        _type = f'{{_module}}.{{_type}}'

    # Try to serialize to JSON
    try:
        _value = json.dumps(_var)
        _serializable = True
    except (TypeError, ValueError):
        # Not JSON-serializable, use repr
        _value = repr(_var)
        _serializable = False

    print(json.dumps({{
        'exists': True,
        'type': _type,
        'value': _value if _serializable else _value[:1000],  # Limit repr length
        'serializable': _serializable
    }}))
except NameError:
    print(json.dumps({{'exists': False}}))
"""

        result = self.execute_code(code, silent=True)

        if result["status"] == "error":
            return {"name": name, "exists": False, "type": None, "value": None}

        # Parse output
        for output in result["outputs"]:
            if output["type"] == "stream" and output["name"] == "stdout":
                try:
                    var_info = json.loads(output["text"])
                    var_info["name"] = name
                    return var_info
                except json.JSONDecodeError:
                    pass

        return {"name": name, "exists": False, "type": None, "value": None}

    def store_artifact(
        self,
        name: str,
        data: Any,
        format: str = "json",
        stage: Optional[str] = None,
    ) -> dict[str, str]:
        """
        Store an artifact to the session directory.

        Args:
            name: Artifact name (without extension)
            data: Data to store
            format: Storage format ("json", "text", "binary")

        Returns:
            dict with file info: {"path": str, "size_bytes": int}
        """
        stage_key = self._normalize_stage(stage)
        artifacts_dir = self.run_dir / "artifacts" / stage_key
        artifacts_dir.mkdir(parents=True, exist_ok=True)

        # Determine file extension and write mode
        if format == "json":
            filepath = artifacts_dir / f"{name}.json"
            with open(filepath, "w") as f:
                json.dump(data, f, indent=2)
        elif format == "text":
            filepath = artifacts_dir / f"{name}.txt"
            with open(filepath, "w") as f:
                f.write(str(data))
        elif format == "binary":
            filepath = artifacts_dir / name
            with open(filepath, "wb") as f:
                f.write(data)
        else:
            raise ValueError(f"Unsupported format: {format}")

        size_bytes = filepath.stat().st_size
        logger.info(f"Stored artifact: {filepath} ({size_bytes} bytes)")

        return {"path": str(filepath), "size_bytes": size_bytes, "stage": stage_key}

    def _load_or_create_notebook(self, notebook_path: Path) -> dict[str, Any]:
        """Load existing notebook or create a new one for the given path."""
        if notebook_path.exists():
            with open(notebook_path, "r") as f:
                return json.load(f)

        notebook = {
            "cells": [],
            "metadata": {
                "kernelspec": {
                    "display_name": "Python 3",
                    "language": "python",
                    "name": "python3",
                },
                "language_info": {
                    "name": "python",
                    "version": "3.10.0",
                },
            },
            "nbformat": 4,
            "nbformat_minor": 5,
        }
        with open(notebook_path, "w") as f:
            json.dump(notebook, f, indent=2)
        logger.info(f"Created notebook: {notebook_path}")
        return notebook

    def _save_notebook(self, stage_key: str, notebook_data: Optional[dict[str, Any]] = None):
        """Save notebook data for a specific stage."""
        data = notebook_data or self.stage_notebooks[stage_key]
        path = self.stage_paths[stage_key]
        with open(path, "w") as f:
            json.dump(data, f, indent=2)
        logger.info(f"Saved notebook: {path}")
        self._sync_rtc_stage(stage_key)

    def _add_markdown_cell(self, stage_key: str, text: str) -> int:
        """Add a markdown cell to the specified stage notebook."""
        notebook = self.stage_notebooks[stage_key]
        cell = {
            "cell_type": "markdown",
            "metadata": {},
            "source": text.splitlines(True),
        }
        notebook["cells"].append(cell)
        self._save_notebook(stage_key, notebook)
        return len(notebook["cells"]) - 1

    def _create_code_cell(self, stage_key: str, code: str, execution_count: int) -> int:
        cell = {
            "cell_type": "code",
            "execution_count": execution_count,
            "metadata": {},
            "outputs": [],
            "source": code.splitlines(True),
        }

        notebook = self.stage_notebooks[stage_key]
        notebook["cells"].append(cell)
        self._save_notebook(stage_key, notebook)

        return len(notebook["cells"]) - 1

    def _replace_code_cell(self, stage_key: str, cell_index: int, code: str, execution_count: int) -> int:
        """Replace an existing code cell with new code."""
        notebook = self.stage_notebooks[stage_key]

        # Validate cell index
        if cell_index < 0 or cell_index >= len(notebook["cells"]):
            logger.warning(f"Invalid cell index {cell_index}, appending instead")
            return self._create_code_cell(stage_key, code, execution_count)

        # Create new cell
        cell = {
            "cell_type": "code",
            "execution_count": execution_count,
            "metadata": {},
            "outputs": [],
            "source": code.splitlines(True),
        }

        # Replace the cell at the specified index
        notebook["cells"][cell_index] = cell
        self._save_notebook(stage_key, notebook)

        return cell_index

    def _find_last_code_cell(self, stage_key: str) -> Optional[int]:
        """Find the index of the last code cell in the notebook."""
        notebook = self.stage_notebooks[stage_key]
        cells = notebook.get("cells", [])

        # Iterate backwards to find last code cell
        for i in range(len(cells) - 1, -1, -1):
            if cells[i].get("cell_type") == "code":
                return i

        return None

    def _sync_rtc_stage(self, stage_key: str):
        if not self._rtc_ready:
            return
        notebook = self.stage_notebooks.get(stage_key)
        if not notebook:
            return
        info = self._rtc_notebooks.get(stage_key)
        if not info:
            return
        try:
            self._run_in_rtc_loop(self._rtc_set_notebook(info, notebook))
        except Exception as error:
            logger.warning("Failed to sync RTC notebook for stage %s: %s", stage_key, error)

    def _convert_outputs_for_notebook(
        self,
        outputs: list[dict[str, Any]],
        execution_count: int,
    ) -> list[dict[str, Any]]:
        nb_outputs: list[dict[str, Any]] = []
        for output in outputs:
            if output["type"] == "stream":
                nb_outputs.append(
                    {
                        "output_type": "stream",
                        "name": output["name"],
                        "text": output["text"].splitlines(True),
                    }
                )
                continue
            if output["type"] == "execute_result":
                nb_outputs.append(
                    {
                        "output_type": "execute_result",
                        "data": output["data"],
                        "metadata": output.get("metadata", {}),
                        "execution_count": execution_count,
                    }
                )
                continue
            if output["type"] == "display_data":
                nb_outputs.append(
                    {
                        "output_type": "display_data",
                        "data": output["data"],
                        "metadata": output.get("metadata", {}),
                    }
                )
        return nb_outputs

    def _update_code_cell_outputs(
        self,
        stage_key: str,
        cell_index: int,
        outputs: list[dict[str, Any]],
        execution_count: int,
    ):
        """Update cell outputs by matching execution_count (not index) to handle race conditions."""
        notebook = self.stage_notebooks[stage_key]

        # Find cell by execution_count instead of index to avoid race conditions
        # (cells may be inserted between execution start and output arrival)
        target_cell = None
        target_index = None

        for idx, cell in enumerate(notebook["cells"]):
            if cell.get("cell_type") == "code" and cell.get("execution_count") == execution_count:
                target_cell = cell
                target_index = idx
                break

        if target_cell is None:
            # Fallback: try using the provided index if execution_count doesn't match
            # This can happen if cell was updated/replaced
            if 0 <= cell_index < len(notebook["cells"]):
                target_cell = notebook["cells"][cell_index]
                target_index = cell_index
                logger.warning(
                    f"Could not find cell with execution_count={execution_count}, "
                    f"falling back to index={cell_index}"
                )
            else:
                logger.warning(
                    f"Could not find cell with execution_count={execution_count} "
                    f"and index={cell_index} is out of range"
                )
                return

        target_cell["outputs"] = self._convert_outputs_for_notebook(outputs, execution_count)
        target_cell["execution_count"] = execution_count
        self._save_notebook(stage_key, notebook)

        logger.debug(
            f"Updated outputs for cell at index {target_index} "
            f"(execution_count={execution_count})"
        )

    def get_notebook_path(self, stage: Optional[str] = None) -> str:
        """Get the absolute path to the notebook file for the specified stage."""
        stage_key = self._ensure_stage(stage)
        return str(self.stage_paths[stage_key].absolute())

    # Cell manipulation methods for agent control
    def update_cell(
        self,
        cell_index: int,
        content: str,
        stage: Optional[str] = None,
        execute: bool = True,
        timeout: int = 60,
    ) -> dict[str, Any]:
        """
        Update an existing cell with new content.

        Args:
            cell_index: Index of cell to update (0-based)
            content: New cell content (Python code)
            stage: Notebook stage (eda, analysis, etc.)
            execute: Whether to execute after updating (default: True)
            timeout: Execution timeout in seconds

        Returns:
            Execution result with updated cell info

        Raises:
            ValueError: If cell_index is invalid or cell is not a code cell
        """
        stage_key = self._ensure_stage(stage)
        notebook = self.stage_notebooks[stage_key]

        # Validate cell exists
        if cell_index < 0 or cell_index >= len(notebook["cells"]):
            raise ValueError(
                f"Invalid cell index {cell_index}. Notebook has {len(notebook['cells'])} cells."
            )

        cell = notebook["cells"][cell_index]
        if cell.get("cell_type") != "code":
            raise ValueError(
                f"Cell {cell_index} is not a code cell (type: {cell['cell_type']})"
            )

        # Store old content for audit trail
        old_content = "".join(cell.get("source", []))
        self._record_operation(stage_key, "update", cell_index, old_content, content)

        # Update cell
        self.stage_exec_counts[stage_key] += 1
        cell["source"] = content.splitlines(True)
        cell["outputs"] = []
        cell["execution_count"] = self.stage_exec_counts[stage_key]

        self._save_notebook(stage_key)

        # Execute if requested
        if execute:
            outputs: list[dict[str, Any]] = []
            error_info = None
            status = "success"

            msg_id = self.kernel_client.execute(content, silent=False)

            # Collect outputs
            try:
                while True:
                    try:
                        msg = self.kernel_client.get_iopub_msg(timeout=timeout)
                    except Exception:
                        break

                    msg_type = msg["header"]["msg_type"]
                    msg_content = msg["content"]

                    if msg_type == "stream":
                        outputs.append(
                            {
                                "type": "stream",
                                "name": msg_content["name"],
                                "text": msg_content["text"],
                            }
                        )
                        self._update_code_cell_outputs(
                            stage_key, cell_index, outputs, self.stage_exec_counts[stage_key]
                        )

                    elif msg_type == "display_data" or msg_type == "execute_result":
                        outputs.append(
                            {
                                "type": msg_type,
                                "data": msg_content.get("data", {}),
                                "metadata": msg_content.get("metadata", {}),
                            }
                        )
                        self._update_code_cell_outputs(
                            stage_key, cell_index, outputs, self.stage_exec_counts[stage_key]
                        )

                    elif msg_type == "error":
                        status = "error"
                        error_info = {
                            "ename": msg_content["ename"],
                            "evalue": msg_content["evalue"],
                            "traceback": msg_content["traceback"],
                        }
                        self._update_code_cell_outputs(
                            stage_key, cell_index, outputs, self.stage_exec_counts[stage_key]
                        )

                    elif msg_type == "status" and msg_content["execution_state"] == "idle":
                        break

            except Exception as e:
                status = "error"
                error_info = {"ename": "TimeoutError", "evalue": str(e), "traceback": []}

            return {
                "status": status,
                "cell_index": cell_index,
                "execution_count": self.stage_exec_counts[stage_key],
                "outputs": outputs,
                "error": error_info,
                "operation": "update",
                "stage": stage_key,
            }

        return {
            "status": "updated",
            "cell_index": cell_index,
            "operation": "update",
            "stage": stage_key,
        }

    def update_last_cell(
        self,
        content: str,
        stage: Optional[str] = None,
        execute: bool = True,
        timeout: int = 60,
    ) -> dict[str, Any]:
        """
        Update the last code cell in the notebook.

        Convenient for bug fixing: agent sees error → fixes by updating last cell.

        Args:
            content: New cell content (Python code)
            stage: Notebook stage
            execute: Whether to execute after updating (default: True)
            timeout: Execution timeout in seconds

        Returns:
            Execution result

        Raises:
            ValueError: If no code cells exist in notebook
        """
        stage_key = self._ensure_stage(stage)
        last_index = self._find_last_code_cell(stage_key)

        if last_index is None:
            raise ValueError(f"No code cells found in {stage_key} notebook")

        return self.update_cell(last_index, content, stage, execute, timeout)

    def delete_cell(
        self,
        cell_index: int,
        stage: Optional[str] = None,
        confirmed: bool = False,
    ) -> dict[str, Any]:
        """
        Delete a cell from the notebook.

        Args:
            cell_index: Index of cell to delete (0-based)
            stage: Notebook stage
            confirmed: Safety confirmation flag (must be True)

        Returns:
            Deletion result with cell info

        Raises:
            ValueError: If not confirmed or cell_index is invalid
        """
        if not confirmed:
            raise ValueError(
                "Cell deletion requires explicit confirmation. Set confirmed=True to proceed."
            )

        stage_key = self._ensure_stage(stage)
        notebook = self.stage_notebooks[stage_key]

        # Validate cell exists
        if cell_index < 0 or cell_index >= len(notebook["cells"]):
            raise ValueError(
                f"Invalid cell index {cell_index}. Notebook has {len(notebook['cells'])} cells."
            )

        cell = notebook["cells"][cell_index]
        cell_content = "".join(cell.get("source", []))

        # Record operation for audit trail
        self._record_operation(stage_key, "delete", cell_index, cell_content, None)

        # Delete cell
        deleted_cell = notebook["cells"].pop(cell_index)
        self._save_notebook(stage_key)

        return {
            "status": "deleted",
            "cell_index": cell_index,
            "cell_type": deleted_cell.get("cell_type"),
            "content_preview": (
                cell_content[:100] + "..." if len(cell_content) > 100 else cell_content
            ),
            "operation": "delete",
            "stage": stage_key,
            "remaining_cells": len(notebook["cells"]),
        }

    def delete_last_cell(
        self,
        stage: Optional[str] = None,
        confirmed: bool = False,
    ) -> dict[str, Any]:
        """
        Delete the last code cell.

        Args:
            stage: Notebook stage
            confirmed: Safety confirmation flag (must be True)

        Returns:
            Deletion result

        Raises:
            ValueError: If not confirmed or no code cells exist
        """
        stage_key = self._ensure_stage(stage)
        last_index = self._find_last_code_cell(stage_key)

        if last_index is None:
            raise ValueError(f"No code cells found in {stage_key} notebook")

        return self.delete_cell(last_index, stage, confirmed)

    def list_cells(
        self,
        stage: Optional[str] = None,
        cell_type: Optional[str] = None,
    ) -> list[dict]:
        """
        List all cells in a notebook with metadata.

        Args:
            stage: Notebook stage
            cell_type: Filter by cell type ("code" or "markdown")

        Returns:
            List of cell info dicts with index, type, content, etc.
        """
        stage_key = self._ensure_stage(stage)
        notebook = self.stage_notebooks[stage_key]
        cells = notebook.get("cells", [])

        result = []
        for i, cell in enumerate(cells):
            if cell_type and cell.get("cell_type") != cell_type:
                continue

            content = "".join(cell.get("source", []))
            result.append(
                {
                    "index": i,
                    "cell_type": cell.get("cell_type"),
                    "content": content,
                    "content_preview": (
                        content[:100] + "..." if len(content) > 100 else content
                    ),
                    "execution_count": cell.get("execution_count"),
                    "has_outputs": len(cell.get("outputs", [])) > 0,
                    "has_error": any(
                        out.get("output_type") == "error" for out in cell.get("outputs", [])
                    ),
                }
            )

        return result

    def get_cell_history(self, stage: Optional[str] = None) -> list[dict]:
        """
        Get audit trail of cell operations for a stage.

        Args:
            stage: Notebook stage

        Returns:
            List of operation records with timestamp, operation type, cell info
        """
        stage_key = self._ensure_stage(stage)
        return self.stage_cell_history.get(stage_key, [])

    def _record_operation(
        self,
        stage_key: str,
        operation: str,
        cell_index: int,
        old_content: Optional[str],
        new_content: Optional[str],
    ):
        """Record cell operation for audit trail."""
        if stage_key not in self.stage_cell_history:
            self.stage_cell_history[stage_key] = []

        self.stage_cell_history[stage_key].append(
            {
                "timestamp": datetime.now().isoformat(),
                "operation": operation,
                "cell_index": cell_index,
                "old_content": old_content,
                "new_content": new_content,
            }
        )

        # Keep only last 50 operations per stage
        if len(self.stage_cell_history[stage_key]) > 50:
            self.stage_cell_history[stage_key] = self.stage_cell_history[stage_key][-50:]

    def shutdown(self):
        """Shutdown the kernel."""
        if self.kernel_client:
            self.kernel_client.stop_channels()
            self.kernel_client = None

        if self.kernel_manager:
            self.kernel_manager.shutdown_kernel()
            self.kernel_manager = None

        self._stop_rtc_server()

        logger.info("Kernel shut down")

    def __del__(self):
        """Cleanup on deletion."""
        try:
            self.shutdown()
        except Exception:
            pass
