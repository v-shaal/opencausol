"""MCP server for Jupyter kernel management."""

import asyncio
import json
import logging
from pathlib import Path
from typing import Any

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

from .kernel import KernelManager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global kernel manager instance
kernel_manager: KernelManager | None = None


def get_kernel_manager(session_dir: str | None = None) -> KernelManager:
    """Get or create the kernel manager instance."""
    global kernel_manager
    if kernel_manager is None:
        session_path = Path(session_dir) if session_dir else None
        kernel_manager = KernelManager(session_path)
    return kernel_manager


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
                km = get_kernel_manager(session_dir)
                result = km.ensure_kernel(python_version)
                return [TextContent(type="text", text=json.dumps(result, indent=2))]

            elif name == "cell_run":
                code = arguments["code"]
                timeout = arguments.get("timeout", 60)
                silent = arguments.get("silent", False)

                km = get_kernel_manager()
                result = km.execute_code(code, timeout=timeout, silent=silent)
                return [TextContent(type="text", text=json.dumps(result, indent=2))]

            elif name == "get_variable":
                var_name = arguments["name"]
                km = get_kernel_manager()
                result = km.get_variable(var_name)
                return [TextContent(type="text", text=json.dumps(result, indent=2))]

            elif name == "artifact_store":
                artifact_name = arguments["name"]
                data = arguments["data"]
                format = arguments.get("format", "json")

                km = get_kernel_manager()
                result = km.store_artifact(artifact_name, data, format)
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
