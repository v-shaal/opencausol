# 🧠 ULTRATHINK Analysis: Causal Inference Assistant

**Date:** October 24, 2025
**Author:** Claude (Sonnet 4.5)
**Status:** Implementation Plan - Ready for Development

---

## 📊 Architecture Understanding

### ✅ What Exists

#### 1. **OpenCode Core** (`packages/opencode/`)
- **Session management** w/ Bus event system
- **MCP client infrastructure** (remote HTTP/SSE + local stdio)
- **Agent framework** (markdown-based definitions in `.opencode/agent/`)
- **Tool system**, file operations, LSP integration

#### 2. **Agent Definitions** (`.opencode/agent/`)
- ✅ **7 agents already defined**: supervisor, eda, dag, id, est, sens, report
- **Mode**: `primary` (supervisor) vs `subagent` (stage-specific)
- **Tool access** scoped per agent
- **Designed for** Task tool delegation

#### 3. **MCP Configuration** (`opencode.json`)
- **4 MCP servers configured** (2 remote HTTP, 2 local Python)
  - `causal-docs` (port 8801) - RAG knowledge base
  - `graph-math` (port 8802) - d-separation, adjustment sets
  - `jupyter-runner` (local Python) - kernel management
  - `causal-sdk` (local Python) - DoWhy/EconML wrappers

#### 4. **VS Code Extension** (`sdks/vscode/`)
- ⚠️ **Minimal**: Terminal integration only
- **Connects** to OpenCode server via HTTP port handshake
- **Missing**: No chat panel, no workflow UI, no DAG editor

---

### ❌ What's Missing

#### 1. **VS Code Extension UI**
- Chat panel webview
- Workflow stage tracker
- DAG editor (dagre-d3 integration)
- Artifact browser
- Settings panel

#### 2. **Python MCP Servers**
- `jupyter-runner` Python module not implemented
- `causal-sdk` Python module not implemented
- `causal-docs` RAG server not implemented
- `graph-math` service not implemented

#### 3. **OpenCode Integration**
- No "causal" session preset in `packages/opencode/src/session/`
- No causal-specific prompt library (could use existing `.opencode/agent/*.md`)
- No artifact management helpers

#### 4. **Jupyter Integration**
- No Jupyter kernel connection logic
- No cell execution infrastructure
- No output parsing/artifact storage

---

## 🎯 Architecture Alignment: OpenCode vs Mastra

### ✅ Decision: OpenCode (Correct Choice)

**Rationale from Integration Doc:**
- Leverage existing **Session + Bus** for state/events
- Reuse **MCP Client** for tool integration
- Use **Task tool** for supervisor → subagent delegation
- Markdown agent definitions (`.opencode/agent/`) for rapid iteration
- Event-driven UI updates via Bus

**Why NOT Mastra:**
- Mastra = agent wrapper framework (similar to LangChain agents)
- OpenCode already has agent orchestration via Task tool
- Mastra would add unnecessary abstraction layer
- OpenCode's session/MCP architecture is more flexible
- Markdown-based agents > code-based for iteration speed

**Trade-offs:**
- ✅ Faster iteration (edit markdown vs rebuild TS)
- ✅ Native MCP integration
- ✅ Session persistence built-in
- ❌ Less structured than Mastra's typed agent system
- ❌ Need to implement Python MCP servers (not just config)

---

## 🔍 Critical Questions & Decisions

### 1. **MVP Scope**
**Decision:** Chat + Workflow Tracker only (2-3 weeks)

### 2. **Python MCP Servers**
**Decision:** Implement 3 servers for M1:
- ✅ `jupyter-runner` (kernel management) - HIGH PRIORITY
- ✅ `graph-math` (DAG operations) - HIGH PRIORITY
- ✅ `causal-docs` (RAG knowledge) - HIGH PRIORITY
- ⏸️ `causal-sdk` (defer - use direct DoWhy calls initially)

### 3. **DAG Editor**
**Decision:** JSON editor only for MVP

### 4. **Technology Stack**
**Decision:**
- Use existing OpenCode patterns
- React for webviews
- Add new dependencies as needed (networkx, pgmpy, etc.)

---

## 📦 Deliverables (MVP - M1)

### ✅ **VS Code Extension**
- Chat panel (React webview)
- Workflow stage tracker
- JSON DAG editor
- Basic artifacts display

### ✅ **Python MCP Servers**
- `jupyter-runner` - Jupyter kernel management
- `graph-math` - DAG operations (networkx/pgmpy)
- `causal-docs` - RAG knowledge base

### ✅ **Workflow Integration**
- Supervisor → subagent orchestration
- Session artifacts + Bus events
- Stage validation gates

### **Deferred to M2**
- Visual DAG editor (dagre-d3)
- `causal-sdk` MCP server (use direct DoWhy calls for now)
- Advanced reporting (PDF generation)
- Multi-user collaboration

---

## 📂 Project Structure (New Components)

```
opencausol/
├── packages/
│   ├── opencode/
│   │   └── src/
│   │       └── tool/
│   │           └── causal-artifacts.ts      # NEW: Artifact helpers
│   │
│   └── python/                               # NEW: Python package
│       └── opencode_causal/
│           ├── __init__.py
│           ├── pyproject.toml
│           ├── jupyter_runner/
│           │   ├── __init__.py
│           │   ├── server.py                # MCP server
│           │   └── kernel.py                # Kernel management
│           ├── graph_math/
│           │   ├── __init__.py
│           │   ├── server.py                # MCP server
│           │   └── dag_ops.py               # NetworkX DAG operations
│           └── causal_docs/
│               ├── __init__.py
│               ├── server.py                # MCP server
│               ├── rag.py                   # RAG engine
│               └── embeddings.py            # Vector storage
│
└── sdks/vscode/
    ├── package.json                         # Updated dependencies
    ├── src/
    │   ├── extension.ts                     # Enhanced with chat commands
    │   ├── chat/
    │   │   ├── ChatPanelProvider.ts         # NEW: Chat webview provider
    │   │   ├── WorkflowTracker.tsx          # NEW: React component
    │   │   └── chat.html                    # NEW: Webview HTML
    │   ├── dag/
    │   │   ├── DagEditorProvider.ts         # NEW: JSON editor
    │   │   └── dag-editor.html              # NEW: Editor UI
    │   ├── api/
    │   │   └── opencodeClient.ts            # NEW: HTTP client
    │   └── types/
    │       ├── messages.ts                  # NEW: Message types
    │       └── workflow.ts                  # NEW: Workflow types
    │
    └── webview-ui/                          # NEW: React app
        ├── package.json
        ├── tsconfig.json
        ├── vite.config.ts
        └── src/
            ├── App.tsx
            ├── components/
            │   ├── Chat.tsx
            │   ├── WorkflowStages.tsx
            │   ├── MessageList.tsx
            │   └── DagEditor.tsx
            └── utils/
                └── vscodeApi.ts
```

---

## 🗓️ Implementation Timeline (3 Weeks)

### **Week 1: Python MCP Servers**

#### Day 1-2: Setup + `jupyter-runner`

**Create Python package structure:**
```bash
packages/python/opencode_causal/
├── pyproject.toml            # Poetry/uv config
├── jupyter_runner/
│   ├── server.py             # MCP stdio server
│   └── kernel.py             # jupyter_client wrapper
```

**Tools to implement:**
- `kernel_ensure(python_version)` → Start/reuse kernel
- `cell_run(code, timeout)` → Execute + capture outputs
- `artifact_store(name, data)` → Save to session dir
- `get_variable(name)` → Retrieve from kernel

**Dependencies:** `jupyter-client`, `ipykernel`, `@modelcontextprotocol/sdk`

---

#### Day 3-4: `graph-math`

**Create (MCP over HTTP/SSE):**
```python
graph_math/
├── server.py                 # MCP HTTP/SSE server (port 8802)
└── dag_ops.py                # NetworkX/pgmpy operations
```

**Tools to implement (MCP tools):**
- `dag_load(path)` → Parse DOT/JSON to NetworkX
- `dag_save(dag, path)` → Export to DOT/JSON
- `d_separation(dag, X, Y, Z)` → Check d-separation
- `adjustment_sets(dag, treatment, outcome)` → Backdoor sets
- `validate_dag(dag)` → Acyclic, temporal check

**Dependencies:** `networkx`, `pgmpy`, `pydot`, `@modelcontextprotocol/sdk` (Python) for MCP HTTP/SSE

---

#### Day 5-7: `causal-docs` RAG

**Create:**
```python
causal_docs/
├── server.py                 # MCP HTTP server (port 8801)
├── rag.py                    # Query engine
├── embeddings.py             # Vector store
└── data/
    ├── corpus/               # Causal inference papers/docs
    └── index.faiss           # FAISS index
```

**Tools to implement (MCP tools):**
- `query(question, context)` → Retrieve relevant docs + LLM synthesis
- `get_confounders(treatment, outcome, domain)` → Domain-specific variables
- `cite(method)` → Return references for causal methods

**Approach:**
- Use LangChain/LlamaIndex for RAG pipeline
- Embed corpus: Pearl textbook, DoWhy docs, key papers (Hernan & Robins, Imbens & Rubin)
- FAISS for vector storage
- Anthropic/OpenAI for synthesis

**Dependencies:** `langchain`, `faiss-cpu`, `sentence-transformers`, `anthropic`

---

### **Week 2: VS Code Extension - Chat & Workflow**

#### Day 1-2: Webview Setup

**Initialize React app for webviews:**
```bash
cd sdks/vscode/webview-ui
npm create vite@latest . -- --template react-ts
npm install @vscode/webview-ui-toolkit
```

**Create:**
- `webview-ui/src/App.tsx` → Root component
- `webview-ui/vite.config.ts` → Build config for VS Code
- Build script in `package.json` → `vite build --watch`

---

#### Day 3-4: Chat Panel

**TypeScript Provider:**
```typescript
// src/chat/ChatPanelProvider.ts
export class ChatPanelProvider implements vscode.WebviewViewProvider {
  async resolveWebviewView(webviewView: vscode.WebviewView) {
    // Load React app
    // Setup message passing: webview <-> extension
    // Connect to OpenCode session via HTTP
  }
}
```

**React Component:**
```typescript
// webview-ui/src/components/Chat.tsx
export function Chat() {
  const [messages, setMessages] = useState<Message[]>([])
  const sendMessage = (text: string) => {
    vscode.postMessage({ type: 'send', text })
  }
  // Render message list + input
}
```

**Features:**
- Send user message → POST to `http://localhost:{port}/session/{id}/message`
- Responses are returned as JSON when complete (no SSE bus endpoint yet)
- Display assistant messages with markdown rendering
- Show agent activity via periodic polling of session/messages

---

#### Day 5-7: Workflow Tracker

**React Component:**
```typescript
// webview-ui/src/components/WorkflowStages.tsx
const stages = ['Framing', 'EDA', 'DAG', 'Identification', 'Estimation', 'Sensitivity', 'Reporting']

export function WorkflowStages() {
  const [currentStage, setCurrentStage] = useState<Stage>()
  const [stageStates, setStageStates] = useState<StageState[]>([])

  useEffect(() => {
    // Poll session + messages until SSE is available
    let timer: any
    const poll = async () => {
      try {
        const res = await fetch(`http://localhost:${port}/session/${sessionID}`)
        const info = await res.json()
        // Update stage states
      } finally {
        timer = setTimeout(poll, 1200)
      }
    }
    poll()
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="workflow">
      {stages.map(stage => (
        <StageCard
          name={stage}
          status={stageStates[stage]?.status}
          onClick={() => viewStageDetails(stage)}
        />
      ))}
    </div>
  )
}
```

**Features:**
- Visual progress bar: ✅ → 🔄 → ⏸️ → ❌
- Click stage → view artifacts (JSON, plots)
- Re-run failed stages
- Poll session APIs for updates (add SSE later if needed)

---

### **Week 3: Integration & Polish**

#### Day 1-2: DAG JSON Editor

**Custom Editor Provider:**
```typescript
// src/dag/DagEditorProvider.ts
export class DagEditorProvider implements vscode.CustomTextEditorProvider {
  async resolveCustomTextEditor(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel) {
    // Load JSON editor webview
    // Parse/validate DAG JSON
    // Save on edit
  }
}
```

**React Component:**
```typescript
// webview-ui/src/components/DagEditor.tsx
export function DagEditor() {
  const [dag, setDag] = useState<DAG>()
  const [errors, setErrors] = useState<string[]>([])

  const validateDag = async (dagJson: string) => {
    // POST to graph-math MCP for validation
    const result = await fetch('http://localhost:8802/validate', {
      method: 'POST',
      body: dagJson
    })
    return result.json()
  }

  return (
    <div>
      <CodeMirror
        value={JSON.stringify(dag, null, 2)}
        onChange={handleChange}
        extensions={[json()]}
      />
      <ValidationErrors errors={errors} />
    </div>
  )
}
```

**Features:**
- JSON syntax highlighting (CodeMirror)
- Validate via `graph-math` MCP by invoking its tools
- Show errors inline
- Export to DOT format

---

#### Day 3-4: Artifacts & Session Management

**TypeScript Helper:**
```typescript
// packages/opencode/src/tool/causal-artifacts.ts
export namespace CausalArtifacts {
  export function getSessionDir(sessionID: string): string {
    return path.join(Storage.dir(), 'sessions', sessionID, 'causal')
  }

  export async function saveArtifact(
    sessionID: string,
    stage: string,
    name: string,
    data: any
  ) {
    const dir = path.join(getSessionDir(sessionID), stage)
    await fs.mkdir(dir, { recursive: true })
    const filepath = path.join(dir, name)
    await fs.writeFile(filepath, JSON.stringify(data, null, 2))

    // Publish Bus event
    Bus.publish(Session.Event.Updated, {
      info: {
        /* include artifact path */
      }
    })
  }
}
```

**Usage in agents:**
- EDA agent → `CausalArtifacts.saveArtifact(sessionID, 'eda', 'profile.json', data)`
- Supervisor → collect artifacts → show in UI

---

#### Day 5: Testing & Bug Fixes

**Integration Tests:**
1. Start OpenCode server: `bun run packages/opencode/src/index.ts`
2. Start MCP servers:
   - `python -m opencode_causal.jupyter_runner`
   - `python -m opencode_causal.graph_math`
   - `python -m opencode_causal.causal_docs`
3. Open VS Code extension
4. Test workflow (M1 scope):
   - User: "Analyze effect of X on Y"
   - Supervisor → EDA → DAG → ID
   - Verify artifacts appear in panel
   - Check stage tracker updates

**Manual QA:**
- Error handling (MCP server down, kernel crash)
- Session persistence (reload VS Code)
- Multiple concurrent sessions

---

#### Day 6-7: Documentation

**Create:**
- `docs/development-guide.md` → How to run/develop
- `docs/mcp-servers.md` → MCP API documentation
- `sdks/vscode/README.md` → Extension usage
- `packages/python/README.md` → Python setup

**Update:**
- `opencode.json` → Add comments for MCP config
- `.opencode/agent/*.md` → Document expected inputs/outputs

---

## 🔧 Technical Implementation Details

### **1. OpenCode Session Integration**

```typescript
// Enhanced extension.ts
export async function activate(context: vscode.ExtensionContext) {
  // Existing terminal command
  context.subscriptions.push(
    vscode.commands.registerCommand('opencode.openTerminal', openTerminal)
  )

  // NEW: Chat panel
  const chatProvider = new ChatPanelProvider(context.extensionUri)
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('opencode.chatView', chatProvider)
  )

  // NEW: Start causal workflow
  context.subscriptions.push(
    vscode.commands.registerCommand('opencode.causal.start', async () => {
      const port = await startOpencodeServer()
      const sessionID = await createCausalSession(port)
      chatProvider.setSession(port, sessionID)
    })
  )
}

async function createCausalSession(port: number): Promise<string> {
  // Create session (server returns Session.Info with 'id')
  const res = await fetch(`http://localhost:${port}/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Causal Workflow' })
  })
  const info = await res.json() as { id: string }

  // Kick off supervisor by sending first message with agent set
  await fetch(`http://localhost:${port}/session/${info.id}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agent: 'causal-supervisor',
      parts: [{ type: 'text', text: 'Initialize causal workflow (framing → EDA → DAG → ID).' }]
    })
  })

  return info.id
}
```

---

### **2. MCP Server Architecture**

```python
# packages/python/opencode_causal/jupyter_runner/server.py
from mcp.server import MCPServer, Tool
from jupyter_client import KernelManager

class JupyterRunnerServer(MCPServer):
    def __init__(self):
        super().__init__("jupyter-runner")
        self.kernels: dict[str, KernelManager] = {}

    @tool("kernel_ensure")
    async def kernel_ensure(self, kernel_id: str = "default", python_version: str = "3.11"):
        if kernel_id not in self.kernels:
            km = KernelManager(kernel_name=f"python{python_version}")
            km.start_kernel()
            self.kernels[kernel_id] = km
        return {"kernel_id": kernel_id, "status": "ready"}

    @tool("cell_run")
    async def cell_run(self, kernel_id: str, code: str, timeout: int = 60):
        km = self.kernels.get(kernel_id)
        if not km:
            raise ValueError(f"Kernel {kernel_id} not found")

        kc = km.client()
        msg_id = kc.execute(code)

        outputs = []
        while True:
            try:
                msg = kc.get_iopub_msg(timeout=timeout)
                if msg['parent_header'].get('msg_id') == msg_id:
                    msg_type = msg['msg_type']
                    content = msg['content']

                    if msg_type == 'stream':
                        outputs.append({
                            'type': 'text',
                            'data': content['text']
                        })
                    elif msg_type == 'execute_result' or msg_type == 'display_data':
                        outputs.append({
                            'type': 'result',
                            'data': content['data']
                        })
                    elif msg_type == 'error':
                        return {
                            'success': False,
                            'error': {
                                'name': content['ename'],
                                'message': content['evalue'],
                                'traceback': content['traceback']
                            }
                        }
                    elif msg_type == 'status' and content['execution_state'] == 'idle':
                        break
            except Empty:
                break

        return {
            'success': True,
            'outputs': outputs
        }

if __name__ == "__main__":
    server = JupyterRunnerServer()
    server.run_stdio()  # MCP stdio transport
```

---

### **3. Session Updates (VS Code)**

```typescript
// webview-ui/src/hooks/useSessionUpdates.ts
export function useSessionUpdates(port: number, sessionID: string) {
  const [stageStates, setStageStates] = useState<Record<string, StageState>>({})
  const [messages, setMessages] = useState<any[]>([])

  useEffect(() => {
    let timer: any
    const poll = async () => {
      try {
        const [infoRes, msgsRes] = await Promise.all([
          fetch(`http://localhost:${port}/session/${sessionID}`),
          fetch(`http://localhost:${port}/session/${sessionID}/message`)
        ])
        const info = await infoRes.json()
        const msgs = await msgsRes.json()
        setStageStates(extractStageStates(info))
        setMessages(msgs)
      } finally {
        timer = setTimeout(poll, 1200)
      }
    }
    poll()
    return () => clearTimeout(timer)
  }, [port, sessionID])

  return { stageStates, messages }
}
```

---

## ✅ Validation & Testing Strategy

### **Unit Tests**

```bash
# Python MCP servers
packages/python/tests/
├── test_jupyter_runner.py    # Test kernel management
├── test_graph_math.py         # Test DAG operations
└── test_causal_docs.py        # Test RAG queries

# Run: pytest packages/python/tests/
```

### **Integration Tests**

```typescript
// sdks/vscode/src/test/integration/workflow.test.ts
describe('Causal Workflow', () => {
  it('should complete EDA → DAG → ID workflow', async () => {
    const session = await createSession()
    await sendMessage(session, 'Analyze effect of treatment on outcome')

    // Wait for EDA stage
    await waitForStage(session, 'eda', 'completed')
    const edaArtifacts = await getArtifacts(session, 'eda')
    expect(edaArtifacts).toContain('profile.json')

    // DAG stage
    await waitForStage(session, 'dag', 'completed')
    const dagArtifacts = await getArtifacts(session, 'dag')
    expect(dagArtifacts).toContain('dag.json')
  })
})
```

---

## 📊 Success Criteria

### **M1 Completion Checklist**

- [ ] Python MCP servers running and responding
- [ ] VS Code chat panel functional
- [ ] Workflow stage tracker shows real-time progress
- [ ] Supervisor can orchestrate EDA → DAG → ID stages
- [ ] Artifacts saved and displayed in extension
- [ ] Error handling for MCP failures
- [ ] Session persistence across VS Code reloads
- [ ] Basic documentation complete

### **Quality Gates**

- All MCP servers pass unit tests
- Full workflow (user query → report) completes in <5 minutes
- No crashes on typical error scenarios (kernel crash, invalid DAG)
- Extension loads in <2 seconds

---

## 🎯 Next Steps (M2 - Future)

### **Deferred Features**

1. Visual DAG editor (dagre-d3 webview)
2. `causal-sdk` MCP server (DoWhy/EconML wrappers)
3. PDF reporting via Pandoc
4. Sensitivity analysis automation
5. Template library (RCT, IV, DiD, RDD)
6. Collaborative workflows (multi-user)
7. Cloud session storage

---

## 🚀 Getting Started

### **Prerequisites**

- Node.js 18+
- Python 3.11+
- Bun (for OpenCode)
- VS Code 1.85+

### **Development Setup**

```bash
# 1. Install dependencies
cd packages/opencode && bun install
cd sdks/vscode && npm install
cd packages/python && pip install -e .

# 2. Start OpenCode server
cd packages/opencode && bun run dev

# 3. Start MCP servers (separate terminals)
python -m opencode_causal.jupyter_runner
python -m opencode_causal.graph_math
python -m opencode_causal.causal_docs

# 4. Open VS Code extension
cd sdks/vscode && code .
# Press F5 to launch extension development host
```

---

## 📝 Notes & Recommendations

### **Best Practices**

1. **Incremental Development:** Start with stubs, add functionality iteratively
2. **Test-Driven:** Write MCP server tests before implementation
3. **Documentation:** Keep agent markdown files updated with examples
4. **Error Handling:** Graceful degradation when MCP servers fail
5. **Performance:** Stream large outputs, use pagination for artifacts

### **Common Pitfalls**

- ⚠️ Jupyter kernel timeouts → use generous timeouts (60s+)
- ⚠️ MCP server connection failures → implement retry logic
- ⚠️ Webview state sync → minimize state, use event-driven updates
- ⚠️ DAG validation edge cases → test with various graph structures

---

**Ready to start implementation!** 🚀

Recommended starting point: **Week 1, Day 1-2** (Jupyter Runner MCP Server)
