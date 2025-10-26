# OpenCode Causal - MCP Servers

Python MCP servers for causal inference workflows in OpenCode.

## Installation

```bash
cd packages/python/opencode_causal
pip install -e .
```

For development:
```bash
pip install -e ".[dev]"
```

## MCP Servers

### 1. Jupyter Runner

Manages Jupyter kernel lifecycle and code execution for causal inference analysis.

**Run as MCP server:**
```bash
python -m opencode_causal.jupyter_runner
```

**Tools provided:**
- `kernel_ensure` - Start/reuse Jupyter kernel
- `cell_run` - Execute Python code and capture outputs
- `get_variable` - Retrieve variable values from kernel
- `artifact_store` - Save artifacts to session directory

**Configuration in `opencode.json`:**
```json
{
  "mcp": {
    "jupyter-runner": {
      "type": "local",
      "command": ["python", "-m", "opencode_causal.jupyter_runner"],
      "enabled": true
    }
  }
}
```

### 2. Graph Math (Coming Soon)

DAG operations using NetworkX and pgmpy for causal graph analysis.

### 3. Causal Docs (Coming Soon)

RAG-based knowledge base for causal inference best practices.

## Development

Run tests:
```bash
pytest
```

Format code:
```bash
black .
ruff check --fix .
```

## Usage Example

From OpenCode agents, use the MCP tools:

```typescript
// In causal-eda agent
const result = await useMCPTool("jupyter-runner", "cell_run", {
  code: `
import pandas as pd
df = pd.read_csv('data.csv')
print(df.describe())
  `,
  timeout: 60
});
```

## Architecture

```
opencode_causal/
├── __init__.py
├── jupyter_runner/
│   ├── __init__.py
│   ├── server.py          # MCP server implementation
│   ├── kernel.py          # Jupyter kernel manager
│   └── __main__.py        # Entry point
├── graph_math/            # Coming soon
└── causal_docs/           # Coming soon
```
