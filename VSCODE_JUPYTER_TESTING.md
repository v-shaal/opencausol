# VS Code Jupyter Integration - Quick Testing Guide

## Prerequisites

1. **Install VS Code Jupyter Extension**
   ```bash
   code --install-extension ms-toolsai.jupyter
   ```

2. **Rebuild VS Code Extension**
   ```bash
   cd sdks/vscode
   npm run compile
   ```

3. **Ensure jupyter-runner is installed**
   ```bash
   cd packages/python/opencode_causal
   pip install -e .
   ```

## Testing Steps

### Test 1: End-to-End Workflow

1. **Launch Extension (Development Mode)**
   - Open VS Code in the `opencausol` workspace
   - Press `F5` to start debugging
   - New VS Code window opens with extension loaded

2. **Start Causal Workflow**
   - In the new window, run command: `OpenCode: Start Causal Workflow`
   - Chat panel opens in the sidebar
   - Wait for "Session attached" status

3. **Send Test Message**
   Type in chat:
   ```
   Execute this Python code: print("Hello from Jupyter!"); x = 42
   ```

4. **Expected Behavior**
   - ✅ Chat shows your message immediately
   - ✅ Agent processes and executes code
   - ✅ Notebook opens automatically: `.opencode/jupyter/analysis.ipynb`
   - ✅ Cell appears with code and output:
     ```
     [1] print("Hello from Jupyter!")
         x = 42

     Out[1]:
     Hello from Jupyter!
     ```
   - ✅ Chat shows "📓 Open Notebook" button

### Test 2: Multiple Executions

1. **Send Another Message**
   ```
   Now execute: import pandas as pd; print(pd.__version__)
   ```

2. **Expected Behavior**
   - ✅ Notebook adds Cell 2 (doesn't reopen)
   - ✅ New cell visible with pandas import
   - ✅ Chat shows button (no auto-open this time)

### Test 3: Manual Notebook Opening

1. **Close the Notebook Tab**
   Click X on the notebook tab

2. **Click "📓 Open Notebook" Button in Chat**

3. **Expected Behavior**
   - ✅ Notebook reopens
   - ✅ Both cells visible
   - ✅ All outputs preserved

### Test 4: Error Handling

1. **Send Invalid Code**
   ```
   Execute: this is invalid python!!!
   ```

2. **Expected Behavior**
   - ✅ Cell added to notebook
   - ✅ Error shown in cell output (red traceback)
   - ✅ Chat shows error message
   - ✅ Button still appears

## Verification Checklist

- [ ] Jupyter extension installed
- [ ] Extension rebuilds without errors
- [ ] jupyter-runner module imports successfully
- [ ] Workflow starts and chat opens
- [ ] First code execution opens notebook automatically
- [ ] Cell appears with code and output
- [ ] Subsequent executions add new cells
- [ ] Notebook doesn't reopen on subsequent executions
- [ ] Manual open button works
- [ ] Errors are captured and displayed
- [ ] Notebook file persists at `.opencode/jupyter/analysis.ipynb`

## Debugging

### Enable Developer Tools

1. **In Extension Development Window**
   - `Help > Toggle Developer Tools`
   - Check Console tab for errors

2. **Check Extension Logs**
   Look for:
   ```
   [opencode] Opening notebook: /path/to/analysis.ipynb
   [ChatPanelProvider] Failed to open notebook: ...
   [Webview] Auto-opening notebook: ...
   ```

3. **Check Webview Logs**
   In Console, filter by `[Webview]`:
   ```
   [Webview] Received messages: 5
   [Webview] Auto-opening notebook: ...
   [Webview] Opening notebook: ...
   ```

### Common Issues

**Issue**: Notebook doesn't open
- Check Jupyter extension is installed and enabled
- Verify file exists: `ls .opencode/jupyter/analysis.ipynb`
- Check extension console for errors

**Issue**: Cells not appearing
- Verify jupyter-runner added cells (check file content)
- Ensure notebook format is valid JSON
- Try closing and reopening notebook

**Issue**: Button doesn't work
- Check webview console logs
- Verify `openNotebook` function is defined
- Check message passing to extension

## Manual Verification

### Check Notebook File
```bash
cat .opencode/jupyter/analysis.ipynb | jq
```

Expected structure:
```json
{
  "cells": [
    {
      "cell_type": "code",
      "execution_count": 1,
      "metadata": {},
      "outputs": [...],
      "source": ["print('Hello from Jupyter!')", "x = 42"]
    }
  ],
  "metadata": {...},
  "nbformat": 4,
  "nbformat_minor": 5
}
```

### Check MCP Tool Response
Look in OpenCode logs for tool results:
```json
{
  "status": "success",
  "execution_count": 1,
  "outputs": [...],
  "notebook_path": "/Users/vishal/Projects/opencausol/.opencode/jupyter/analysis.ipynb",
  "cell_index": 0
}
```

## Expected Flow Summary

```
User → Chat Input → OpenCode Agent
         ↓
    MCP Tool: cell_run
         ↓
jupyter-runner: Execute + Save to .ipynb
         ↓
    Returns: {notebook_path, outputs}
         ↓
Chat WebView: Detect notebook_path
         ↓
First time? → Auto-open notebook
Always → Show "📓 Open Notebook" button
         ↓
VS Code: Open .ipynb file
         ↓
Jupyter Extension: Render notebook UI
         ↓
User sees: Cell with code + outputs
```

## Success Criteria

✅ **Fully Working** when:
1. Notebook opens automatically on first execution
2. All cells appear with correct code and outputs
3. Multiple executions add sequential cells
4. Manual button works after closing notebook
5. Errors are captured and displayed properly
6. Notebook persists across sessions

## Next Steps After Testing

If all tests pass:
1. Test with actual causal-eda agent
2. Try with pandas DataFrames and plots
3. Test multi-session workflows
4. Verify notebook persistence across VS Code restarts
5. Test with multiple workflows (create different notebooks)

## Reporting Issues

If you encounter issues, provide:
1. VS Code version
2. Extension console logs
3. Webview console logs
4. Content of `.opencode/jupyter/analysis.ipynb`
5. Steps to reproduce
6. Expected vs actual behavior
