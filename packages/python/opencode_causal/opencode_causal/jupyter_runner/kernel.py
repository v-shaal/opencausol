"""Jupyter kernel management for code execution."""

import asyncio
import json
import logging
import time
from pathlib import Path
from typing import Any, Optional

from jupyter_client import KernelManager as JupyterKernelManager
from jupyter_client.kernelspec import KernelSpecManager

logger = logging.getLogger(__name__)


class KernelManager:
    """Manages Jupyter kernel lifecycle and code execution."""

    def __init__(self, session_dir: Optional[Path] = None):
        """
        Initialize kernel manager.

        Args:
            session_dir: Directory for storing session artifacts
        """
        self.session_dir = session_dir or Path.cwd() / ".opencode" / "jupyter"
        self.session_dir.mkdir(parents=True, exist_ok=True)
        self.kernel_manager: Optional[JupyterKernelManager] = None
        self.kernel_client = None
        self._execution_count = 0

        # Notebook file management
        self.notebook_path = self.session_dir / "analysis.ipynb"
        self.notebook_data = self._load_or_create_notebook()

    def ensure_kernel(self, python_version: Optional[str] = None) -> dict[str, Any]:
        """
        Ensure a Jupyter kernel is running.

        Args:
            python_version: Specific Python version (e.g., "3.10"), or None for default

        Returns:
            dict with kernel info: {"status": "started"|"reused", "kernel_id": str}
        """
        if self.kernel_manager and self.kernel_manager.is_alive():
            logger.info("Reusing existing kernel")
            return {
                "status": "reused",
                "kernel_id": self.kernel_manager.kernel_id,
                "notebook_path": self.get_notebook_path(),
            }

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
        return {
            "status": "started",
            "kernel_id": self.kernel_manager.kernel_id,
            "notebook_path": self.get_notebook_path(),
        }

    def execute_code(
        self, code: str, timeout: int = 60, silent: bool = False
    ) -> dict[str, Any]:
        """
        Execute code in the kernel.

        Args:
            code: Python code to execute
            timeout: Timeout in seconds
            silent: If True, don't store in kernel history

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
        self._execution_count += 1

        # Execute code
        msg_id = self.kernel_client.execute(code, silent=silent)

        outputs = []
        error_info = None
        status = "success"

        # Collect outputs
        try:
            while True:
                try:
                    msg = self.kernel_client.get_iopub_msg(timeout=timeout)
                except Exception:
                    break

                msg_type = msg["header"]["msg_type"]
                content = msg["content"]

                if msg_type == "stream":
                    outputs.append(
                        {
                            "type": "stream",
                            "name": content["name"],  # stdout or stderr
                            "text": content["text"],
                        }
                    )

                elif msg_type == "display_data" or msg_type == "execute_result":
                    outputs.append(
                        {
                            "type": msg_type,
                            "data": content.get("data", {}),
                            "metadata": content.get("metadata", {}),
                        }
                    )

                elif msg_type == "error":
                    status = "error"
                    error_info = {
                        "ename": content["ename"],
                        "evalue": content["evalue"],
                        "traceback": content["traceback"],
                    }

                elif msg_type == "status" and content["execution_state"] == "idle":
                    # Kernel finished executing
                    break

        except Exception as e:
            status = "error"
            error_info = {"ename": "TimeoutError", "evalue": str(e), "traceback": []}

        duration_ms = (time.time() - start_time) * 1000

        # Add cell to notebook
        cell_index = self._add_cell_to_notebook(code, outputs, self._execution_count)

        return {
            "status": status,
            "execution_count": self._execution_count,
            "outputs": outputs,
            "error": error_info,
            "duration_ms": duration_ms,
            "notebook_path": self.get_notebook_path(),
            "cell_index": cell_index,
        }

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

    def store_artifact(self, name: str, data: Any, format: str = "json") -> dict[str, str]:
        """
        Store an artifact to the session directory.

        Args:
            name: Artifact name (without extension)
            data: Data to store
            format: Storage format ("json", "text", "binary")

        Returns:
            dict with file info: {"path": str, "size_bytes": int}
        """
        artifacts_dir = self.session_dir / "artifacts"
        artifacts_dir.mkdir(exist_ok=True)

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

        return {"path": str(filepath), "size_bytes": size_bytes}

    def _load_or_create_notebook(self) -> dict[str, Any]:
        """Load existing notebook or create a new one."""
        if self.notebook_path.exists():
            with open(self.notebook_path, "r") as f:
                return json.load(f)
        else:
            # Create new notebook structure
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
            self._save_notebook(notebook)
            return notebook

    def _save_notebook(self, notebook_data: Optional[dict[str, Any]] = None):
        """Save notebook to file."""
        data = notebook_data or self.notebook_data
        with open(self.notebook_path, "w") as f:
            json.dump(data, f, indent=2)
        logger.info(f"Saved notebook: {self.notebook_path}")

    def _add_cell_to_notebook(
        self, code: str, outputs: list[dict], execution_count: int
    ) -> int:
        """
        Add a code cell to the notebook with outputs.

        Returns:
            Cell index
        """
        # Convert outputs to Jupyter notebook format
        nb_outputs = []
        for output in outputs:
            if output["type"] == "stream":
                nb_outputs.append(
                    {
                        "output_type": "stream",
                        "name": output["name"],
                        "text": output["text"].split("\n"),
                    }
                )
            elif output["type"] == "execute_result":
                nb_outputs.append(
                    {
                        "output_type": "execute_result",
                        "data": output["data"],
                        "metadata": output.get("metadata", {}),
                        "execution_count": execution_count,
                    }
                )
            elif output["type"] == "display_data":
                nb_outputs.append(
                    {
                        "output_type": "display_data",
                        "data": output["data"],
                        "metadata": output.get("metadata", {}),
                    }
                )

        # Create cell
        cell = {
            "cell_type": "code",
            "execution_count": execution_count,
            "metadata": {},
            "outputs": nb_outputs,
            "source": code.split("\n"),
        }

        # Add to notebook
        self.notebook_data["cells"].append(cell)
        self._save_notebook()

        return len(self.notebook_data["cells"]) - 1

    def get_notebook_path(self) -> str:
        """Get the absolute path to the notebook file."""
        return str(self.notebook_path.absolute())

    def shutdown(self):
        """Shutdown the kernel."""
        if self.kernel_client:
            self.kernel_client.stop_channels()
            self.kernel_client = None

        if self.kernel_manager:
            self.kernel_manager.shutdown_kernel()
            self.kernel_manager = None

        logger.info("Kernel shut down")

    def __del__(self):
        """Cleanup on deletion."""
        try:
            self.shutdown()
        except Exception:
            pass
