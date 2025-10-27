/**
 * Attachment Handler Module
 * Handles file selection, display, and attachment management for the chat interface
 */

(function () {
  "use strict";

  // File type icon mapping
  const FILE_ICONS = {
    ipynb: "📓",
    py: "🐍",
    js: "📜",
    ts: "📘",
    tsx: "📘",
    jsx: "📜",
    json: "📋",
    md: "📝",
    csv: "📊",
    txt: "📄",
    html: "🌐",
    css: "🎨",
    png: "🖼️",
    jpg: "🖼️",
    jpeg: "🖼️",
    gif: "🖼️",
    svg: "🎨",
    pdf: "📕",
    zip: "📦",
    tar: "📦",
    gz: "📦",
  };

  // Source display names
  const SOURCE_NAMES = {
    tabs: "Active Tabs",
    files: "Files & Folders",
    mentions: "Code",
    browser: "Browser",
  };

  /**
   * AttachmentManager class
   */
  class AttachmentManager {
    constructor(vscodeApi) {
      this.vscode = vscodeApi;
      this.state = {
        isOpen: false,
        activeSource: "tabs",
        selectedFiles: new Set(),
        availableSources: {
          tabs: [],
          files: [],
          mentions: [],
          browser: [],
        },
        loading: false,
        error: null,
      };

      // DOM elements (will be set during initialization)
      this.elements = {
        attachBtn: null,
        attachmentBar: null,
        attachmentList: null,
        selectedFiles: null,
        tabBtns: [],
      };

      // Bind methods
      this.init = this.init.bind(this);
      this.toggleAttachmentBar = this.toggleAttachmentBar.bind(this);
      this.switchSource = this.switchSource.bind(this);
      this.toggleFileSelection = this.toggleFileSelection.bind(this);
      this.removeFile = this.removeFile.bind(this);
      this.getSelectedFiles = this.getSelectedFiles.bind(this);
      this.clearSelection = this.clearSelection.bind(this);
      this.handleAvailableFiles = this.handleAvailableFiles.bind(this);
    }

    /**
     * Initialize the attachment manager
     */
    init() {
      // Get DOM elements
      this.elements.attachBtn = document.getElementById("attachBtn");
      this.elements.attachmentBar = document.getElementById("attachmentBar");
      this.elements.attachmentList = document.getElementById("attachmentList");
      this.elements.selectedFiles = document.getElementById("selectedFiles");

      if (!this.elements.attachBtn || !this.elements.attachmentBar) {
        console.warn("[AttachmentManager] Required DOM elements not found");
        return false;
      }

      // Set up event listeners
      this.elements.attachBtn.addEventListener("click", this.toggleAttachmentBar);

      // Set up tab buttons
      this.elements.tabBtns = Array.from(
        this.elements.attachmentBar.querySelectorAll(".tab-btn")
      );

      this.elements.tabBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
          const source = btn.dataset.source;
          if (source) {
            this.switchSource(source);
          }
        });
      });

      console.log("[AttachmentManager] Initialized successfully");
      return true;
    }

    /**
     * Toggle attachment bar visibility
     */
    toggleAttachmentBar() {
      this.state.isOpen = !this.state.isOpen;

      if (this.state.isOpen) {
        this.elements.attachmentBar.classList.add("active");
        this.elements.attachBtn.classList.add("active");
        this.requestAvailableFiles();
      } else {
        this.elements.attachmentBar.classList.remove("active");
        this.elements.attachBtn.classList.remove("active");
      }
    }

    /**
     * Request available files from VS Code extension
     */
    requestAvailableFiles() {
      this.state.loading = true;
      this.state.error = null;
      this.renderLoading();

      this.vscode.postMessage({
        type: "getAvailableFiles",
        sources: ["tabs", "files"],
      });
    }

    /**
     * Handle available files response from extension
     */
    handleAvailableFiles(data) {
      this.state.loading = false;

      if (data.error) {
        this.state.error = data.error;
        this.renderError(data.error);
        return;
      }

      if (data.sources) {
        this.state.availableSources = {
          tabs: data.sources.tabs || [],
          files: data.sources.files || [],
          mentions: data.sources.mentions || [],
          browser: data.sources.browser || [],
        };
      }

      this.renderAttachmentList();
    }

    /**
     * Switch active source tab
     */
    switchSource(source) {
      this.state.activeSource = source;

      // Update tab button states
      this.elements.tabBtns.forEach((btn) => {
        if (btn.dataset.source === source) {
          btn.classList.add("active");
        } else {
          btn.classList.remove("active");
        }
      });

      this.renderAttachmentList();
    }

    /**
     * Render loading state
     */
    renderLoading() {
      if (!this.elements.attachmentList) return;

      this.elements.attachmentList.innerHTML = `
        <div class="attachment-loading">Loading files...</div>
      `;
    }

    /**
     * Render error state
     */
    renderError(message) {
      if (!this.elements.attachmentList) return;

      this.elements.attachmentList.innerHTML = `
        <div class="attachment-error">${this.escapeHtml(message)}</div>
      `;
    }

    /**
     * Render attachment list for current source
     */
    renderAttachmentList() {
      if (!this.elements.attachmentList) return;

      const items = this.state.availableSources[this.state.activeSource] || [];

      this.elements.attachmentList.innerHTML = "";

      if (items.length === 0) {
        this.elements.attachmentList.classList.add("empty");
        return;
      }

      this.elements.attachmentList.classList.remove("empty");

      items.forEach((item) => {
        const div = document.createElement("div");
        div.className = "attachment-item";

        if (this.state.selectedFiles.has(item.path)) {
          div.classList.add("selected");
        }

        const icon = this.getFileIcon(item.path);
        const displayPath = item.relativePath || item.path;

        div.innerHTML = `
          <span class="attachment-icon">${icon}</span>
          <span class="attachment-path" title="${this.escapeHtml(item.path)}">${this.escapeHtml(
          displayPath
        )}</span>
        `;

        div.addEventListener("click", () => this.toggleFileSelection(item));

        this.elements.attachmentList.appendChild(div);
      });
    }

    /**
     * Toggle file selection
     */
    toggleFileSelection(file) {
      if (this.state.selectedFiles.has(file.path)) {
        this.state.selectedFiles.delete(file.path);
      } else {
        this.state.selectedFiles.add(file.path);
      }

      this.renderAttachmentList();
      this.renderSelectedFiles();
    }

    /**
     * Remove file from selection
     */
    removeFile(filePath) {
      this.state.selectedFiles.delete(filePath);
      this.renderAttachmentList();
      this.renderSelectedFiles();
    }

    /**
     * Render selected files as chips
     */
    renderSelectedFiles() {
      if (!this.elements.selectedFiles) return;

      this.elements.selectedFiles.innerHTML = "";

      if (this.state.selectedFiles.size === 0) {
        return;
      }

      this.state.selectedFiles.forEach((filePath) => {
        const chip = document.createElement("div");
        chip.className = "selected-file-chip";

        const fileName = filePath.split("/").pop() || filePath;
        const icon = this.getFileIcon(filePath);

        chip.innerHTML = `
          ${icon}
          <span class="file-name" title="${this.escapeHtml(filePath)}">${this.escapeHtml(
          fileName
        )}</span>
          <button type="button" class="remove-file-btn" aria-label="Remove file">×</button>
        `;

        const removeBtn = chip.querySelector(".remove-file-btn");
        if (removeBtn) {
          removeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            this.removeFile(filePath);
          });
        }

        this.elements.selectedFiles.appendChild(chip);
      });
    }

    /**
     * Get selected files as array
     */
    getSelectedFiles() {
      return Array.from(this.state.selectedFiles);
    }

    /**
     * Clear all selected files
     */
    clearSelection() {
      this.state.selectedFiles.clear();
      this.renderSelectedFiles();
      this.renderAttachmentList();

      // Close attachment bar
      if (this.state.isOpen) {
        this.state.isOpen = false;
        this.elements.attachmentBar.classList.remove("active");
        this.elements.attachBtn.classList.remove("active");
      }
    }

    /**
     * Get file icon based on extension
     */
    getFileIcon(path) {
      if (!path) return "📄";

      const ext = path.split(".").pop()?.toLowerCase();
      return FILE_ICONS[ext || ""] || "📄";
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
      const div = document.createElement("div");
      div.textContent = text;
      return div.innerHTML;
    }
  }

  // Export to global scope
  window.AttachmentManager = AttachmentManager;
})();
