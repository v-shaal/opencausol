import * as path from "path";
import * as vscode from "vscode";

import { ChatPanelProvider, type SessionBinding } from "./chat/ChatPanelProvider";
import { registerNotebookSync } from "./notebookSync";

export function deactivate() {}

const TERMINAL_NAME = "opencode";
const SESSION_KEY = "opencode.causal.session";
const DEFAULT_POLL_INTERVAL = 1200;

export function activate(context: vscode.ExtensionContext) {
  const state: { session?: SessionBinding } = {};

  const useRtcNotebookSync = () => {
    const config = vscode.workspace.getConfiguration("opencode.causal");
    return config.get<boolean>("rtcNotebookSync") === true;
  };

  const pollInterval = () => {
    const configuration = vscode.workspace.getConfiguration("opencode.causal");
    const configured = configuration.get<number>("pollIntervalMs");
    if (typeof configured === "number" && configured > 0) {return configured;}
    return DEFAULT_POLL_INTERVAL;
  };

  // Helper function to check if server is reachable (defined early for use in activation)
  async function pingPort(port: number) {
    // Use /project endpoint to check if server is ready
    const response = await fetch(`http://localhost:${port}/project`).catch(() => undefined);
    if (!response) {return false;}
    return response.ok;
  }

  // Validate stored session asynchronously (non-blocking)
  const stored = context.workspaceState.get<{ port: number; sessionID: string }>(SESSION_KEY);
  if (stored) {
    console.log(`[opencode] Found stored session: ${stored.sessionID} @ ${stored.port}`);
    // Validate in background without blocking activation
    pingPort(stored.port).then(async (reachable) => {
      if (reachable) {
        console.log(`[opencode] Stored session server is reachable, restoring session`);
        state.session = { ...stored, pollInterval: pollInterval() };
        chatProvider.setSession(state.session);
      } else {
        console.log(`[opencode] Stored session server not reachable, clearing old session`);
        await context.workspaceState.update(SESSION_KEY, undefined);
      }
    });
  }

  const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024; // 2 MB limit for inline attachments
  const TEXTUAL_MIMES = new Set(["application/json", "application/x-ipynb+json"]);
  const MIME_TABLE: Record<string, string> = {
    js: "text/javascript",
    jsx: "text/javascript",
    ts: "text/x-typescript",
    tsx: "text/x-typescript",
    py: "text/x-python",
    json: "application/json",
    md: "text/markdown",
    html: "text/html",
    css: "text/css",
    txt: "text/plain",
    log: "text/plain",
    csv: "text/csv",
    tsv: "text/tab-separated-values",
    ipynb: "application/x-ipynb+json",
    yml: "text/yaml",
    yaml: "text/yaml",
    sh: "text/x-shellscript",
    bash: "text/x-shellscript",
    ps1: "text/x-powershell",
    svg: "image/svg+xml",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    bmp: "image/bmp",
    ico: "image/vnd.microsoft.icon",
    pdf: "application/pdf",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    mp4: "video/mp4",
    mov: "video/quicktime",
    zip: "application/zip",
    gz: "application/gzip",
    tar: "application/x-tar",
    parquet: "application/x-parquet",
    feather: "application/octet-stream",
    sav: "application/octet-stream",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xls: "application/vnd.ms-excel",
  };

  const describeBytes = (size: number) => {
    if (size < 1024) {return `${size} B`;}
    const kilo = size / 1024;
    if (kilo < 1024) {return `${kilo.toFixed(1)} KB`;}
    const mega = kilo / 1024;
    if (mega < 1024) {return `${mega.toFixed(1)} MB`;}
    const giga = mega / 1024;
    return `${giga.toFixed(1)} GB`;
  };

  const sendChatMessage = async (text: string, files: string[] = []) => {
    const binding = state.session;
    if (!binding) {
      void vscode.window.showInformationMessage("Launch the causal workflow before sending messages.");
      return;
    }

    // Build message parts
    const userTextParts: any[] = [];
    const summaryParts: any[] = [];
    const dataInfoParts: any[] = [];
    const attachmentParts: any[] = [];
    const fileMentions: string[] = [];

    if (text && text.trim()) {
      userTextParts.push({ type: "text", text });
    }

    if (files.length > 0) {
      const dataFileExtensions = new Set(["csv", "tsv", "parquet", "xlsx", "xls", "feather", "sav"]);
      for (const filePath of files) {
        try {
          const uri = vscode.Uri.file(filePath);
          const stat = await vscode.workspace.fs.stat(uri);
          if (stat.size > MAX_ATTACHMENT_BYTES) {
            void vscode.window.showWarningMessage(
              `Skipped attaching ${filePath} because it exceeds ${(MAX_ATTACHMENT_BYTES / (1024 * 1024)).toFixed(1)} MB. ` +
                "Large files are not supported in inline chat attachments."
            );
            continue;
          }

          const ext = filePath.split(".").pop()?.toLowerCase() || "";
          const relativePath = vscode.workspace.asRelativePath(uri);
          const absolutePath = uri.fsPath;
          const displayPath = relativePath.startsWith("..") ? absolutePath : relativePath;
          const sizeLabel = describeBytes(stat.size);

          if (dataFileExtensions.has(ext)) {
            dataInfoParts.push({
              type: "text",
              text: `Attached data file: ${displayPath} (absolute path: ${absolutePath}, size: ${sizeLabel})`,
            });
            fileMentions.push(`- data file: ${displayPath} (absolute path: ${absolutePath}, size: ${sizeLabel})`);
            continue;
          }

          const content = await vscode.workspace.fs.readFile(uri);

          const detected = MIME_TABLE[ext] || "";
          const mediaType = detected || "application/octet-stream";
          const isTextual = mediaType.startsWith("text/") || TEXTUAL_MIMES.has(mediaType);

          fileMentions.push(`- file: ${displayPath} (mime: ${mediaType}, size: ${sizeLabel})`);

          if (!isTextual) {
            dataInfoParts.push({
              type: "text",
              text: `Attached file available on disk: ${absolutePath} (mime: ${mediaType}, size: ${sizeLabel})`,
            });
            continue;
          }

          // Create data URI with base64 encoded content
          const base64Content = Buffer.from(content).toString("base64");
          const dataUri = `data:${mediaType};base64,${base64Content}`;

          attachmentParts.push({
            type: "file",
            mime: mediaType,
            filename: relativePath,
            url: dataUri,
          });
        } catch (error) {
          console.error(`[opencode] Failed to read file: ${filePath}`, error);
          void vscode.window.showWarningMessage(`Failed to read file: ${filePath}`);
        }
      }
    }

    if (fileMentions.length > 0) {
      summaryParts.push({
        type: "text",
        text: `Attached files:\n${fileMentions.join("\n")}`,
      });
    }

    const parts = [...userTextParts, ...summaryParts, ...dataInfoParts, ...attachmentParts];

    if (parts.length === 0) {
      console.warn("[opencode] No content to send (empty text and no files)");
      return;
    }

    const target = `http://localhost:${binding.port}/session/${binding.sessionID}/message`;
    const response = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent: "causal-supervisor",
        parts,
      }),
    }).catch(() => undefined);

    if (!response) {
      void vscode.window.showErrorMessage("Failed to reach opencode session.");
      return;
    }
    if (!response.ok) {
      void vscode.window.showErrorMessage(`Failed to send message: ${response.statusText}`);
    }
  };

  console.log("[opencode] Creating ChatPanelProvider");
  const chatProvider = new ChatPanelProvider(context, () => state.session, sendChatMessage);
  console.log("[opencode] Registering webview view provider for 'opencode.chatView'");
  const chatDisposable = vscode.window.registerWebviewViewProvider("opencode.chatView", chatProvider, {
    webviewOptions: {
      retainContextWhenHidden: true,
    },
  });
  console.log("[opencode] WebviewViewProvider registered successfully");

  const openNewTerminalDisposable = vscode.commands.registerCommand("opencode.openNewTerminal", async () => {
    await openTerminal();
  });

  const openTerminalDisposable = vscode.commands.registerCommand("opencode.openTerminal", async () => {
    const existingTerminal = vscode.window.terminals.find((terminal) => terminal.name === TERMINAL_NAME);
    if (existingTerminal) {
      existingTerminal.show();
      return;
    }
    await openTerminal();
  });

  const addFilepathDisposable = vscode.commands.registerCommand("opencode.addFilepathToTerminal", async () => {
    const fileRef = getActiveFile();
    if (!fileRef) {return;}
    const terminal = vscode.window.activeTerminal;
    if (!terminal) {return;}
    if (terminal.name !== TERMINAL_NAME) {return;}
    const creationOptions = (terminal as any).creationOptions as vscode.TerminalOptions & { env?: Record<string, string> };
    const portValue = creationOptions?.env?._EXTENSION_OPENCODE_PORT;
    const port = typeof portValue === "string" ? parseInt(portValue, 10) : undefined;
    if (!port) {
      terminal.sendText(fileRef);
      terminal.show();
      return;
    }
    await appendPrompt(port, fileRef);
    terminal.show();
  });

  const openChatDisposable = vscode.commands.registerCommand("opencode.causal.openChat", async () => {
    console.log("[opencode] openChat command triggered");

    // First, ensure the Explorer sidebar is visible
    await vscode.commands.executeCommand("workbench.view.explorer");
    console.log("[opencode] Explorer view opened");

    // Small delay to let Explorer sidebar render
    await new Promise(resolve => setTimeout(resolve, 100));

    // Try to focus the specific view
    try {
      await vscode.commands.executeCommand("opencode.chatView.focus");
      console.log("[opencode] Chat view focused via focus command");
    } catch (error) {
      console.log("[opencode] Focus command failed:", error);
      // Fallback: try using the reveal method
      chatProvider.reveal();
      console.log("[opencode] Attempted reveal() as fallback");
    }
  });

  const startWorkflowDisposable = vscode.commands.registerCommand("opencode.causal.start", async () => {
    console.log("[opencode] Starting causal workflow...");

    // Clear any old session first
    console.log("[opencode] Clearing old session from state");
    state.session = undefined;
    await context.workspaceState.update(SESSION_KEY, undefined);

    const port = await resolvePort();
    if (!port) {
      console.log("[opencode] Failed to resolve port");
      void vscode.window.showErrorMessage("Unable to connect to opencode server.");
      return;
    }
    console.log(`[opencode] Resolved port: ${port}`);
    const sessionID = await createCausalSession(port);
    if (!sessionID) {
      console.log("[opencode] Failed to create session");
      return;
    }
    console.log(`[opencode] Created session: ${sessionID}`);
    const binding: SessionBinding = { port, sessionID, pollInterval: pollInterval() };
    await context.workspaceState.update(SESSION_KEY, { port, sessionID });
    state.session = binding;
    console.log("[opencode] Setting session on chat provider");
    chatProvider.setSession(binding);
    console.log("[opencode] Executing openChat command");
    await vscode.commands.executeCommand("opencode.causal.openChat");
    console.log("[opencode] Workflow start complete");
  });

  // Register Jupyter notebook commands
  const openNotebookDisposable = vscode.commands.registerCommand(
    "opencode.openNotebook",
    async (notebookPath: string) => {
      const trimmed = typeof notebookPath === "string" ? notebookPath.trim() : "";
      if (!trimmed) {
        void vscode.window.showErrorMessage("Notebook path missing from causal workflow response.");
        return;
      }

      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      let resolved = trimmed;
      if (workspaceFolder && !path.isAbsolute(trimmed)) {
        resolved = path.join(workspaceFolder.uri.fsPath, trimmed);
      }

      const notebookUri = vscode.Uri.file(resolved);
      try {
        const document = await vscode.workspace.openNotebookDocument(notebookUri);
        await vscode.window.showNotebookDocument(document, { preview: false });
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        void vscode.window.showErrorMessage(`Failed to open notebook: ${reason}`);
      }
    },
  );

  const openFileDisposable = vscode.commands.registerCommand("opencode.openFile", async (filePath: string) => {
    const trimmed = typeof filePath === "string" ? filePath.trim() : "";
    if (!trimmed) {
      void vscode.window.showErrorMessage("File path missing.");
      return;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    let resolved = trimmed;
    if (workspaceFolder && !path.isAbsolute(trimmed)) {
      resolved = path.join(workspaceFolder.uri.fsPath, trimmed);
    }

    const fileUri = vscode.Uri.file(resolved);
    try {
      await vscode.commands.executeCommand("vscode.open", fileUri);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      void vscode.window.showErrorMessage(`Failed to open file: ${reason}`);
    }
  });

  if (state.session) {chatProvider.setSession(state.session);}

  context.subscriptions.push(
    openNewTerminalDisposable,
    openTerminalDisposable,
    addFilepathDisposable,
    openChatDisposable,
    startWorkflowDisposable,
    openNotebookDisposable,
    openFileDisposable,
    chatDisposable,
  );

  // Always register notebook sync - RTC server saves to disk, file watcher updates editor
  registerNotebookSync(context);

  async function openTerminal(): Promise<number | undefined> {
    const port = Math.floor(Math.random() * (65535 - 16384 + 1)) + 16384;
    console.log(`[opencode] Creating terminal on port ${port}`);

    // Create terminal with minimal options to avoid spawn errors
    console.log("[opencode] About to create terminal...");
    const terminal = vscode.window.createTerminal(TERMINAL_NAME);
    console.log("[opencode] Terminal object created");

    terminal.show();
    console.log("[opencode] Terminal shown");

    // Always use local development version from opencausol workspace
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      void vscode.window.showErrorMessage("No workspace folder found. Please open the opencausol project.");
      return undefined;
    }

    const modelsUri = vscode.Uri.file(path.join(workspaceRoot, "packages/opencode/provider/models.local.json"));
    const modelsExists = await vscode.workspace.fs.stat(modelsUri).then(
      () => true,
      () => false,
    );
    const modelsEnv = modelsExists ? `MODELS_JSON="${modelsUri.toString()}" ` : "";
    const pythonPath = `${workspaceRoot}/packages/python/opencode_causal:${workspaceRoot}/packages/python`;
    const pyEnv = `PYTHONPATH=\"${pythonPath}\" `;
    if (!modelsExists) {
      console.warn(`[opencode] Local models catalog missing at ${modelsUri.fsPath}, falling back to remote fetch`);
    }

    // Run local development version of opencode with local models catalog when available
    const rtcEnv = useRtcNotebookSync() ? "OPENCODE_RTC_NOTEBOOK_SYNC=1 " : "";
    terminal.sendText(`cd ${workspaceRoot}/packages/opencode && ${pyEnv}${modelsEnv}${rtcEnv}bun ./src/index.ts --port ${port}`);

    // Wait longer for server to start (120 attempts x 500ms = 60 seconds)
    // OpenCode TUI takes time to compile Go binaries on first run
    console.log(`[opencode] Waiting for server to start on port ${port}...`);
    const attempts = Array.from({ length: 120 });
    for (const [index] of attempts.entries()) {
      await delay(500);
      const reachable = await pingPort(port);
      if (index % 4 === 0) {
        console.log(`[opencode] Ping attempt ${index + 1}/120 on port ${port}: ${reachable ? 'SUCCESS' : 'waiting...'}`);
      }
      if (reachable) {
        console.log(`[opencode] Server started on port ${port} after ${(index + 1) * 500}ms`);
        const fileRef = getActiveFile();
        if (fileRef) {await appendPrompt(port, `In ${fileRef}`);}
        terminal.show();
        return port;
      }
    }

    // Server didn't start in time
    void vscode.window.showErrorMessage(
      `OpenCode server failed to start on port ${port} after 60 seconds. Check the terminal named "${TERMINAL_NAME}" for errors. Common issues: Go binary compilation (first run takes ~2-3 minutes), missing dependencies, or port conflicts.`
    );
    terminal.show(); // Show terminal so user can see the error
    return undefined;
  }

  function getActiveFile() {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {return;}
    const document = activeEditor.document;
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!workspaceFolder) {return;}
    const relativePath = vscode.workspace.asRelativePath(document.uri);
    let filepathWithAt = `@${relativePath}`;
    const selection = activeEditor.selection;
    if (!selection.isEmpty) {
      const startLine = selection.start.line + 1;
      const endLine = selection.end.line + 1;
      if (startLine === endLine) {
        filepathWithAt += `#L${startLine}`;
      }
      if (startLine !== endLine) {
        filepathWithAt += `#L${startLine}-${endLine}`;
      }
    }
    return filepathWithAt;
  }

  async function appendPrompt(port: number, text: string) {
    const response = await fetch(`http://localhost:${port}/tui/append-prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    }).catch(() => undefined);
    if (!response) {return;}
    if (!response.ok) {
      void vscode.window.showErrorMessage("Failed to append prompt to opencode terminal.");
    }
  }

  function getExistingPort() {
    const terminal = vscode.window.terminals.find((candidate) => candidate.name === TERMINAL_NAME);
    if (!terminal) {return;}
    const creationOptions = (terminal as any).creationOptions as vscode.TerminalOptions & { env?: Record<string, string> };
    const portValue = creationOptions?.env?._EXTENSION_OPENCODE_PORT;
    const parsed = typeof portValue === "string" ? parseInt(portValue, 10) : undefined;
    if (!parsed) {return;}
    return parsed;
  }

  async function resolvePort(): Promise<number | undefined> {
    console.log("[opencode] Resolving port...");

    // First check if we have a stored session with a reachable server
    const binding = state.session;
    if (binding) {
      console.log(`[opencode] Checking stored session port ${binding.port}`);
      const reachable = await pingPort(binding.port);
      if (reachable) {
        console.log(`[opencode] Stored session server is reachable`);
        return binding.port;
      }
      console.log(`[opencode] Stored session server not reachable`);
    }

    // Try to get port from existing terminal
    const existing = getExistingPort();
    if (existing) {
      console.log(`[opencode] Found existing terminal with port ${existing}`);
      const reachable = await pingPort(existing);
      if (reachable) {
        console.log(`[opencode] Existing terminal server is reachable`);
        return existing;
      }
      console.log(`[opencode] Existing terminal server not reachable`);
    }

    // Check if there's already an opencode terminal but we couldn't get its port
    // Close it and create a new one instead of showing an error
    const existingTerminal = vscode.window.terminals.find((t) => t.name === TERMINAL_NAME);
    if (existingTerminal) {
      console.log("[opencode] Found old opencode terminal, disposing it");
      existingTerminal.dispose();
      // Small delay to let terminal cleanup
      await delay(500);
    }

    // No existing terminal found (or old one was disposed), create a new one
    console.log("[opencode] Creating new terminal");
    return openTerminal();
  }

  async function createCausalSession(port: number): Promise<string | undefined> {
    console.log(`[opencode] Creating causal session on port ${port}`);
    const createResponse = await fetch(`http://localhost:${port}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Causal Workflow" }),
    }).catch(() => undefined);
    if (!createResponse) {
      console.log("[opencode] Failed to fetch session creation endpoint");
      void vscode.window.showErrorMessage("Failed to create opencode session.");
      return;
    }
    if (!createResponse.ok) {
      console.log(`[opencode] Session creation returned ${createResponse.status}: ${createResponse.statusText}`);
      void vscode.window.showErrorMessage(`Failed to create session: ${createResponse.statusText}`);
      return;
    }
    console.log("[opencode] Session created, parsing response");
    const info = (await createResponse.json().catch(() => undefined)) as { id?: string } | undefined;
    const sessionID = info?.id;
    if (!sessionID) {
      console.log("[opencode] Session ID missing from response");
      void vscode.window.showErrorMessage("Session id missing from opencode response.");
      return;
    }
    console.log(`[opencode] Session ID: ${sessionID}, sending kickoff message`);

    // Send kickoff message with timeout (non-blocking)
    const kickoffPromise = fetch(`http://localhost:${port}/session/${sessionID}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent: "causal-supervisor",
        parts: [{ type: "text", text: "How can I help you today?" }],
      }),
    });

    const timeoutPromise = new Promise<Response>((_, reject) =>
      setTimeout(() => reject(new Error("Kickoff timeout after 5s")), 5000)
    );

    const kickoffResponse = await Promise.race([kickoffPromise, timeoutPromise]).catch((error) => {
      console.log("[opencode] Kickoff fetch error:", error instanceof Error ? error.message : String(error));
      return undefined;
    });

    if (!kickoffResponse) {
      console.log("[opencode] Kickoff message timed out or failed, continuing anyway...");
      // Don't fail - just continue without kickoff
      return sessionID;
    }
    if (!kickoffResponse.ok) {
      console.log(`[opencode] Kickoff message returned ${kickoffResponse.status}: ${kickoffResponse.statusText}`);
      // Don't fail - just continue without kickoff
      return sessionID;
    }
    console.log("[opencode] Kickoff message sent successfully");
    return sessionID;
  }
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
