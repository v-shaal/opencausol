# Causal Workflow Chat Extension – OpenCode Integration Plan

## Goals
- Add a VS Code chat extension specialized for causal workflows that talks to the forked OpenCode server (causal‑tuned).
- Orchestrate a supervisor agent that delegates to stage subagents with scoped tools.
- Leverage OpenCode sessions, MCP tooling, and event bus for state, tools, and UI updates.

## Architecture Fit With OpenCode
- Sessions & Bus
  - Use `packages/opencode/src/session/index.ts` for session lifecycle and `Bus` events to notify UI after stage completions and validations.
- MCP Client
  - Reuse `packages/opencode/src/mcp/index.ts` to register causal MCP servers (knowledge, graph math, jupyter, SDK bridge). Prefer stdio for local Python tools, HTTP/SSE for knowledge.
- Agent Prompts
  - Place system prompts in `packages/opencode/src/agent/causal/` and introduce a "causal" session preset that acts as the supervisor orchestrator.
- State & Artifacts
  - Persist stage outputs under session directory (JSON/DOT/MD/PNG). Expose artifacts to VS Code via Bus updates and a panel browser.

## Agent Topology
- Supervisor (Causal Orchestrator)
  - Plans stages, calls subagents, enforces stage gates, summarizes progress, re‑plans on validation failures.
- Stage Subagents
  - Framing, EDA, DAG, Identification, Estimation, Sensitivity, Reporting — each with explicit tool scopes and validation responsibilities.
- Cross‑Cutting Agents
  - Data (loading/schema), Jupyter (kernel/cell exec), SDK Bridge (DoWhy/EconML wrappers), Knowledge (MCP RAG), Compliance (PII/telemetry).

## Tool Inventory (MCP‑First, Scoped Access)
- Data
  - `DatasetProfile`, `BalanceCheck`, `OverlapCheck`.
- DAG
  - `DAGLoad`/`DAGSave` (DOT/JSON), `DSep`, `AdjustmentSets`.
- Identification
  - `IDQuery` (do‑calculus/identifiability), `IVValidity` (relevance/exclusion heuristics).
- Estimation (SDK‑bridged)
  - `PS/IPW/DR/TMLE`, `IV2SLS/2SRI`, `DiD/RD`, `CATE` learners; standardized IO (ATE/ATT/CIs, diagnostics, artifacts).
- Sensitivity
  - `EValue`, `RosenbaumBounds`, `PartialR2/U`, `IVWeak/Overid`.
- Jupyter
  - `KernelEnsure`, `CellRun`, `ArtifactStore` (writes under session path).
- Reporting
  - `ReportAssemble` (markdown), `ExportPDF` (Pandoc), `BundleExport`.
- Governance
  - `PIIScan`, `TelemetryWrite` (opt‑in).

## VS Code Integration
- Commands
  - Causal: Open Chat, Open Panel, Run Stage, Select Dataset, Open Notebook, Export Report.
- Chat & Panel
  - Chat routes to the running OpenCode session (same port handshake as `sdks/vscode/src/extension.ts`). Panel shows stage tracker, logs, DAG editor webview, artifacts.
- Routing
  - Messages → Supervisor session; tool invocations stream parts/artifacts; use Bus updates to refresh panel widgets.

### Usage Notes (MVP)
- Select the `causal-supervisor` agent in the agent list; it is marked as `primary`.
- The supervisor will use the Task tool to launch:
  - `causal-eda`, `causal-dag`, `causal-id`, `causal-est`, `causal-sens`, `causal-report`.
- Ensure MCP services are running or reachable per `opencode.json`:
  - `causal-docs` at `http://localhost:8801`
  - `graph-math` at `http://localhost:8802`
  - `jupyter-runner` and `causal-sdk` local stdio Python modules
- To test locally: run `bun dev` in `packages/opencode` and open the VS Code extension pointing to the same port.

## Jupyter + SDK Execution
- Start a local stdio MCP server for Python (`jupyter-runner`) to manage kernels and run cells.
- Wrap DoWhy/EconML in a `causal-sdk` MCP server that validates inputs, pins versions, executes, and returns normalized results/artifacts.

## DAG Editor Integration
- VS Code webview using `dagre-d3` for render/edit.
- Live checks via `DSep`/`AdjustmentSets`; import/export to session as DOT/JSON; feeds Identification stage.

## Supervisor Flow & Stage Gates
- Sequence: Framing → EDA → DAG ↔ Identification → Estimation → Sensitivity → Reporting.
- Each stage returns `ValidationResult`; on failure the supervisor proposes alternatives, requests clarifications, or loops back.
- All decisions include rationale and citations (via Knowledge MCP).

## Minimal File/Module Additions
- Prompts
  - `packages/opencode/src/agent/causal/supervisor.txt`
  - `packages/opencode/src/agent/causal/{framing,eda,dag,id,est,sens,report}.txt`
- Session Preset
  - `packages/opencode/src/session/causal.ts` registering a "causal" mode and stage map; wire into `Session.create()`.
- MCP Config
  - `opencode.json` entries for: `causal-docs` (RAG), `graph-math` (d‑sep/ID), `jupyter-runner` (stdio), `causal-sdk` (stdio).
- VS Code Extension
  - Extend `sdks/vscode/src/extension.ts` with commands and panel; add webview bundles under `sdks/vscode/src/panel` and `sdks/vscode/src/chat`.
- Optional Helper
  - `packages/opencode/src/tool/causal-artifacts.ts` to standardize artifact paths and publish Bus updates.

Note: As a light‑weight first step, we define agents in `.opencode/agent/*.md` so the Task tool can launch subagents immediately without touching TS. We can later promote prompts to `packages/opencode/src/agent/causal/*` and add a formal session preset when we wire deeper orchestration.

## Milestones (MVP → v1)
- M1: Supervisor + causal session preset; VS Code panel skeleton; EDA + DAG edit/render + import/export; MCP registration stubs.
- M2: Identification tools (backdoor/front‑door/ID queries) + Knowledge MCP integration.
- M3: Estimation (DR + IV first) via Jupyter/SDK bridge; diagnostics and artifact persistence.
- M4: Sensitivity (E‑value/Rosenbaum/PartialR2) + Reporting (Markdown, optional PDF) + export bundle.

## Assumptions & Open Questions
- SDKs (MVP): DoWhy + EconML; add CausalML/PyWhy later.
- Environments: Prefer `uv` or conda; VS Code Jupyter extension available.
- Data sources: File‑based MVP; DB connectors later.
- Reporting: Markdown for v1; PDF optional via Pandoc.
- Provide MCP endpoints/corpora for knowledge servers; confirm governance/telemetry requirements.

## Rigor & Safety Guardrails
- Require estimand specification; verify positivity/overlap; avoid collider conditioning.
- Justify adjustment sets and methods; include diagnostics; mandate sensitivity for observational designs.
- Reproducibility: seeded runs, version capture, executable cells, session artifact bundle.

## Risks & Mitigations
- Tool reliability → Prefer stdio MCP for local exec; retries and timeouts; clear error surfacing via `Session.Event.Error`.
- Env drift → Version pinning, `KernelEnsure`, cached wheels, fallback estimators.
- Latency → Streamed outputs, parallelizable checks, staged UI updates.
