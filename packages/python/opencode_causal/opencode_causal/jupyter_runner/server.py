"""MCP server for Jupyter kernel management."""

import asyncio
import json
import logging
import re
from datetime import datetime
from pathlib import Path
from typing import Any

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

from .kernel import KernelManager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global kernel manager registry keyed by run directory
kernel_managers: dict[str, KernelManager] = {}
current_manager_key: str | None = None


def slugify(value: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "-", value.lower())
    return cleaned.strip("-")


def create_run_directory(analysis_name: str | None) -> Path:
    date_part = datetime.now().strftime("%Y%m%d")
    slug = slugify(analysis_name or "")
    if not slug:
        slug = "causal-analysis"

    base_dir = Path.cwd() / ".opencode" / "runs" / date_part
    base_dir.mkdir(parents=True, exist_ok=True)

    candidate = base_dir / slug
    suffix = 1
    while str(candidate.resolve()) in kernel_managers or candidate.exists():
        candidate = base_dir / f"{slug}-{suffix}"
        suffix += 1

    candidate.mkdir(parents=True, exist_ok=True)
    return candidate


def resolve_manager(session_dir: str | None, analysis_name: str | None, create: bool) -> KernelManager:
    global kernel_managers, current_manager_key

    if session_dir:
        run_dir = Path(session_dir).expanduser().resolve()
    elif current_manager_key and current_manager_key in kernel_managers:
        run_dir = Path(current_manager_key)
    elif create:
        run_dir = create_run_directory(analysis_name)
    else:
        run_dir = Path.cwd() / ".opencode" / "jupyter"
        run_dir.mkdir(parents=True, exist_ok=True)

    key = str(run_dir)

    if key not in kernel_managers and create:
        kernel_managers[key] = KernelManager(run_dir)

    if key not in kernel_managers:
        # Fall back to existing manager if available
        if current_manager_key and current_manager_key in kernel_managers:
            return kernel_managers[current_manager_key]
        kernel_managers[key] = KernelManager(run_dir)

    current_manager_key = key
    return kernel_managers[key]


def create_server() -> Server:
    """Create and configure the MCP server."""
    server = Server("jupyter-runner")

    @server.list_tools()
    async def list_tools() -> list[Tool]:
        """List available Jupyter kernel tools."""
        return [
            Tool(
                name="kernel_ensure",
                description="Ensure a Jupyter kernel is running. Starts a new kernel if needed, or reuses existing one.",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "python_version": {
                            "type": "string",
                            "description": "Specific Python version (e.g., '3.10'), or omit for default",
                        },
                        "session_dir": {
                            "type": "string",
                            "description": "Session directory for artifacts (optional)",
                        },
                        "analysis_name": {
                            "type": "string",
                            "description": "Short slug for the analysis (used for folder naming)",
                        },
                        "stage": {
                            "type": "string",
                            "description": "Stage identifier to pre-create the notebook (e.g., 'eda', 'estimation')",
                        },
                    },
                },
            ),
            Tool(
                name="cell_run",
                description="Execute Python code in the Jupyter kernel. Returns outputs, errors, and execution metadata.",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "code": {
                            "type": "string",
                            "description": "Python code to execute",
                        },
                        "timeout": {
                            "type": "number",
                            "description": "Timeout in seconds (default: 60)",
                            "default": 60,
                        },
                        "silent": {
                            "type": "boolean",
                            "description": "If true, don't store in kernel history (default: false)",
                            "default": False,
                        },
                        "session_dir": {
                            "type": "string",
                            "description": "Session directory previously passed to kernel_ensure",
                        },
                        "analysis_name": {
                            "type": "string",
                            "description": "Short slug for the analysis (used if a session directory was not provided)",
                        },
                        "stage": {
                            "type": "string",
                            "description": "Stage identifier (e.g., 'eda', 'dag', 'estimation')",
                            "default": "analysis",
                        },
                    },
                    "required": ["code"],
                },
            ),
            Tool(
                name="get_variable",
                description="Retrieve a variable value from the kernel namespace.",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "name": {
                            "type": "string",
                            "description": "Variable name to retrieve",
                        },
                        "session_dir": {
                            "type": "string",
                            "description": "Session directory previously passed to kernel_ensure",
                        },
                        "analysis_name": {
                            "type": "string",
                            "description": "Short slug for the analysis (used if a session directory was not provided)",
                        },
                    },
                    "required": ["name"],
                },
            ),
            Tool(
                name="artifact_store",
                description="Store data as an artifact in the session directory.",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "name": {
                            "type": "string",
                            "description": "Artifact name (without extension)",
                        },
                        "data": {
                            "type": ["object", "array", "string"],
                            "description": "Data to store",
                        },
                        "format": {
                            "type": "string",
                            "enum": ["json", "text"],
                            "description": "Storage format (default: json)",
                            "default": "json",
                        },
                        "session_dir": {
                            "type": "string",
                            "description": "Session directory previously passed to kernel_ensure",
                        },
                        "analysis_name": {
                            "type": "string",
                            "description": "Short slug for the analysis (used if a session directory was not provided)",
                        },
                        "stage": {
                            "type": "string",
                            "description": "Stage that produced the artifact (e.g., 'eda', 'estimation')",
                            "default": "analysis",
                        },
                    },
                    "required": ["name", "data"],
                },
            ),
        ]

    @server.call_tool()
    async def call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent]:
        """Handle tool calls."""
        try:
            if name == "kernel_ensure":
                python_version = arguments.get("python_version")
                session_dir = arguments.get("session_dir")
                analysis_name = arguments.get("analysis_name")
                stage = arguments.get("stage")

                km = resolve_manager(session_dir, analysis_name, create=True)
                result = km.ensure_kernel(python_version, stage=stage)
                result["run_directory"] = str(km.run_dir)
                return [TextContent(type="text", text=json.dumps(result, indent=2))]

            elif name == "cell_run":
                code = arguments["code"]
                timeout = arguments.get("timeout", 60)
                silent = arguments.get("silent", False)

                session_dir = arguments.get("session_dir")
                analysis_name = arguments.get("analysis_name")
                stage = arguments.get("stage")

                km = resolve_manager(session_dir, analysis_name, create=True)
                result = km.execute_code(code, timeout=timeout, silent=silent, stage=stage)
                return [TextContent(type="text", text=json.dumps(result, indent=2))]

            elif name == "get_variable":
                var_name = arguments["name"]
                session_dir = arguments.get("session_dir")
                analysis_name = arguments.get("analysis_name")
                km = resolve_manager(session_dir, analysis_name, create=False)
                result = km.get_variable(var_name)
                return [TextContent(type="text", text=json.dumps(result, indent=2))]

            elif name == "artifact_store":
                artifact_name = arguments["name"]
                data = arguments["data"]
                format = arguments.get("format", "json")

                session_dir = arguments.get("session_dir")
                analysis_name = arguments.get("analysis_name")
                stage = arguments.get("stage")

                km = resolve_manager(session_dir, analysis_name, create=True)
                result = km.store_artifact(artifact_name, data, format, stage=stage)
                return [TextContent(type="text", text=json.dumps(result, indent=2))]

            else:
                return [
                    TextContent(type="text", text=json.dumps({"error": f"Unknown tool: {name}"}))
                ]

        except Exception as e:
            logger.error(f"Error executing tool {name}: {e}", exc_info=True)
            return [
                TextContent(
                    type="text",
                    text=json.dumps(
                        {"error": str(e), "tool": name, "arguments": arguments}, indent=2
                    ),
                )
            ]

    return server


async def main():
    """Run the MCP server over stdio."""
    logger.info("Starting Jupyter Runner MCP server")
    server = create_server()

    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


if __name__ == "__main__":
    asyncio.run(main())
