import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

type NotebookJSON = {
  cells: Array<Record<string, unknown>>;
  metadata: Record<string, unknown>;
  nbformat: number;
  nbformat_minor: number;
};

type ConnectOptions = {
  host: string;
  port: number;
  token: string;
  rooms: Record<string, string>;
  stage?: string;
};

type ConnectionState = {
  stage: string;
  room: string;
  doc: Y.Doc;
  provider: WebsocketProvider;
  onUpdate: () => void;
};

class NotebookRenderer {
  private readonly root: HTMLElement;
  private readonly header: HTMLElement;
  private readonly status: HTMLElement;
  private readonly body: HTMLElement;

  constructor(container: HTMLElement) {
    container.classList.add("rtc-notebook");
    this.root = container;
    this.header = document.createElement("div");
    this.header.className = "rtc-notebook-header";
    this.status = document.createElement("div");
    this.status.className = "rtc-notebook-status";
    this.body = document.createElement("div");
    this.body.className = "rtc-notebook-body";
    this.root.appendChild(this.header);
    this.root.appendChild(this.status);
    this.root.appendChild(this.body);
  }

  setStage(stage: string) {
    this.header.textContent = `Live Notebook · ${stage}`;
  }

  setStatus(message: string) {
    this.status.textContent = message;
  }

  clear() {
    this.body.innerHTML = "";
  }

  renderPlaceholder(message: string) {
    this.setStatus(message);
    this.body.innerHTML = "";
  }

  render(notebook: NotebookJSON) {
    this.setStatus("Streaming in real time");
    const fragment = document.createDocumentFragment();

    notebook.cells.forEach((cell, index) => {
      const wrapper = document.createElement("article");
      wrapper.className = `rtc-cell rtc-cell-${cell.cell_type || "unknown"}`;

      const heading = document.createElement("header");
      heading.className = "rtc-cell-header";
      const label = cell.cell_type === "code" ? "Code cell" : cell.cell_type === "markdown" ? "Markdown cell" : "Cell";
      heading.textContent = `${label} #${index + 1}`;
      wrapper.appendChild(heading);

      if (cell.cell_type === "markdown") {
        const markdown = document.createElement("div");
        markdown.className = "rtc-cell-body markdown";
        markdown.innerHTML = this.renderMarkdown(Array.isArray(cell.source) ? cell.source.join("") : String(cell.source ?? ""));
        wrapper.appendChild(markdown);
      } else if (cell.cell_type === "code") {
        const source = document.createElement("pre");
        source.className = "rtc-cell-body code";
        source.textContent = Array.isArray(cell.source) ? cell.source.join("") : String(cell.source ?? "");
        wrapper.appendChild(source);

        const outputs = Array.isArray(cell.outputs) ? cell.outputs : [];
        if (outputs.length > 0) {
          const outputWrapper = document.createElement("div");
          outputWrapper.className = "rtc-cell-outputs";
          outputs.forEach((output, idx) => {
            const block = document.createElement("div");
            block.className = `rtc-output rtc-output-${output.output_type || "text"}`;
            block.innerHTML = this.renderOutput(output, idx);
            outputWrapper.appendChild(block);
          });
          wrapper.appendChild(outputWrapper);
        }
      } else {
        const fallback = document.createElement("pre");
        fallback.className = "rtc-cell-body";
        fallback.textContent = JSON.stringify(cell, null, 2);
        wrapper.appendChild(fallback);
      }

      fragment.appendChild(wrapper);
    });

    this.body.innerHTML = "";
    this.body.appendChild(fragment);
  }

  private renderOutput(output: Record<string, any>, index: number) {
    if (!output) {
      return `<p class="rtc-output-empty">Output ${index + 1} (empty)</p>`;
    }
    switch (output.output_type) {
      case "stream": {
        const text = Array.isArray(output.text) ? output.text.join("") : String(output.text ?? "");
        const channel = output.name === "stderr" ? "stderr" : "stdout";
        return `<div class="rtc-output-stream"><strong>${channel}</strong><pre>${this.escape(text)}</pre></div>`;
      }
      case "display_data":
      case "execute_result": {
        const data = output.data ?? {};
        const mime = Object.keys(data)[0];
        if (mime && typeof data[mime] === "string") {
          return `<div class="rtc-output-display"><strong>${mime}</strong><pre>${this.escape(String(data[mime]))}</pre></div>`;
        }
        return `<div class="rtc-output-display"><pre>${this.escape(JSON.stringify(data, null, 2))}</pre></div>`;
      }
      case "error": {
        const traceback = Array.isArray(output.traceback) ? output.traceback.join("\n") : String(output.traceback ?? "");
        return `<div class="rtc-output-error"><strong>${this.escape(output.ename ?? "Error")}</strong><pre>${this.escape(traceback)}</pre></div>`;
      }
      default:
        return `<div class="rtc-output-raw"><pre>${this.escape(JSON.stringify(output, null, 2))}</pre></div>`;
    }
  }

  private renderMarkdown(value: string) {
    if (!value) {
      return "<p></p>";
    }
    const escaped = this.escape(value);
    return escaped
      .replace(/^###### (.*)$/gm, "<h6>$1</h6>")
      .replace(/^##### (.*)$/gm, "<h5>$1</h5>")
      .replace(/^#### (.*)$/gm, "<h4>$1</h4>")
      .replace(/^### (.*)$/gm, "<h3>$1</h3>")
      .replace(/^## (.*)$/gm, "<h2>$1</h2>")
      .replace(/^# (.*)$/gm, "<h1>$1</h1>")
      .replace(/```([\s\S]*?)```/gm, "<pre><code>$1</code></pre>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\n{2,}/g, "</p><p>")
      .replace(/\n/g, "<br />")
      .replace(/^>(.*)$/gm, "<blockquote>$1</blockquote>");
  }

  private escape(input: string) {
    return input
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
}

class RtcNotebookClient {
  private container?: HTMLElement;
  private renderer?: NotebookRenderer;
  private connection?: ConnectionState;

  init(params: { container: HTMLElement }) {
    this.container = params.container;
    this.renderer = new NotebookRenderer(params.container);
    this.renderer.renderPlaceholder("Waiting for notebook activity…");
  }

  connect(options: ConnectOptions) {
    if (!this.container || !this.renderer) {
      return;
    }
    const stages = Object.keys(options.rooms || {});
    if (!stages.length) {
      this.renderer.renderPlaceholder("No notebook rooms available.");
      return;
    }

    const stage = this.pickStage(options.stage, stages);
    const room = options.rooms[stage];
    if (!room) {
      this.renderer.renderPlaceholder("Notebook room not found.");
      return;
    }

    if (this.connection && this.connection.stage === stage && this.connection.room === room) {
      return;
    }

    this.disconnect();

    const baseUrl = options.host.startsWith("ws") ? options.host : `ws://${options.host}:${options.port}`;
    const doc = new Y.Doc();
    const provider = new WebsocketProvider(baseUrl, room, doc, {
      params: { token: options.token, stage },
      disableBc: true,
    });

    this.renderer.setStage(stage);
    this.renderer.renderPlaceholder("Connecting…");

    const update = () => {
      try {
        const notebook = this.toNotebook(doc);
        this.renderer?.render(notebook);
      } catch (error) {
        console.error("[rtc-notebook] Failed to render notebook", error);
      }
    };

    provider.on("status", (event: { status: string }) => {
      if (event.status === "connected") {
        this.renderer?.setStatus("Connected");
      } else {
        this.renderer?.setStatus("Reconnecting…");
      }
    });

    doc.on("update", update);
    provider.once("synced", update);

    this.connection = { stage, room, doc, provider, onUpdate: update };
  }

  disconnect() {
    if (!this.connection) {
      return;
    }
    try {
      this.connection.doc.off("update", this.connection.onUpdate);
      this.connection.provider.destroy();
      this.connection.doc.destroy();
    } catch (error) {
      console.warn("[rtc-notebook] Failed to dispose connection", error);
    }
    this.connection = undefined;
    if (this.renderer) {
      this.renderer.renderPlaceholder("Disconnected.");
    }
  }

  private pickStage(preferred: string | undefined, stages: string[]) {
    if (preferred && stages.includes(preferred)) {
      return preferred;
    }
    if (stages.includes("analysis")) {
      return "analysis";
    }
    return stages[0];
  }

  private toNotebook(doc: Y.Doc): NotebookJSON {
    const meta = doc.getMap("meta");
    const cellsArray = doc.getArray("cells");
    const metadataValue = meta.get("metadata") as any;
    const metadata =
      metadataValue && typeof metadataValue.toJSON === "function" ? metadataValue.toJSON() : (metadataValue ?? {});
    const cells = cellsArray
      .toArray()
      .map((cell: any) => (cell && typeof cell.toJSON === "function" ? cell.toJSON() : {}));
    const nbformatRaw = meta.get("nbformat");
    const nbminorRaw = meta.get("nbformat_minor");
    return {
      cells,
      metadata,
      nbformat: typeof nbformatRaw === "number" ? nbformatRaw : 4,
      nbformat_minor: typeof nbminorRaw === "number" ? nbminorRaw : 5,
    };
  }
}

declare global {
  interface Window {
    RtcNotebookClient?: RtcNotebookClient;
  }
}

const client = new RtcNotebookClient();
if (typeof window !== "undefined") {
  window.RtcNotebookClient = client;
}

export {};
