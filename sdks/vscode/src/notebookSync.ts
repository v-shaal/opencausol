import * as path from "path";
import * as vscode from "vscode";

const decoder = new TextDecoder();
const log = (...args: unknown[]) => console.log("[opencode][notebook-sync]", ...args);

const buildCellOutputs = (entry: any, order: number) => {
  if (!entry) {return [];}
  const outputs: vscode.NotebookCellOutput[] = [];
  for (const out of entry) {
    if (!out) {continue;}
    const items: vscode.NotebookCellOutputItem[] = [];
    if (out.output_type === "stream") {
      const text = Array.isArray(out.text) ? out.text.join("") : String(out.text ?? "");
      const mime = out.name === "stderr" ? "text/x.stderr" : "text/plain";
      items.push(vscode.NotebookCellOutputItem.text(text, mime));
    }
    if (out.output_type === "execute_result" || out.output_type === "display_data") {
      const data = out.data ?? {};
      for (const key of Object.keys(data)) {
        const value = data[key];
        if (typeof value === "string") {
          items.push(vscode.NotebookCellOutputItem.text(value, key));
          continue;
        }
        if (Array.isArray(value)) {
          items.push(vscode.NotebookCellOutputItem.text(value.join(""), key));
          continue;
        }
        items.push(vscode.NotebookCellOutputItem.text(JSON.stringify(value), key));
      }
    }
    if (items.length === 0) {continue;}
    outputs.push(new vscode.NotebookCellOutput(items, out.metadata ?? {}));
  }
  return outputs;
};

const toCells = (nb: any) => {
  const input = Array.isArray(nb?.cells) ? nb.cells : [];
  const lang = nb?.metadata?.language_info?.name || "python";
  const result: vscode.NotebookCellData[] = [];
  for (const cell of input) {
    if (!cell) {continue;}
    const src = Array.isArray(cell.source) ? cell.source.join("") : String(cell.source ?? "");
    if (cell.cell_type === "markdown") {
      const data = new vscode.NotebookCellData(vscode.NotebookCellKind.Markup, src, "markdown");
      data.metadata = cell.metadata ?? {};
      result.push(data);
      continue;
    }
    const language = cell.metadata?.language || lang;
    const data = new vscode.NotebookCellData(vscode.NotebookCellKind.Code, src, language);
    data.outputs = buildCellOutputs(cell.outputs, cell.execution_count);
    if (cell.execution_count) {
      data.executionSummary = { executionOrder: cell.execution_count, success: true };
    }
    data.metadata = cell.metadata ?? {};
    result.push(data);
  }
  return result;
};

const parseNotebook = (raw: Uint8Array) => {
  try {
    return JSON.parse(decoder.decode(raw));
  } catch (error) {
    console.warn("[opencode][notebook-sync] Failed to parse notebook JSON", error);
    return undefined;
  }
};

const shouldSync = (uri: vscode.Uri) => {
  const normalized = path.normalize(uri.fsPath);
  return normalized.split(path.sep).includes(".opencode");
};

// Debounce map to prevent rapid successive updates
const pendingRefreshes = new Map<string, NodeJS.Timeout>();

const refresh = async (uri: vscode.Uri) => {
  if (!shouldSync(uri)) {return;}

  // Debounce: Wait 50ms for rapid file changes to settle
  const key = uri.fsPath;
  if (pendingRefreshes.has(key)) {
    clearTimeout(pendingRefreshes.get(key)!);
  }

  pendingRefreshes.set(key, setTimeout(async () => {
    pendingRefreshes.delete(key);
    await doRefresh(uri);
  }, 50));
};

const doRefresh = async (uri: vscode.Uri) => {
  try {
    const doc = vscode.workspace.notebookDocuments.find((d) => d.uri.fsPath === uri.fsPath);
    if (!doc) {return;}

    // Check if document is ready for updates
    if (doc.isClosed) {
      log("skipped (document closed)", path.relative(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "", uri.fsPath));
      return;
    }

    // Allow updates even if dirty - agent is the source of truth
    const raw = await Promise.resolve(vscode.workspace.fs.readFile(uri)).catch(() => undefined);
    if (!raw) {return;}
    const nb = parseNotebook(raw);
    if (!nb) {return;}
  const newCells = toCells(nb);

  // Smart diff: compare existing cells with new cells and apply minimal changes
  const currentCount = doc.cellCount;
  const newCount = newCells.length;
  const edits: vscode.NotebookEdit[] = [];
  const minCount = Math.min(currentCount, newCount);

  // Check each existing cell to see if it needs updating
  const currentCells = doc.getCells();
  for (let i = 0; i < minCount; i++) {
    const currentCell = currentCells[i];
    const newCell = newCells[i];

    // Compare cell source and outputs to detect changes
    const sourceChanged = currentCell.document.getText() !== newCell.value;
    const outputsChanged = currentCell.outputs.length !== newCell.outputs?.length;

    if (sourceChanged || outputsChanged) {
      // Update this cell in place
      edits.push(vscode.NotebookEdit.replaceCells(new vscode.NotebookRange(i, i + 1), [newCell]));
    }
  }

  // Handle length differences
  if (newCount > currentCount) {
    // Append new cells
    const cellsToAdd = newCells.slice(currentCount);
    edits.push(vscode.NotebookEdit.replaceCells(new vscode.NotebookRange(currentCount, currentCount), cellsToAdd));
  } else if (newCount < currentCount) {
    // Remove extra cells
    edits.push(vscode.NotebookEdit.replaceCells(new vscode.NotebookRange(newCount, currentCount), []));
  }

    // Apply all edits at once
    if (edits.length > 0) {
      const edit = new vscode.WorkspaceEdit();
      edit.set(doc.uri, edits);
      const success = await vscode.workspace.applyEdit(edit);

      if (success) {
        log("updated", `${edits.length} changes to ${path.relative(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "", uri.fsPath)}`);
      } else {
        log("failed to apply edits", path.relative(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "", uri.fsPath));
      }
    }
  } catch (error) {
    // Silently ignore errors during refresh to prevent UI crashes
    // This can happen when cells are being rapidly created/deleted
    console.warn("[opencode][notebook-sync] Error during refresh:", error);
  }
};

export const registerNotebookSync = (context: vscode.ExtensionContext) => {
  const watchers: vscode.FileSystemWatcher[] = [];
  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    const pattern = new vscode.RelativePattern(folder, "**/*.ipynb");
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);
    watcher.onDidCreate(refresh);
    watcher.onDidChange(refresh);
    watchers.push(watcher);
  }
  if (watchers.length > 0) {context.subscriptions.push(...watchers);}
};
