import * as vscode from "vscode";

export interface SessionBinding {
  port: number;
  sessionID: string;
  pollInterval: number;
}

type SendHandler = (text: string, files?: string[]) => Promise<void>;
type SessionResolver = () => SessionBinding | undefined;

export class ChatPanelProvider implements vscode.WebviewViewProvider {
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly resolveSession: SessionResolver,
    private readonly sendHandler: SendHandler,
  ) {}

  private view: vscode.WebviewView | undefined;

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
    };

    webviewView.webview.html = this.getHtml(webviewView.webview);
    webviewView.webview.onDidReceiveMessage((message) => {
      this.handleMessage(message);
    });

    const session = this.resolveSession();
    if (session) {
      this.postSession(session);
    }
  }

  setSession(session: SessionBinding | undefined) {
    if (!session || !this.view) {
      return;
    }
    this.postSession(session);
  }

  reveal() {
    this.view?.show?.(true);
  }

  private postSession(session: SessionBinding) {
    this.view?.webview.postMessage({ type: "session", session });
  }

  private handleMessage(message: unknown) {
    if (!message || typeof message !== "object") {
      return;
    }
    const record = message as Record<string, unknown>;
    const type = typeof record.type === "string" ? record.type : "";
    if (type === "ready") {
      const session = this.resolveSession();
      if (session) {
        this.postSession(session);
      }
      return;
    }
    if (type === "send") {
      const text = typeof record.text === "string" ? record.text.trim() : "";
      const files = Array.isArray(record.files) ? record.files as string[] : [];
      if (!text && files.length === 0) {
        return;
      }
      this.sendHandler(text, files).catch((error) => {
        const reason = error instanceof Error ? error.message : String(error);
        void vscode.window.showErrorMessage(`Failed to send message: ${reason}`);
      });
      return;
    }
    if (type === "getAvailableFiles") {
      void this.handleGetAvailableFiles();
      return;
    }
    if (type === "openNotebook") {
      const notebookPath = typeof record.notebookPath === "string" ? record.notebookPath : "";
      if (!notebookPath) {
        return;
      }
      void vscode.commands.executeCommand("opencode.openNotebook", notebookPath);
      return;
    }
    if (type === "openFile") {
      const filePath = typeof record.path === "string" ? record.path : "";
      if (!filePath) {
        return;
      }
      void vscode.commands.executeCommand("opencode.openFile", filePath);
      return;
    }
    if (type === "browseFiles") {
      void this.handleBrowseFiles();
    }
  }

  private async handleBrowseFiles() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const dialogOptions: vscode.OpenDialogOptions = {
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: true,
      openLabel: "Attach",
      defaultUri: workspaceFolder?.uri,
    };

    let picks: readonly vscode.Uri[] | undefined;
    try {
      picks = await vscode.window.showOpenDialog(dialogOptions);
    } catch {
      picks = undefined;
    }

    if (!picks) {
      this.view?.webview.postMessage({ type: "browseFilesResult", files: [] });
      return;
    }

    const files = picks.map((uri: vscode.Uri) => ({
      path: uri.fsPath,
      relativePath: vscode.workspace.asRelativePath(uri, false),
    }));

    this.view?.webview.postMessage({ type: "browseFilesResult", files });
  }

  private getHtml(webview: vscode.Webview) {
    const nonce = this.createNonce();
    const cspSource = webview.cspSource;
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, "media", "chat-webview.js"));
    const attachmentHandlerUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, "media", "attachment-handler.js"));
    // RTC notebook view disabled - notebooks update in main editor instead
    // Keep variable for template compatibility, but script is commented out in HTML
    const rtcScriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, "media", "rtc-notebook.js"));
    const attachmentStylesUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, "media", "attachment-styles.css"));
    const cacheBuster = Date.now();
    const defaultPoll = this.resolveSession()?.pollInterval ?? 1200;

    const styles = `
      :root {color-scheme: light dark;}
      body {margin: 0; padding: 0; font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); background: var(--vscode-editor-background); color: var(--vscode-foreground); display: flex; flex-direction: column; height: 100vh;}
      header {padding: 0.75rem 1rem; border-bottom: 1px solid var(--vscode-editorGroup-border); display: flex; flex-direction: column; gap: 0.25rem;}
      header h1 {font-size: 1rem; margin: 0; font-weight: 600;}
      header .meta {font-size: 0.8rem; color: var(--vscode-descriptionForeground);}
      main {flex: 1; display: flex; flex-direction: column; overflow: hidden;}
      #notebook-view {border-bottom: 1px solid var(--vscode-editorGroup-border); padding: 0.75rem 1rem; overflow-y: auto; max-height: 40vh; display: flex; flex-direction: column; gap: 0.6rem;}
      #notebook-view.hidden {display: none;}
      .rtc-notebook-header {font-size: 0.85rem; font-weight: 600;}
      .rtc-notebook-status {font-size: 0.75rem; color: var(--vscode-descriptionForeground);}
      .rtc-notebook-body {display: flex; flex-direction: column; gap: 0.5rem;}
      .rtc-cell {border: 1px solid var(--vscode-editorWidget-border); border-radius: 6px; padding: 0.5rem; background: var(--vscode-editorWidget-background);}
      .rtc-cell-header {font-size: 0.8rem; margin-bottom: 0.3rem; color: var(--vscode-descriptionForeground);}
      .rtc-cell-body.code {background: var(--vscode-editor-background); border-radius: 4px; padding: 0.5rem; overflow-x: auto;}
      .rtc-cell-outputs {margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.35rem;}
      .rtc-output pre {margin: 0; padding: 0.4rem; border-radius: 4px; background: var(--vscode-editor-background); overflow-x: auto;}
      .rtc-output-error pre {border: 1px solid var(--vscode-inputValidation-errorBorder);}
      .rtc-output-display pre {border: 1px solid var(--vscode-inputValidation-infoBorder);}
      .rtc-output-stream pre {border: 1px solid var(--vscode-editorWidget-border);}
      #messages {flex: 1; padding: 1rem; overflow-y: auto; display: flex; flex-direction: column; gap: 0.75rem;}
      .msg {padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid var(--vscode-editorWidget-border); background: var(--vscode-editorWidget-background);}
      .msg.assistant {border-color: var(--vscode-inputValidation-infoBorder);}
      .msg.user {border-color: var(--vscode-inputValidation-warningBorder);}
      .msg .message-content {white-space: normal; line-height: 1.45;}
      .msg .message-content h1,
      .msg .message-content h2,
      .msg .message-content h3 {margin: 0.5rem 0; font-weight: 600;}
      .msg .message-content p {margin: 0.45rem 0;}
      .msg .message-content ul {margin: 0.4rem 0 0.4rem 1.2rem; padding-left: 1.2rem;}
      .msg .message-content li {margin: 0.2rem 0;}
      .msg .message-content code {background: var(--vscode-editorWidget-background); padding: 0.1rem 0.3rem; border-radius: 4px; border: 1px solid var(--vscode-editorWidget-border);}
      .msg .message-content pre {margin: 0.5rem 0; padding: 0.6rem; border-radius: 6px; background: var(--vscode-editorWidget-background); border: 1px solid var(--vscode-editorWidget-border); overflow-x: auto;}
      .tool-list {max-height: 220px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.5rem; padding: 0.25rem 0;}
      .tool-entry {border: 1px solid var(--vscode-editorWidget-border); border-radius: 6px; padding: 0.5rem; background: var(--vscode-editor-background);}
      .tool-entry .tool-header {font-weight: 600; margin-bottom: 0.25rem;}
      .tool-entry .tool-title {font-size: 0.9rem; color: var(--vscode-descriptionForeground); margin-bottom: 0.25rem;}
      .tool-entry .tool-output {font-size: 0.9rem;}
      .attachment-buttons {display: flex; gap: 0.35rem; align-items: center; margin-right: 0.35rem;}
      .browse-btn {padding: 0.4rem 0.6rem; border-radius: 6px; border: 1px solid var(--vscode-editorWidget-border); background: var(--vscode-editorWidget-background); color: var(--vscode-foreground); cursor: pointer;}
      .browse-btn:hover {background: var(--vscode-editor-background);}
      form {border-top: 1px solid var(--vscode-editorGroup-border); padding: 0.75rem; display: flex; gap: 0.5rem;}
      textarea {flex: 1; resize: none; min-height: 3rem; max-height: 7rem; border-radius: 6px; border: 1px solid var(--vscode-input-border); padding: 0.5rem; background: var(--vscode-input-background); color: var(--vscode-input-foreground); font-family: inherit; font-size: inherit;}
      button {padding: 0.5rem 1rem; border-radius: 6px; border: none; cursor: pointer; background: var(--vscode-button-background); color: var(--vscode-button-foreground);}
      button:hover {background: var(--vscode-button-hoverBackground);}
      #status {font-size: 0.8rem; color: var(--vscode-descriptionForeground);}
      details.thinking {margin-top: 0.5rem; border: 1px solid var(--vscode-editorWidget-border); border-radius: 6px; background: var(--vscode-editor-background); padding: 0 0.5rem 0.5rem;}
      details.thinking summary {cursor: pointer; font-weight: 500; margin: 0.25rem 0;}
      details.thinking pre {margin: 0.25rem 0 0; padding: 0.5rem; border-radius: 4px; background: var(--vscode-editorWidget-background); border: 1px solid var(--vscode-editorWidget-border); white-space: pre-wrap; font-size: 0.85rem;}
      details.thinking ul {margin: 0.25rem 0 0; padding-left: 1.25rem;}
      details.thinking li {margin: 0.2rem 0; font-size: 0.85rem;}
      .file-link {margin-left: 0.35rem; padding: 0.2rem 0.6rem; border-radius: 4px; border: 1px solid var(--vscode-editorWidget-border); background: var(--vscode-editor-background); color: var(--vscode-textLink-foreground); cursor: pointer; font-size: 0.85rem;}
      .file-link:hover {background: var(--vscode-editorWidget-background);}
    `;

    return `<!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: https:; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; connect-src http://localhost:* https://localhost:* ws://localhost:* wss://localhost:* http://127.0.0.1:* https://127.0.0.1:* ws://127.0.0.1:* wss://127.0.0.1:*;" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <style>${styles}</style>
          <link rel="stylesheet" nonce="${nonce}" href="${attachmentStylesUri}">
          <title>Causal Workflow</title>
        </head>
        <body>
          <header>
            <h1>Causal Workflow Chat</h1>
            <div id="status">No session attached</div>
          </header>
          <main>
            <!-- RTC notebook view removed - notebooks update in main editor instead -->
            <section id="messages"></section>
          </main>
          <form id="composer">
            <div id="attachmentBar" class="attachment-bar">
              <div class="attachment-tabs">
                <button type="button" class="tab-btn active" data-source="tabs">📑 Active Tabs</button>
                <button type="button" class="tab-btn" data-source="files">📁 Files</button>
              </div>
              <div class="attachment-content">
                <div id="attachmentList" class="attachment-list"></div>
              </div>
            </div>
            <div id="selectedFiles" class="selected-files"></div>
            <div class="input-container">
              <div class="attachment-buttons">
                <button type="button" id="attachBtn" class="attach-btn" title="Add files, folders, docs..." aria-label="Attach files">📎</button>
                <button type="button" id="browseBtn" class="browse-btn" title="Browse for files" aria-label="Browse files">…</button>
              </div>
              <textarea id="input" rows="3" placeholder="Ask about your causal workflow..."></textarea>
              <button type="submit">Send</button>
            </div>
          </form>
          <script nonce="${nonce}">window.__CAUSAL_CHAT_CONFIG__ = { pollInterval: ${defaultPoll} };</script>
          <script nonce="${nonce}" src="${attachmentHandlerUri}?v=${cacheBuster}"></script>
          <!-- RTC notebook view disabled - notebooks update in main editor instead -->
          <!-- <script nonce="${nonce}" src="${rtcScriptUri}?v=${cacheBuster}"></script> -->
          <script nonce="${nonce}" src="${scriptUri}?v=${cacheBuster}"></script>
        </body>
      </html>`;
  }

  private async handleGetAvailableFiles() {
    const tabs = await this.getActiveTabs();
    const files = await this.getWorkspaceFiles();

    this.view?.webview.postMessage({
      type: "availableFiles",
      sources: {
        tabs,
        files,
      },
    });
  }

  private async getActiveTabs(): Promise<Array<{ path: string; relativePath: string }>> {
    const tabs = vscode.window.tabGroups.all.flatMap((group) => group.tabs);
    return tabs
      .filter((tab) => tab.input instanceof vscode.TabInputText)
      .map((tab) => {
        const input = tab.input as vscode.TabInputText;
        return {
          path: input.uri.fsPath,
          relativePath: vscode.workspace.asRelativePath(input.uri),
        };
      });
  }

  private async getWorkspaceFiles(): Promise<Array<{ path: string; relativePath: string }>> {
    try {
      const files = await vscode.workspace.findFiles("**/*", "**/node_modules/**", 100);
      return files.map((uri) => ({
        path: uri.fsPath,
        relativePath: vscode.workspace.asRelativePath(uri),
      }));
    } catch (error) {
      console.error("Error finding workspace files:", error);
      return [];
    }
  }

  private createNonce() {
    const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    return Array.from({ length: 16 }, () => {
      const index = Math.floor(Math.random() * charset.length);
      return charset[index];
    }).join("");
  }
}
