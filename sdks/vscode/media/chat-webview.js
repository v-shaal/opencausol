(function () {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => {
        for (const reg of regs) {
          const url = reg && reg.active ? reg.active.scriptURL : "";
          if (!url || !/service-worker\.js/.test(url)) {
            reg.unregister().catch(() => {});
          }
        }
      })
      .catch(() => {});
  }

  const vscode = acquireVsCodeApi();
  const config = window.__CAUSAL_CHAT_CONFIG__ || {};
  delete window.__CAUSAL_CHAT_CONFIG__;

  const defaultPoll = typeof config.pollInterval === "number" && config.pollInterval > 0 ? config.pollInterval : 1200;

  const state = {
    session: undefined,
    timer: undefined,
    messages: [],
    pollInterval: defaultPoll,
    openedNotebooks: new Set(),
    openSections: Object.create(null),
  };

  const NOTEBOOK_EXTENSIONS = [".ipynb"];
  const FILE_PATH_REGEX = /(?:^|\s)(\/[^\s]+\.[A-Za-z0-9._-]+)/g;

  const statusNode = document.getElementById("status");
  const messagesNode = document.getElementById("messages");
  const inputNode = document.getElementById("input");
  const formNode = document.getElementById("composer");

  if (!statusNode || !messagesNode || !inputNode || !formNode) {
    return;
  }

  const escapeHtml = (value) =>
    String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const renderInline = (value) =>
    escapeHtml(value)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");

  const renderMarkdown = (text) => {
    if (!text) return "<p></p>";
    const lines = String(text).split(/\n/);
    let html = "";
    let paragraph = [];
    let inList = false;
    let inCode = false;

    const flushParagraph = () => {
      if (!paragraph.length) return;
      html += `<p>${renderInline(paragraph.join(" "))}</p>`;
      paragraph = [];
    };

    const closeList = () => {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
    };

    lines.forEach((line) => {
      const raw = line;
      const trimmed = raw.trim();

      if (/^```|^~~~/.test(trimmed)) {
        if (!inCode) {
          flushParagraph();
          closeList();
          html += "<pre><code>";
          inCode = true;
        } else {
          html += "</code></pre>";
          inCode = false;
        }
        return;
      }

      if (inCode) {
        html += `${escapeHtml(raw)}\n`;
        return;
      }

      if (!trimmed) {
        flushParagraph();
        closeList();
        return;
      }

      if (/^#{1,6}\s/.test(trimmed)) {
        flushParagraph();
        closeList();
        const level = Math.min(trimmed.match(/^#+/)[0].length, 3);
        html += `<h${level}>${renderInline(trimmed.replace(/^#{1,6}\s*/, ""))}</h${level}>`;
        return;
      }

      if (trimmed.startsWith("- ")) {
        flushParagraph();
        if (!inList) {
          html += "<ul>";
          inList = true;
        }
        html += `<li>${renderInline(trimmed.slice(2).trim())}</li>`;
        return;
      }

      paragraph.push(trimmed);
    });

    if (inCode) {
      html += "</code></pre>";
    }
    flushParagraph();
    closeList();
    return html || "<p></p>";
  };

  const renderToolDetails = (entry) => {
    const container = document.createElement("div");
    container.className = "tool-entry";

    const header = document.createElement("div");
    header.className = "tool-header";
    const statusLabel = entry.status ? ` (${entry.status})` : "";
    header.innerHTML = `${renderInline(entry.tool)}${statusLabel}`;
    container.appendChild(header);

    if (entry.title) {
      const title = document.createElement("div");
      title.className = "tool-title";
      title.innerHTML = renderInline(entry.title);
      container.appendChild(title);
    }

    if (entry.output) {
      const outputBlock = document.createElement("div");
      outputBlock.className = "tool-output";
      outputBlock.innerHTML = renderMarkdown(entry.output);
      container.appendChild(outputBlock);
    }

    decorateFileReferences(container);
    return container;
  };

  const decorateFileReferences = (container) => {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
    const texts = [];
    let current;
    while ((current = walker.nextNode())) {
      texts.push(current);
    }

    texts.forEach((textNode) => {
      const value = textNode.nodeValue || "";
      if (!value.trim()) return;

      FILE_PATH_REGEX.lastIndex = 0;
      const matches = [...value.matchAll(FILE_PATH_REGEX)];
      if (!matches.length) return;

      const fragment = document.createDocumentFragment();
      let lastIndex = 0;

      matches.forEach((match) => {
        const full = match[1];
        if (match.index > lastIndex) {
          fragment.appendChild(document.createTextNode(value.slice(lastIndex, match.index)));
        }
        fragment.appendChild(document.createTextNode(full));

        const button = document.createElement("button");
        button.className = "file-link";
        button.dataset.path = full;
        button.textContent = `Open ${full.split("/").pop()}`;
        fragment.appendChild(button);

        lastIndex = match.index + full.length;
      });

      if (lastIndex < value.length) {
        fragment.appendChild(document.createTextNode(value.slice(lastIndex)));
      }

      textNode.replaceWith(fragment);
    });
  };

  const renderStatus = () => {
    if (!state.session) {
      statusNode.textContent = "No session attached";
      return;
    }
    statusNode.textContent = `Session ${state.session.sessionID} @ ${state.session.port} · polling ${state.pollInterval}ms`;
  };

  const normalizeNotebookPath = (value) => {
    if (!value || typeof value !== "string") return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const lower = trimmed.toLowerCase();
    if (!NOTEBOOK_EXTENSIONS.some((ext) => lower.endsWith(ext))) return undefined;
    return trimmed;
  };

  const extractNotebookFromOutput = (output) => {
    if (!output) return undefined;
    if (typeof output === "string") {
      const direct = normalizeNotebookPath(output);
      if (direct) return direct;
      try {
        return extractNotebookFromOutput(JSON.parse(output));
      } catch (_) {
        return undefined;
      }
    }
    if (Array.isArray(output)) {
      for (const item of output) {
        const found = extractNotebookFromOutput(item);
        if (found) return found;
      }
      return undefined;
    }
    if (typeof output === "object") {
      const candidates = [output.notebookPath, output.notebook_path, output.path, output.notebook, output.file];
      for (const candidate of candidates) {
        const normalized = normalizeNotebookPath(candidate);
        if (normalized) return normalized;
      }
    }
    return undefined;
  };

  const extractNotebookPath = (part) => {
    if (!part || typeof part !== "object") return undefined;
    if (part.type === "tool" && part.state && part.state.status === "completed") {
      const fromOutput = extractNotebookFromOutput(part.state.output);
      if (fromOutput) return fromOutput;
      if (Array.isArray(part.state.attachments)) {
        for (const attachment of part.state.attachments) {
          const normalized = normalizeNotebookPath(attachment && (attachment.filename || attachment.url));
          if (normalized) return normalized;
        }
      }
    }
    if (part.type === "file") {
      return normalizeNotebookPath(part.filename || part.url);
    }
    return undefined;
  };

  const getSectionState = (messageId) => {
    if (!state.openSections[messageId]) {
      state.openSections[messageId] = { reasoning: false, tools: false };
    }
    return state.openSections[messageId];
  };

  const renderMessages = (items) => {
    const atBottom = messagesNode.scrollHeight - messagesNode.scrollTop <= messagesNode.clientHeight + 8;
    state.messages = Array.isArray(items) ? items : [];
    messagesNode.innerHTML = "";

    state.messages.forEach((item, index) => {
      const messageId = item && item.info && item.info.id ? String(item.info.id) : String(index);
      const sectionState = getSectionState(messageId);

      const wrapper = document.createElement("article");
      const role = item && item.info && typeof item.info.role === "string" ? item.info.role : item.role || "assistant";
      wrapper.className = `msg ${role}`;

      const contentParts = [];
      const thoughts = [];
      const toolStates = [];
      let notebookPath;

      if (Array.isArray(item.parts)) {
        for (const part of item.parts) {
          if (!part || typeof part !== "object") continue;
          if (part.type === "text" && typeof part.text === "string") {
            contentParts.push(part.text);
            if (part.metadata && part.metadata.intent === "analysis" && part.text.trim()) {
              thoughts.push(part.text.trim());
            }
          }
          if (part.type === "reasoning") {
            const raw = typeof part.text === "string" ? part.text.trim() : "";
            let chosen = raw;
            if (!chosen || /^[0w\s]+$/.test(chosen)) {
              const meta = part.metadata || {};
              const summary =
                typeof meta.summary === "string"
                  ? meta.summary
                  : typeof meta.reasoningSummary === "string"
                  ? meta.reasoningSummary
                  : typeof meta.reasoning_summary === "string"
                  ? meta.reasoning_summary
                  : Array.isArray(meta.summary)
                  ? meta.summary.join(" ")
                  : "";
              chosen = summary.trim();
            }
            if (chosen) {
              thoughts.push(chosen);
            }
          }
          if (part.type === "tool") {
            const toolLabel = typeof part.tool === "string" ? part.tool : part.name || "tool";
            const stateInfo = part.state || {};
            toolStates.push({
              tool: toolLabel,
              status: typeof stateInfo.status === "string" ? stateInfo.status : undefined,
              title: typeof stateInfo.title === "string" ? stateInfo.title : undefined,
              output: typeof stateInfo.output === "string" ? stateInfo.output : undefined,
            });
          }
          if (!notebookPath) {
            const detected = extractNotebookPath(part);
            if (detected) notebookPath = detected;
          }
        }
      }

      const messageBlock = document.createElement("div");
      messageBlock.className = "message-content";
      const combinedContent = contentParts.join("\n\n");
      messageBlock.innerHTML = renderMarkdown(combinedContent || "[no content provided]");
      decorateFileReferences(messageBlock);
      wrapper.appendChild(messageBlock);

      if (thoughts.length) {
        const details = document.createElement("details");
        details.className = "thinking";
        details.open = !!sectionState.reasoning;
        const summary = document.createElement("summary");
        summary.textContent = "Assistant reasoning";
        details.appendChild(summary);
        const reasoningBlock = document.createElement("pre");
        reasoningBlock.textContent = thoughts.join("\n\n");
        details.appendChild(reasoningBlock);
        summary.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          const next = !details.open;
          details.open = next;
          sectionState.reasoning = next;
        });
        wrapper.appendChild(details);
      }

      if (toolStates.length) {
        const details = document.createElement("details");
        details.className = "thinking";
        details.open = !!sectionState.tools;
        const summary = document.createElement("summary");
        summary.textContent = "Tool activity";
        details.appendChild(summary);
        const container = document.createElement("div");
        container.className = "tool-list";
        toolStates.forEach((entry) => container.appendChild(renderToolDetails(entry)));
        details.appendChild(container);
        summary.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          const next = !details.open;
          details.open = next;
          sectionState.tools = next;
        });
        wrapper.appendChild(details);
      }

      if (notebookPath) {
        const notebookButton = document.createElement("div");
        notebookButton.style.marginTop = "8px";
        notebookButton.style.paddingTop = "8px";
        notebookButton.style.borderTop = "1px solid var(--vscode-editorGroup-border)";
        notebookButton.innerHTML = `<button style="font-size: 0.9em; padding: 4px 8px;" onclick='openNotebook(${JSON.stringify(
          notebookPath,
        )})'>📓 Open Notebook</button>`;
        wrapper.appendChild(notebookButton);
        if (!state.openedNotebooks.has(notebookPath)) {
          state.openedNotebooks.add(notebookPath);
          openNotebook(notebookPath);
        }
      }

      messagesNode.appendChild(wrapper);
    });

    if (atBottom) {
      messagesNode.scrollTop = messagesNode.scrollHeight;
    }
  };

  const openNotebook = (notebookPath) => {
    vscode.postMessage({ type: "openNotebook", notebookPath });
  };

  const fetchJson = (url) =>
    fetch(url)
      .then((res) => (res.ok ? res.json() : undefined))
      .catch(() => undefined);

  const poll = async () => {
    if (!state.session) return;
    const base = `http://localhost:${state.session.port}`;
    const sessionUrl = `${base}/session/${state.session.sessionID}`;
    const messagesUrl = `${sessionUrl}/message`;
    const [info, msgs] = await Promise.all([fetchJson(sessionUrl), fetchJson(messagesUrl)]);
    if (info && typeof info === "object") {
      renderStatus();
    }
    if (Array.isArray(msgs)) {
      renderMessages(msgs);
    }
  };

  const schedulePoll = () => {
    if (typeof state.timer === "number") {
      window.clearTimeout(state.timer);
    }
    const run = async () => {
      await poll();
      if (!state.session) return;
      state.timer = window.setTimeout(run, state.pollInterval);
    };
    void run();
  };

  const setSession = (payload) => {
    state.session = payload.session;
    state.pollInterval = typeof payload.session?.pollInterval === "number" ? payload.session.pollInterval : defaultPoll;
    renderStatus();
    schedulePoll();
  };

  // Initialize attachment manager
  let attachmentManager = null;
  if (typeof window.AttachmentManager === "function") {
    attachmentManager = new window.AttachmentManager(vscode);
    const initialized = attachmentManager.init();
    if (!initialized) {
      console.warn("[Chat] Attachment manager failed to initialize");
      attachmentManager = null;
    }
  }

  window.addEventListener("message", (event) => {
    const data = event.data;
    if (!data || typeof data !== "object") return;
    if (data.type === "session") {
      setSession(data);
    }
    if (data.type === "availableFiles" && attachmentManager) {
      attachmentManager.handleAvailableFiles(data);
    }
  });

  formNode.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = inputNode.value.trim();
    const files = attachmentManager ? attachmentManager.getSelectedFiles() : [];

    if (!value && files.length === 0) return;

    const message = { type: "send", text: value };
    if (files.length > 0) {
      message.files = files;
    }

    vscode.postMessage(message);
    inputNode.value = "";

    if (attachmentManager) {
      attachmentManager.clearSelection();
    }
  });

  messagesNode.addEventListener("click", (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.classList.contains("file-link")) {
      const targetPath = target.dataset.path;
      if (targetPath) {
        vscode.postMessage({ type: "openFile", path: targetPath });
      }
    }
  });

  renderStatus();
  vscode.postMessage({ type: "ready" });
})();
