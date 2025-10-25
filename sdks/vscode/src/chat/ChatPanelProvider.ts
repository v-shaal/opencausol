import * as vscode from "vscode";

export interface SessionBinding {
  port: number;
  sessionID: string;
  pollInterval: number;
}

type SendHandler = (text: string) => Promise<void>;
type SessionResolver = () => SessionBinding | undefined;

export class ChatPanelProvider implements vscode.WebviewViewProvider {
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly resolveSession: SessionResolver,
    private readonly sendHandler: SendHandler,
  ) {}

  private view: vscode.WebviewView | undefined;

  resolveWebviewView(webviewView: vscode.WebviewView) {
    console.log("[ChatPanelProvider] resolveWebviewView called - creating view");
    this.view = webviewView;

    // Keep the webview alive even when hidden
    webviewView.webview.options = {
      enableScripts: true,
    };

    const webview = webviewView.webview;
    webview.html = this.getHtml(webview);
    webview.onDidReceiveMessage((message) => {
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
    console.log(`[ChatPanelProvider] Setting session: ${session.sessionID} @ ${session.port}`);
    this.postSession(session);
  }

  reveal() {
    if (!this.view) {
      return;
    }
    this.view.show?.(true);
  }

  private postSession(session: SessionBinding) {
    if (!this.view) {
      return;
    }
    const message = { type: "session", session };
    this.view.webview.postMessage(message);
  }

  private handleMessage(message: unknown) {
    if (!message || typeof message !== "object") {return;}
    const record = message as Record<string, unknown>;
    const type = typeof record.type === "string" ? record.type : "";
    if (type === "ready") {
      const session = this.resolveSession();
      if (session) {this.postSession(session);} 
      return;
    }
    if (type === "send") {
      const text = typeof record.text === "string" ? record.text.trim() : "";
      if (!text) {return;}
      this.sendHandler(text).catch((error) => {
        const reason = error instanceof Error ? error.message : String(error);
        void vscode.window.showErrorMessage(`Failed to send message: ${reason}`);
      });
    }
  }

  private getHtml(webview: vscode.Webview) {
    const nonce = this.createNonce();
    const cspSource = webview.cspSource;
    const styles = `
      :root {color-scheme: light dark;}
      body {margin: 0; padding: 0; font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); background: var(--vscode-editor-background); color: var(--vscode-foreground); display: flex; flex-direction: column; height: 100vh;}
      header {padding: 0.75rem 1rem; border-bottom: 1px solid var(--vscode-editorGroup-border); display: flex; flex-direction: column; gap: 0.25rem;}
      header h1 {font-size: 1rem; margin: 0; font-weight: 600;}
      header .meta {font-size: 0.8rem; color: var(--vscode-descriptionForeground);}
      main {flex: 1; display: flex; flex-direction: column; overflow: hidden;}
      #messages {flex: 1; padding: 1rem; overflow-y: auto; display: flex; flex-direction: column; gap: 0.75rem;}
      .msg {padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid var(--vscode-editorWidget-border); background: var(--vscode-editorWidget-background); white-space: pre-wrap;}
      .msg.assistant {border-color: var(--vscode-inputValidation-infoBorder);}
      .msg.user {border-color: var(--vscode-inputValidation-warningBorder);}
      form {border-top: 1px solid var(--vscode-editorGroup-border); padding: 0.75rem; display: flex; gap: 0.5rem;}
      textarea {flex: 1; resize: none; min-height: 3rem; max-height: 7rem; border-radius: 6px; border: 1px solid var(--vscode-input-border); padding: 0.5rem; background: var(--vscode-input-background); color: var(--vscode-input-foreground); font-family: inherit; font-size: inherit;}
      button {padding: 0.5rem 1rem; border-radius: 6px; border: none; cursor: pointer; background: var(--vscode-button-background); color: var(--vscode-button-foreground);}
      button:hover {background: var(--vscode-button-hoverBackground);}
      #status {font-size: 0.8rem; color: var(--vscode-descriptionForeground);}
    `;
    const script = this.getScript(nonce);
    return `<!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: https:; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; connect-src http://localhost:* https://localhost:*;" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <style>${styles}</style>
          <title>Causal Workflow</title>
        </head>
        <body>
          <header>
            <h1>Causal Workflow Chat</h1>
            <div id="status">No session attached</div>
          </header>
          <main>
            <section id="messages"></section>
          </main>
          <form id="composer">
            <textarea id="input" rows="3" placeholder="Ask about your causal workflow..."></textarea>
            <button type="submit">Send</button>
          </form>
          <script nonce="${nonce}">${script}</script>
        </body>
      </html>`;
  }

  private getScript(nonce: string) {
    const script = `const vscode = acquireVsCodeApi();
const state = { session: undefined, timer: undefined, messages: [], pollInterval: 1200 };
const statusNode = document.getElementById('status');
const messagesNode = document.getElementById('messages');
const inputNode = document.getElementById('input');
const formNode = document.getElementById('composer');

const renderStatus = () => {
  if (!state.session) { statusNode.textContent = 'No session attached'; return; }
  statusNode.textContent = 'Session ' + state.session.sessionID + ' @ ' + state.session.port + ' · polling ' + state.pollInterval + 'ms';
};

const renderMessages = (items) => {
  state.messages = items;
  messagesNode.innerHTML = '';
  for (const item of state.messages) {
    const wrapper = document.createElement('article');
    wrapper.className = 'msg ' + item.role;
    const content = [];
    if (Array.isArray(item.parts)) {
      for (const part of item.parts) {
        if (!part || typeof part !== 'object') { continue; }
        if (part.type === 'text' && typeof part.text === 'string') { content.push(part.text); }
        if (part.type === 'tool' && typeof part.name === 'string') { content.push('[tool] ' + part.name); }
      }
    }
    wrapper.textContent = content.length ? content.join('\\n\\n') : '[no content]';
    messagesNode.appendChild(wrapper);
  }
  messagesNode.scrollTop = messagesNode.scrollHeight;
};

const fetchJson = (url) => fetch(url).then((res) => {
  if (!res.ok) { return undefined; }
  return res.json();
}).catch(() => undefined);

const poll = async () => {
  if (!state.session) { return; }
  const base = 'http://localhost:' + state.session.port;
  const sessionUrl = base + '/session/' + state.session.sessionID;
  const messagesUrl = sessionUrl + '/message';
  console.log('[Webview] Polling:', messagesUrl);
  const [info, msgs] = await Promise.all([fetchJson(sessionUrl), fetchJson(messagesUrl)]);
  if (info && typeof info === 'object') {
    renderStatus();
  }
  if (Array.isArray(msgs)) {
    console.log('[Webview] Received messages:', msgs.length);
    renderMessages(msgs);
  } else {
    console.log('[Webview] No messages or invalid response:', msgs);
  }
};

const schedulePoll = () => {
  if (!state.session) { return; }
  if (typeof state.timer === 'number') { window.clearTimeout(state.timer); }
  const run = async () => {
    await poll();
    if (!state.session) { return; }
    state.timer = window.setTimeout(run, state.pollInterval);
  };
  void run();
};

const setSession = (payload) => {
  console.log('[Webview] setSession called with:', payload);
  state.session = payload.session;
  state.pollInterval = typeof payload.session?.pollInterval === 'number' ? payload.session.pollInterval : 1200;
  console.log('[Webview] Session set:', state.session);
  renderStatus();
  schedulePoll();
};

window.addEventListener('message', (event) => {
  console.log('[Webview] Received message:', event.data);
  const data = event.data;
  if (!data || typeof data !== 'object') {
    console.log('[Webview] Message data is not an object');
    return;
  }
  if (data.type === 'session') {
    console.log('[Webview] Processing session message');
    setSession(data);
  } else {
    console.log('[Webview] Unknown message type:', data.type);
  }
});

formNode.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!inputNode) { return; }
  const value = inputNode.value.trim();
  if (!value) { return; }
  console.log('[Webview] Sending message:', value);
  vscode.postMessage({ type: 'send', text: value });
  inputNode.value = '';

  // Optimistic UI update - show user message immediately
  const userMessage = {
    role: 'user',
    parts: [{ type: 'text', text: value }]
  };
  state.messages.push(userMessage);
  renderMessages(state.messages);
  console.log('[Webview] Message added optimistically');
});

console.log('[Webview] Initializing, sending ready message');
console.log('[Webview] DOM elements:', {
  statusNode: !!statusNode,
  messagesNode: !!messagesNode,
  inputNode: !!inputNode,
  formNode: !!formNode
});
vscode.postMessage({ type: 'ready' });
console.log('[Webview] Ready message sent, initial state:', state);

// Debug: Log to verify script is running
document.addEventListener('DOMContentLoaded', () => {
  console.log('[Webview] DOMContentLoaded event fired');
});
console.log('[Webview] Script execution completed');
`;
    return script;
  }

  private createNonce() {
    const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    return Array.from({ length: 16 }, () => {
      const index = Math.floor(Math.random() * charset.length);
      return charset[index];
    }).join("");
  }
}
