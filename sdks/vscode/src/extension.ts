import * as vscode from "vscode";

import { ChatPanelProvider, type SessionBinding } from "./chat/ChatPanelProvider";

export function deactivate() {}

const TERMINAL_NAME = "opencode";
const SESSION_KEY = "opencode.causal.session";
const DEFAULT_POLL_INTERVAL = 1200;

export function activate(context: vscode.ExtensionContext) {
  const state: { session?: SessionBinding } = {};

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

  const sendChatMessage = async (text: string) => {
    const binding = state.session;
    if (!binding) {
      void vscode.window.showInformationMessage("Launch the causal workflow before sending messages.");
      return;
    }
    const target = `http://localhost:${binding.port}/session/${binding.sessionID}/message`;
    const response = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent: "causal-supervisor",
        parts: [{ type: "text", text }],
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

  if (state.session) {chatProvider.setSession(state.session);}

  context.subscriptions.push(
    openNewTerminalDisposable,
    openTerminalDisposable,
    addFilepathDisposable,
    openChatDisposable,
    startWorkflowDisposable,
    chatDisposable,
  );

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

    // Run local development version of opencode
    terminal.sendText(`cd ${workspaceRoot}/packages/opencode && bun ./src/index.ts --port ${port}`);

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
        parts: [{ type: "text", text: "Initialize causal workflow (framing → EDA → DAG → ID)." }],
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
