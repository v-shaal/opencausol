# Product Requirements Document (PRD)

## Causal Inference Assistant - VS Code Extension

**Version:** 1.0  
**Last Updated:** October 22, 2025  
**Status:** Draft  
**Owner:** Product Team  

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Product Overview](#product-overview)
3. [Problem Statement](#problem-statement)
4. [Goals & Success Metrics](#goals--success-metrics)
5. [User Personas](#user-personas)
6. [User Stories](#user-stories)
7. [Product Requirements](#product-requirements)
8. [Technical Architecture](#technical-architecture)
9. [User Experience](#user-experience)
10. [Non-Functional Requirements](#non-functional-requirements)
11. [Dependencies & Integrations](#dependencies--integrations)
12. [Release Planning](#release-planning)
13. [Risks & Mitigations](#risks--mitigations)
14. [Open Questions](#open-questions)

---

## Executive Summary

**Causal Inference Assistant** is a VS Code extension that provides an AI-powered multi-agent system specialized in guiding users through rigorous causal inference workflows. The extension integrates with Jupyter notebooks, proprietary causal analysis SDKs, and external Model Context Protocol (MCP) servers to deliver an intelligent, iterative, and domain-aware assistant for researchers, data scientists, and analysts working on causal inference problems.

**Key Differentiators:**
- **Domain Expertise**: Specialized in causal inference methodology (DAG construction, identification, estimation, sensitivity analysis)
- **Iterative Feedback**: Automatically refines analysis based on validation checks and output quality
- **MCP Integration**: Augments agent capabilities with external domain knowledge and computational resources
- **SDK-Agnostic**: Works with proprietary causal inference SDKs through configurable bridges
- **Jupyter-Native**: Deep integration with Jupyter notebooks for exploratory data analysis and code execution

**Target Launch:** Q2 2026  
**Primary Market:** Academic researchers, data scientists in tech/pharma/economics, causal ML practitioners

---

## Product Overview

### Vision Statement

*"Democratize rigorous causal inference by providing an AI assistant that embodies best practices, catches common pitfalls, and guides users through the entire causal analysis workflow—from research question to publication-ready results."*

### Product Description

Causal Inference Assistant is a VS Code extension featuring a multi-agent AI system that orchestrates specialized agents to help users:

1. **Formulate** clear causal research questions
2. **Explore** data with causal lens (checking assumptions, identifying issues)
3. **Construct** valid causal DAGs with domain knowledge augmentation
4. **Identify** causal effects using formal identification criteria
5. **Estimate** causal effects using appropriate methods and proprietary SDKs
6. **Validate** results through sensitivity analysis and robustness checks
7. **Document** findings with auto-generated reports and explanations

The system works in a **bidirectional feedback loop** with Jupyter notebooks, executing code, analyzing outputs, and iteratively refining the analysis until quality criteria are met.

---

## Problem Statement

### Current Pain Points

**For Causal Inference Practitioners:**

1. **Methodology Complexity**: Causal inference requires deep statistical knowledge (DAGs, identification, confounding, selection bias, etc.) that many practitioners lack
2. **Manual Workflow**: No unified tool that guides through the entire pipeline—researchers jump between R/Python scripts, literature, and manual checks
3. **Common Errors**: Frequent mistakes include:
   - Conditioning on colliders
   - Missing confounders
   - Violating positivity assumptions
   - Incorrect identification strategies
   - Inadequate sensitivity analysis
4. **Disconnected Tools**: SDK documentation separate from analysis; no integration between domain knowledge and code execution
5. **Iteration Overhead**: When analysis fails validation, manually debugging and refining is time-consuming
6. **Knowledge Silos**: Domain expertise (e.g., epidemiology, economics) isn't accessible during analysis

### Market Opportunity

- **Target Market Size**: ~500K data scientists working on causal problems (healthcare, tech, economics, social sciences)
- **Adjacent Markets**: ML researchers (causal ML), policy analysts, A/B testing practitioners
- **Unmet Need**: No AI assistant specialized in causal inference methodology (generic coding assistants don't understand causal concepts)

---

## Goals & Success Metrics

### Primary Goals

1. **Reduce Time to Valid Causal Analysis**: 50% reduction in time from research question to validated results
2. **Improve Methodological Rigor**: 80% of analyses meet best-practice criteria (validated DAG, proper identification, sensitivity analysis)
3. **Lower Barrier to Entry**: Enable researchers with basic statistics knowledge to conduct rigorous causal inference
4. **Increase Productivity**: Support 5+ concurrent causal projects per user vs. 1-2 currently

### Success Metrics

#### Launch Metrics (Month 3)
- **Adoption**: 1,000 active users
- **Engagement**: 10+ sessions per user per month
- **Completion Rate**: 60% of started analyses reach estimation stage
- **User Satisfaction**: NPS > 40

#### Growth Metrics (Month 12)
- **Adoption**: 10,000 active users
- **Retention**: 40% monthly active users
- **Workflow Coverage**: 80% of workflows reach sensitivity analysis
- **Quality Score**: 85% of analyses flagged as "methodologically sound" by validation agent

#### Business Metrics
- **Freemium Conversion**: 10% convert to paid tier (for advanced features)
- **SDK Integration**: 20+ proprietary SDK integrations
- **MCP Ecosystem**: 50+ public MCP servers available
- **Community Growth**: 100+ contributed workflow templates

---

## User Personas

### Persona 1: Academic Researcher (Primary)

**Name:** Dr. Sarah Chen  
**Role:** Assistant Professor, Public Health  
**Background:** PhD in Epidemiology, proficient in R/Python, publishes 3-5 papers/year  

**Goals:**
- Conduct rigorous observational studies on health interventions
- Publish in top-tier journals requiring causal claims
- Teach students proper causal inference methods

**Pain Points:**
- Manually validates DAGs with domain experts (slow, error-prone)
- Spends weeks debugging identification issues
- Struggles to remember all sensitivity analysis checks required by reviewers
- Students make basic causal inference mistakes

**Use Cases:**
- Estimate effect of exercise programs on cardiovascular outcomes
- Control for confounding in nutrition studies
- Teach causal inference concepts with interactive examples

**Technical Profile:**
- Comfortable with Jupyter notebooks
- Uses R (tidyverse) and Python (pandas)
- Has access to specialized health analytics SDKs

---

### Persona 2: Industry Data Scientist (Secondary)

**Name:** Alex Martinez  
**Role:** Senior Data Scientist, Tech Company  
**Background:** MS in Computer Science, 5 years experience, focuses on product analytics  

**Goals:**
- Move beyond correlational A/B tests to causal impact measurement
- Estimate long-term effects of product changes
- Build causal ML models for personalization

**Pain Points:**
- Limited formal training in causal inference
- Needs to move fast but maintain rigor
- Company has proprietary causal ML SDK (PyWhy, DoWhy, or custom)
- Difficult to explain causal assumptions to stakeholders

**Use Cases:**
- Measure causal impact of recommendation algorithm changes
- Estimate heterogeneous treatment effects for personalization
- Quick causal analysis for product decisions

**Technical Profile:**
- Expert Python/SQL user
- Familiar with scikit-learn, PyTorch
- Uses VS Code as primary IDE

---

### Persona 3: Graduate Student (Tertiary)

**Name:** Jamie Patel  
**Role:** PhD Student, Economics  
**Background:** 2nd year PhD, learning causal inference, strong math background  

**Goals:**
- Learn causal inference methodology properly
- Complete dissertation research
- Avoid common pitfalls that delay graduation

**Pain Points:**
- Overwhelmed by causal inference literature
- Makes mistakes that advisors catch late in the process
- Uncertain about which methods to use when
- Needs to learn multiple causal inference packages

**Use Cases:**
- Instrumental variable analysis for labor economics
- Difference-in-differences for policy evaluation
- Regression discontinuity designs

**Technical Profile:**
- Learning Python and Stata
- Some R experience
- New to advanced programming concepts

---

## User Stories

### Epic 1: Guided Causal Analysis Workflow

**US-1.1**: As a researcher, I want to input my research question in natural language so that the assistant can help me formulate it as a causal query  
**Acceptance Criteria:**
- User can type "Does exercise reduce heart disease?" and system extracts treatment, outcome, population
- System suggests refinements (e.g., "Which type of exercise?" "What age group?")
- System identifies potential issues (e.g., reverse causation, selection bias)

**US-1.2**: As a data scientist, I want the assistant to automatically perform EDA with a causal lens so that I can identify data quality issues that affect causal inference  
**Acceptance Criteria:**
- System checks treatment/outcome distributions, overlap, missing data patterns
- System flags violations of causal assumptions (e.g., no common support)
- System generates visualizations (balance tables, propensity score distributions)
- Results appear in Jupyter notebook with explanations

**US-1.3**: As a researcher, I want the assistant to help me construct a causal DAG by querying domain knowledge so that I don't miss important confounders  
**Acceptance Criteria:**
- System proposes initial DAG based on research question
- System queries MCP servers for domain-specific confounders
- System validates DAG structure (no cycles, proper temporal ordering)
- System visualizes DAG in notebook with interactive editing

**US-1.4**: As a user, I want the assistant to determine if my causal effect is identifiable and suggest adjustment strategies so that I know my analysis is valid  
**Acceptance Criteria:**
- System applies backdoor/frontdoor/instrumental variable criteria
- System returns all valid adjustment sets
- System recommends minimal sufficient adjustment set
- System explains why identification succeeds or fails

**US-1.5**: As a user, I want the assistant to generate and execute code using my proprietary SDK so that I can estimate causal effects with my organization's tools  
**Acceptance Criteria:**
- User configures SDK in settings (import path, API key, methods available)
- System generates valid Python/R code calling SDK functions
- System executes code in connected Jupyter notebook
- System captures and parses SDK outputs (estimates, confidence intervals, diagnostics)

**US-1.6**: As a researcher, I want the assistant to automatically run sensitivity analysis so that I can assess robustness of my findings  
**Acceptance Criteria:**
- System runs multiple robustness checks (unmeasured confounding, model specification, subgroups)
- System interprets sensitivity results and flags concerns
- System suggests additional checks based on findings
- Results compiled in summary table

---

### Epic 2: Iterative Feedback & Refinement

**US-2.1**: As a user, I want the assistant to detect when my analysis has issues and automatically refine it so that I don't waste time on invalid approaches  
**Acceptance Criteria:**
- System validates each stage output against quality criteria
- System provides specific feedback on issues (e.g., "Positivity violated for age > 80")
- System automatically refines code and re-executes
- System stops after 3 failed attempts and asks for user input

**US-2.2**: As a data scientist, I want the system to learn from execution errors and fix code bugs so that I can focus on methodology rather than debugging  
**Acceptance Criteria:**
- System captures Python/R errors from Jupyter
- System uses LLM to diagnose and fix errors
- System re-executes fixed code
- System explains what was fixed and why

**US-2.3**: As a researcher, I want the assistant to validate my results against best practices and flag potential issues so that my analysis meets publication standards  
**Acceptance Criteria:**
- System checks for: balance in covariates, positivity, no extrapolation, sensitivity analysis completeness
- System generates a "quality score" and report
- System suggests improvements to address flagged issues
- System references relevant literature/guidelines

---

### Epic 3: MCP Integration

**US-3.1**: As a user, I want to connect to MCP servers that provide domain-specific knowledge so that I can access expert information during my analysis  
**Acceptance Criteria:**
- User can add MCP server URLs in settings
- System discovers MCP capabilities and displays them
- System shows connection status (connected/disconnected/error)
- System can route queries to appropriate MCP servers

**US-3.2**: As a researcher, I want the assistant to query MCP servers for confounders and domain knowledge during DAG construction so that I don't miss important variables  
**Acceptance Criteria:**
- System automatically queries relevant MCPs when building DAG
- System presents MCP suggestions to user with provenance
- User can accept/reject MCP suggestions
- System incorporates accepted suggestions into DAG

**US-3.3**: As a power user, I want to manually query MCP servers for specific information so that I can leverage external knowledge when needed  
**Acceptance Criteria:**
- User can invoke `/mcp query "question"` command
- System routes to appropriate MCP server(s)
- System displays MCP response in readable format
- System can incorporate MCP response into current analysis

---

### Epic 4: Jupyter Integration

**US-4.1**: As a user, I want the assistant to connect to my active Jupyter notebook so that I can run causal analysis in my existing workflow  
**Acceptance Criteria:**
- System detects open Jupyter notebooks in VS Code
- User can select which notebook to use
- System shows connection status
- System can execute code in notebook cells

**US-4.2**: As a data scientist, I want the assistant to execute Python code and capture outputs so that I can see results inline  
**Acceptance Criteria:**
- System executes code in notebook cells
- System captures text output, plots, dataframes, errors
- System parses outputs into structured format
- System displays results in assistant chat and notebook

**US-4.3**: As a user, I want the assistant to analyze notebook outputs and provide interpretations so that I understand what the results mean causally  
**Acceptance Criteria:**
- System interprets statistical outputs in causal terms
- System flags concerning patterns (e.g., "Large standard errors suggest weak instruments")
- System suggests next steps based on results
- System explains technical concepts in accessible language

**US-4.4**: As a researcher, I want the assistant to maintain notebook state across the workflow so that variables and data persist between stages  
**Acceptance Criteria:**
- System tracks which variables exist in notebook
- System can reference previous outputs in later stages
- System avoids re-running expensive computations
- System can reset/restart if needed

---

### Epic 5: User Experience & Interface

**US-5.1**: As a user, I want a chat interface in VS Code to interact with the assistant so that I can ask questions and give commands naturally  
**Acceptance Criteria:**
- Chat panel appears in VS Code sidebar
- User can type natural language queries
- System responds with structured messages (text, code, visualizations)
- Chat history is preserved across sessions

**US-5.2**: As a user, I want to see the current stage of my causal workflow so that I know what's happening and what's next  
**Acceptance Criteria:**
- Visual workflow diagram shows: Problem Formulation → EDA → DAG → Identification → Estimation → Sensitivity → Reporting
- Current stage is highlighted
- Completed stages show checkmarks
- Failed stages show error indicators
- User can click stages to see details or re-run

**US-5.3**: As a user, I want to see which agent is currently working so that I understand what the system is doing  
**Acceptance Criteria:**
- System displays "EDA Agent is analyzing data..." with progress indicator
- System shows agent reasoning (e.g., "Checking positivity assumption...")
- User can expand to see detailed agent logs
- User can cancel long-running operations

**US-5.4**: As a researcher, I want to export a complete report of my analysis so that I can share findings or include in publications  
**Acceptance Criteria:**
- User can trigger report generation with `/report` command
- Report includes: research question, DAG, identification strategy, estimates, sensitivity analysis, all code
- Report formatted as Markdown/PDF/LaTeX
- Report includes citations for methods used

**US-5.5**: As a power user, I want to configure workflow behavior and agent settings so that I can customize the assistant for my needs  
**Acceptance Criteria:**
- Settings panel for: MCP servers, SDK configuration, workflow preferences, agent behavior
- User can enable/disable automatic stages
- User can set strictness of validation checks
- User can choose LLM provider (OpenAI/Anthropic/local)

---

### Epic 6: Learning & Guidance

**US-6.1**: As a student, I want the assistant to explain causal inference concepts when I encounter them so that I can learn while doing analysis  
**Acceptance Criteria:**
- System detects when user might need explanation (e.g., first time using backdoor criterion)
- System provides concise explanation with example
- System links to detailed resources
- User can ask "Explain backdoor criterion" and get tutorial

**US-6.2**: As a user, I want access to causal inference workflow templates so that I can learn from examples and accelerate my work  
**Acceptance Criteria:**
- System includes templates: RCT analysis, observational study, IV analysis, DiD, RDD
- User can load template and adapt to their data
- Templates include annotations explaining each step
- User can save custom templates

**US-6.3**: As a researcher, I want the assistant to suggest relevant literature and methods based on my analysis so that I can cite appropriate sources  
**Acceptance Criteria:**
- System suggests papers relevant to chosen methodology
- System formats citations (BibTeX, APA, etc.)
- System can query MCP literature servers
- System explains why each citation is relevant

---

## Product Requirements

### Functional Requirements

#### FR-1: Multi-Agent Orchestration System

**FR-1.1**: System shall implement a Manager Agent (Orchestrator) that coordinates specialized agents  
- **Priority**: P0 (Must-Have)
- **Complexity**: High

**FR-1.2**: System shall support sequential execution of workflow stages with dependency management  
- **Priority**: P0
- **Complexity**: Medium

**FR-1.3**: System shall enable bidirectional communication between agents via message bus  
- **Priority**: P0
- **Complexity**: Medium

**FR-1.4**: System shall maintain shared context accessible to all agents  
- **Priority**: P0
- **Complexity**: Medium

**FR-1.5**: System shall support dynamic agent selection based on task requirements  
- **Priority**: P1 (Should-Have)
- **Complexity**: Medium

---

#### FR-2: Specialized Causal Inference Agents

**FR-2.1**: System shall include an EDA Agent that performs causal-aware exploratory data analysis  
- **Priority**: P0
- **Complexity**: High
- **Capabilities**: Check overlap, missing data, balance, correlations, distributions

**FR-2.2**: System shall include a DAG Builder Agent that constructs and validates causal DAGs  
- **Priority**: P0
- **Complexity**: High
- **Capabilities**: Propose DAG, validate structure, query domain knowledge, visualize

**FR-2.3**: System shall include an Identification Agent that determines causal identifiability  
- **Priority**: P0
- **Complexity**: High
- **Capabilities**: Apply backdoor/frontdoor criteria, find adjustment sets, validate assumptions

**FR-2.4**: System shall include an Estimation Agent that generates code to estimate causal effects  
- **Priority**: P0
- **Complexity**: Medium
- **Capabilities**: Generate SDK code, execute in Jupyter, parse results, interpret estimates

**FR-2.5**: System shall include a Sensitivity Analysis Agent that validates robustness  
- **Priority**: P1
- **Complexity**: Medium
- **Capabilities**: Unmeasured confounding tests, model specification checks, subgroup analysis

**FR-2.6**: System shall include a Documentation Agent that generates reports  
- **Priority**: P1
- **Complexity**: Low
- **Capabilities**: Compile results, format citations, generate visualizations, export formats

---

#### FR-3: Jupyter Notebook Integration

**FR-3.1**: System shall detect and connect to active Jupyter notebooks in VS Code  
- **Priority**: P0
- **Complexity**: Medium

**FR-3.2**: System shall execute Python/R code in connected notebook cells  
- **Priority**: P0
- **Complexity**: Medium

**FR-3.3**: System shall capture cell outputs including text, dataframes, plots, and errors  
- **Priority**: P0
- **Complexity**: Medium

**FR-3.4**: System shall parse structured outputs (tables, JSON) into usable data structures  
- **Priority**: P0
- **Complexity**: Medium

**FR-3.5**: System shall maintain notebook kernel state across workflow stages  
- **Priority**: P0
- **Complexity**: Low

**FR-3.6**: System shall support multiple concurrent notebook connections  
- **Priority**: P2 (Nice-to-Have)
- **Complexity**: High

---

#### FR-4: MCP (Model Context Protocol) Integration

**FR-4.1**: System shall support connecting to multiple MCP servers via HTTP/WebSocket  
- **Priority**: P0
- **Complexity**: Medium

**FR-4.2**: System shall discover and register MCP server capabilities  
- **Priority**: P0
- **Complexity**: Low

**FR-4.3**: System shall route queries to appropriate MCP servers based on capability matching  
- **Priority**: P0
- **Complexity**: Medium

**FR-4.4**: System shall aggregate responses from multiple MCP servers  
- **Priority**: P1
- **Complexity**: Medium

**FR-4.5**: System shall handle MCP server failures gracefully with fallback strategies  
- **Priority**: P1
- **Complexity**: Medium

**FR-4.6**: System shall cache MCP responses to reduce latency and costs  
- **Priority**: P2
- **Complexity**: Low

---

#### FR-5: Proprietary SDK Integration

**FR-5.1**: System shall support configurable SDK integration via settings  
- **Priority**: P0
- **Complexity**: Low
- **Config**: Import path, initialization code, available methods

**FR-5.2**: System shall generate SDK-specific code for causal estimation  
- **Priority**: P0
- **Complexity**: Medium

**FR-5.3**: System shall parse SDK outputs in various formats (JSON, dataframes, objects)  
- **Priority**: P0
- **Complexity**: Medium

**FR-5.4**: System shall validate SDK installation and version compatibility  
- **Priority**: P1
- **Complexity**: Low

**FR-5.5**: System shall support multiple SDK integrations simultaneously  
- **Priority**: P2
- **Complexity**: Medium

---

#### FR-6: Iterative Feedback & Refinement

**FR-6.1**: System shall validate outputs at each workflow stage against quality criteria  
- **Priority**: P0
- **Complexity**: High

**FR-6.2**: System shall generate actionable feedback when validation fails  
- **Priority**: P0
- **Complexity**: Medium

**FR-6.3**: System shall automatically refine code/parameters based on feedback  
- **Priority**: P0
- **Complexity**: High

**FR-6.4**: System shall re-execute refined analysis up to configurable max attempts  
- **Priority**: P0
- **Complexity**: Low

**FR-6.5**: System shall escalate to user when automatic refinement fails  
- **Priority**: P0
- **Complexity**: Low

**FR-6.6**: System shall maintain iteration history for debugging and learning  
- **Priority**: P1
- **Complexity**: Low

---

#### FR-7: User Interface & Experience

**FR-7.1**: System shall provide a chat interface in VS Code sidebar  
- **Priority**: P0
- **Complexity**: Medium

**FR-7.2**: System shall display workflow progress with visual stage indicator  
- **Priority**: P0
- **Complexity**: Low

**FR-7.3**: System shall show current agent activity and reasoning  
- **Priority**: P1
- **Complexity**: Low

**FR-7.4**: System shall support cancellation of long-running operations  
- **Priority**: P1
- **Complexity**: Medium

**FR-7.5**: System shall preserve chat history across VS Code sessions  
- **Priority**: P1
- **Complexity**: Low

**FR-7.6**: System shall provide settings UI for configuration  
- **Priority**: P0
- **Complexity**: Medium

**FR-7.7**: System shall display MCP connection status  
- **Priority**: P1
- **Complexity**: Low

---

#### FR-8: Causal Inference Knowledge Base

**FR-8.1**: System shall include domain-specific prompt templates for each workflow stage  
- **Priority**: P0
- **Complexity**: Medium

**FR-8.2**: System shall provide causal inference best practices library  
- **Priority**: P1
- **Complexity**: Low

**FR-8.3**: System shall include common pitfalls detection  
- **Priority**: P1
- **Complexity**: Medium

**FR-8.4**: System shall support workflow templates (RCT, IV, DiD, RDD, etc.)  
- **Priority**: P1
- **Complexity**: Medium

**FR-8.5**: System shall enable user-defined custom workflow templates  
- **Priority**: P2
- **Complexity**: Medium

---

#### FR-9: Reporting & Documentation

**FR-9.1**: System shall generate comprehensive analysis reports  
- **Priority**: P1
- **Complexity**: Medium

**FR-9.2**: System shall export reports in multiple formats (Markdown, PDF, LaTeX, HTML)  
- **Priority**: P1
- **Complexity**: Medium

**FR-9.3**: System shall include all code, outputs, and explanations in reports  
- **Priority**: P1
- **Complexity**: Low

**FR-9.4**: System shall format method citations properly  
- **Priority**: P1
- **Complexity**: Low

**FR-9.5**: System shall generate publication-ready tables and figures  
- **Priority**: P2
- **Complexity**: Medium

---

### Non-Functional Requirements

#### NFR-1: Performance

**NFR-1.1**: Workflow stage execution shall complete within 60 seconds (95th percentile)  
- Excludes long-running computations (e.g., bootstrap with 10K samples)

**NFR-1.2**: Chat response latency shall be under 3 seconds for simple queries  
- Measured from user hitting Enter to first token displayed

**NFR-1.3**: Jupyter code execution shall start within 2 seconds  
- Actual execution time depends on code complexity

**NFR-1.4**: MCP query latency shall be under 5 seconds (95th percentile)  
- Assumes MCP server responds within 4 seconds

**NFR-1.5**: System shall support analyzing datasets up to 1M rows  
- Performance may degrade gracefully beyond this

---

#### NFR-2: Reliability

**NFR-2.1**: System shall have 99% uptime (excludes VS Code/Jupyter failures)  

**NFR-2.2**: System shall gracefully handle Jupyter kernel crashes with recovery prompts  

**NFR-2.3**: System shall handle MCP server failures without crashing extension  

**NFR-2.4**: System shall save workflow state every 60 seconds to prevent data loss  

**NFR-2.5**: System shall log errors with sufficient detail for debugging  

---

#### NFR-3: Usability

**NFR-3.1**: New users shall complete first causal analysis within 15 minutes  
- Measured from installation to first causal estimate

**NFR-3.2**: System shall provide helpful error messages with resolution suggestions  

**NFR-3.3**: System shall use plain language in explanations (Flesch-Kincaid grade 12)  

**NFR-3.4**: System shall support undo/redo for workflow stages  

**NFR-3.5**: System shall provide inline documentation and tooltips  

---

#### NFR-4: Security & Privacy

**NFR-4.1**: System shall not send user data to external servers without explicit consent  

**NFR-4.2**: System shall store API keys securely in VS Code secret storage  

**NFR-4.3**: System shall support on-premise/local LLM deployment for sensitive data  

**NFR-4.4**: System shall provide data anonymization options before MCP queries  

**NFR-4.5**: System shall comply with GDPR/CCPA for telemetry data  

---

#### NFR-5: Compatibility

**NFR-5.1**: System shall support VS Code versions 1.85+  

**NFR-5.2**: System shall work with Python 3.8+ kernels in Jupyter  

**NFR-5.3**: System shall support R 4.0+ kernels in Jupyter (future)  

**NFR-5.4**: System shall work on Windows, macOS, and Linux  

**NFR-5.5**: System shall integrate with VS Code's theme system (light/dark mode)  

---

#### NFR-6: Maintainability

**NFR-6.1**: Codebase shall maintain >80% test coverage  

**NFR-6.2**: System shall use typed interfaces (TypeScript) for all public APIs  

**NFR-6.3**: System shall follow modular architecture enabling agent swapping  

**NFR-6.4**: System shall provide comprehensive developer documentation  

**NFR-6.5**: System shall use semantic versioning for releases  

---

#### NFR-7: Scalability

**NFR-7.1**: System shall support 10,000+ concurrent users (cloud LLM rate limits may apply)  

**NFR-7.2**: System shall handle 100+ MCP server connections per user  

**NFR-7.3**: System shall maintain responsiveness with 50+ workflow stages  

**NFR-7.4**: System shall support workflows with 20+ iteration loops  

---

## Technical Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   VS Code Extension Host                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Extension Layer (TypeScript)                                │
│  ├─ Commands & UI (Webview)                                 │
│  ├─ Jupyter Integration (VS Code API)                       │
│  └─ Configuration Management                                 │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Orchestration Layer                                         │
│  ├─ Causal Workflow Engine                                  │
│  ├─ Feedback Loop Manager                                   │
│  ├─ Validation Framework                                    │
│  └─ State Management                                        │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Agent Layer (Mastra + Custom)                              │
│  ├─ EDA Agent                                               │
│  ├─ DAG Builder Agent                                       │
│  ├─ Identification Agent                                    │
│  ├─ Estimation Agent                                        │
│  ├─ Sensitivity Agent                                       │
│  └─ Documentation Agent                                     │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Integration Layer                                          │
│  ├─ MCP Client Manager                                      │
│  ├─ SDK Bridge                                              │
│  ├─ Jupyter Executor                                        │
│  └─ LLM Provider (Anthropic/OpenAI)                         │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Knowledge Layer                                            │
│  ├─ Causal Prompts Library                                  │
│  ├─ Workflow Templates                                      │
│  ├─ Best Practices DB                                       │
│  └─ Validation Rules                                        │
│                                                               │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
    Jupyter              MCP Servers         Proprietary SDKs
    Notebook             (HTTP/WS)           (Python/R)
```

### Technology Stack

#### Core Technologies
- **Language**: TypeScript 5.x
- **Runtime**: Node.js 18+
- **Framework**: VS Code Extension API 1.85+
- **Agent Framework**: Mastra AI (for agent wrapper)
- **LLM SDKs**: @anthropic-ai/sdk, openai

#### Key Libraries
- **Jupyter Integration**: @vscode/jupyter-extension
- **State Management**: Zustand or Redux Toolkit
- **Validation**: Zod (schema validation)
- **HTTP Client**: Axios
- **WebSocket**: ws
- **Testing**: Jest, VS Code Test Runner
- **Build**: esbuild, webpack

#### External Services
- **LLM Providers**: Anthropic Claude, OpenAI GPT-4
- **MCP Servers**: Custom/community MCP implementations
- **Proprietary SDKs**: User-configured (PyWhy, DoWhy, CausalML, custom)

---

### Data Models

#### Workflow State

```typescript
interface WorkflowState {
  id: string;
  userId: string;
  researchQuestion: string;
  currentStage: WorkflowStage;
  stages: {
    [key: string]: StageState;
  };
  sharedContext: SharedContext;
  createdAt: Date;
  updatedAt: Date;
}

interface StageState {
  name: WorkflowStage;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  attempts: number;
  result?: any;
  validationResult?: ValidationResult;
  iterations: IterationRecord[];
}

interface SharedContext {
  treatment: string;
  outcome: string;
  confounders: string[];
  dag?: DAG;
  dataset?: DatasetInfo;
  adjustmentSet?: string[];
  estimate?: CausalEstimate;
  [key: string]: any;
}
```

#### Agent Message

```typescript
interface AgentMessage {
  id: string;
  type: 'task' | 'result' | 'query' | 'feedback';
  from: string; // Agent ID
  to: string; // Agent ID or 'orchestrator'
  payload: {
    stage?: WorkflowStage;
    data?: any;
    error?: Error;
    feedback?: Feedback;
  };
  timestamp: number;
  correlationId?: string;
}
```

#### Causal DAG

```typescript
interface DAG {
  nodes: Node[];
  edges: Edge[];
  assumptions: string[];
  metadata: {
    source: 'user' | 'agent' | 'mcp';
    confidence: number;
    lastModified: Date;
  };
}

interface Node {
  id: string;
  label: string;
  type: 'treatment' | 'outcome' | 'confounder' | 'mediator' | 'collider';
  observed: boolean;
}

interface Edge {
  from: string;
  to: string;
  type: 'causal' | 'confounding' | 'selection';
}
```

#### MCP Configuration

```typescript
interface MCPServerConfig {
  name: string;
  url: string;
  protocol: 'http' | 'websocket';
  capabilities: MCPCapability[];
  auth?: {
    type: 'api_key' | 'oauth' | 'none';
    credentials?: any;
  };
  enabled: boolean;
}

interface MCPCapability {
  type: 'knowledge_base' | 'computation' | 'data_source' | 'validation';
  description: string;
  endpoints: string[];
}
```

---

### API Contracts

#### Agent Interface

```typescript
interface CausalAgent {
  id: string;
  name: string;
  capabilities: string[];
  
  // Core methods
  canHandle(task: Task): boolean;
  execute(task: Task, context: SharedContext): Promise<AgentResult>;
  
  // Lifecycle
  initialize(config: AgentConfig): Promise<void>;
  shutdown(): Promise<void>;
}

interface AgentResult {
  success: boolean;
  data?: any;
  error?: Error;
  feedback?: Feedback;
  suggestedNextSteps?: string[];
  requiresIteration?: boolean;
}
```

#### MCP Client Interface

```typescript
interface MCPClient {
  connect(config: MCPServerConfig): Promise<void>;
  disconnect(): Promise<void>;
  
  query(query: string, context?: any): Promise<MCPResponse>;
  execute(command: string, params: any): Promise<any>;
  
  getCapabilities(): MCPCapability[];
  healthCheck(): Promise<boolean>;
}

interface MCPResponse {
  source: string; // MCP server name
  data: any;
  confidence?: number;
  references?: string[];
}
```

#### Jupyter Executor Interface

```typescript
interface JupyterExecutor {
  connect(notebookUri: vscode.Uri): Promise<void>;
  disconnect(): Promise<void>;
  
  execute(code: string, options?: ExecutionOptions): Promise<ExecutionResult>;
  getVariable(name: string): Promise<any>;
  setVariable(name: string, value: any): Promise<void>;
  
  getKernelInfo(): KernelInfo;
  restartKernel(): Promise<void>;
}

interface ExecutionResult {
  success: boolean;
  outputs: CellOutput[];
  error?: ExecutionError;
  executionTime: number;
}
```

---

## User Experience

### User Flows

#### Flow 1: Quick Start (Guided Analysis)

1. User opens VS Code with Jupyter notebook
2. User clicks "Causal Inference Assistant" icon in sidebar
3. User types: "Analyze the effect of exercise on heart disease using my dataset"
4. System prompts: "Which notebook should I use? [notebook_selector]"
5. User selects notebook
6. System prompts: "I see you have a dataset. Which columns are treatment and outcome?"
7. User: "exercise_hours is treatment, heart_disease is outcome"
8. System: "Starting causal analysis workflow..."
   - Stage 1: EDA (shows progress)
   - Executes EDA code in notebook
   - Shows visualizations and summary
   - Agent: "I found 3 potential issues: [missing data, poor overlap, age confounder]"
9. User: "Continue"
10. System: "Building causal DAG..."
    - Queries MCP for known confounders
    - Shows proposed DAG
    - User can edit interactively
11. System: "Checking if effect is identifiable..."
    - Shows adjustment set: [age, gender, income]
12. System: "Estimating causal effect..."
    - Generates SDK code
    - Executes in notebook
    - Shows estimate: 0.15 reduction in risk (95% CI: 0.10-0.20)
13. System: "Running sensitivity analysis..."
    - Multiple robustness checks
    - Summary: "Results are robust to unmeasured confounding up to E-value of 2.5"
14. System: "Analysis complete! Would you like me to generate a report?"
15. User: "Yes"
16. System generates comprehensive report (Markdown/PDF)

**Time**: ~10-15 minutes (excluding computation time)

---

#### Flow 2: Expert Mode (Manual Control)

1. User with existing analysis wants specific help
2. User: "/dag propose --treatment smoking --outcome lung_cancer"
3. System proposes DAG, queries MCP
4. User edits DAG manually in interactive editor
5. User: "/identify --dag current"
6. System shows adjustment sets
7. User: "/estimate --method ipw --adjustment age,gender"
8. System generates code, user reviews before execution
9. User modifies code in notebook
10. User: "/analyze output"
11. System interprets results, flags concerns
12. User: "/sensitivity --method rosenbaum"
13. System runs specific sensitivity analysis

**Time**: ~5 minutes (user controls pacing)

---

#### Flow 3: Learning Mode (Student)

1. Student wants to learn causal inference
2. User: "Load template: observational study"
3. System loads annotated example with fake data
4. System explains each step as it executes
5. User can ask questions: "What is backdoor criterion?"
6. System provides tutorial with examples
7. User modifies template for their research question
8. System guides through each stage with explanations

**Time**: ~30 minutes (educational)

---

### UI Components

#### 1. Chat Interface (Primary)

```
┌─────────────────────────────────────────────┐
│  Causal Inference Assistant         [⚙️] [?]│
├─────────────────────────────────────────────┤
│                                             │
│  💬 User: Analyze effect of X on Y        │
│                                             │
│  🤖 Assistant: I'll help you with that.   │
│     Starting EDA...                         │
│                                             │
│     ┌─────────────────────────────────┐   │
│     │ EDA Agent                        │   │
│     │ [████████░░] 80%                │   │
│     │ Checking positivity assumption  │   │
│     └─────────────────────────────────┘   │
│                                             │
│  📊 [View in Notebook]                     │
│                                             │
│  💬 User: Continue                         │
│                                             │
├─────────────────────────────────────────────┤
│  Type a message...                    [📎] │
└─────────────────────────────────────────────┘
```

#### 2. Workflow Progress Bar

```
┌─────────────────────────────────────────────┐
│  Workflow Progress                          │
├─────────────────────────────────────────────┤
│                                             │
│  ✅ Problem Formulation                    │
│  ✅ EDA                                    │
│  🔄 DAG Construction  [View] [Edit]        │
│  ⏸️ Identification                         │
│  ⏸️ Estimation                             │
│  ⏸️ Sensitivity                            │
│  ⏸️ Reporting                              │
│                                             │
└─────────────────────────────────────────────┘
```

#### 3. Settings Panel

```
┌─────────────────────────────────────────────┐
│  Settings                                   │
├─────────────────────────────────────────────┤
│                                             │
│  🔌 MCP Servers                            │
│    ✅ epidemiology_kb (connected)          │
│    ❌ literature_search (disconnected)     │
│    [+ Add Server]                           │
│                                             │
│  🔧 Proprietary SDK                        │
│    Name: CausalML                           │
│    Import: causalml_pro                     │
│    [Configure Methods]                      │
│                                             │
│  🤖 LLM Provider                           │
│    Provider: Anthropic                      │
│    Model: claude-sonnet-4-5                │
│    [Change]                                 │
│                                             │
│  ⚙️ Workflow Preferences                   │
│    ☑️ Auto EDA                             │
│    ☑️ Require DAG validation               │
│    ☑️ Run sensitivity by default           │
│    ☑️ Iterative feedback loops             │
│    Max iterations: [3]                      │
│                                             │
└─────────────────────────────────────────────┘
```

#### 4. DAG Editor (Interactive)

```
┌─────────────────────────────────────────────┐
│  DAG Editor                      [Save] [?] │
├─────────────────────────────────────────────┤
│                                             │
│         [Age]                               │
│          ↓  ↘                              │
│          ↓    [Gender]                     │
│          ↓      ↓                          │
│      [Exercise] → [Heart Disease]          │
│          ↑                                  │
│       [Income]                              │
│                                             │
│  💡 MCP Suggestions:                       │
│     • Add "Family History" as confounder   │
│     • Consider "BMI" as mediator           │
│     [Accept All] [Review]                   │
│                                             │
│  ⚠️ Validation:                            │
│     • No cycles detected ✅                │
│     • Temporal ordering valid ✅           │
│     • No conditioning on colliders ✅      │
│                                             │
└─────────────────────────────────────────────┘
```

---

### Commands

Users interact via chat or slash commands:

```bash
# Workflow commands
/causal start [question]        # Start new workflow
/causal continue                # Resume workflow
/causal restart                 # Restart from beginning
/causal stop                    # Stop current execution

# Stage-specific commands
/eda [dataset]                  # Run EDA
/dag propose                    # Propose DAG
/dag edit                       # Open DAG editor
/identify                       # Check identification
/estimate [method]              # Estimate causal effect
/sensitivity [method]           # Run sensitivity analysis
/report                         # Generate report

# MCP commands
/mcp connect [name] [url]       # Connect to MCP server
/mcp disconnect [name]          # Disconnect from MCP
/mcp query [question]           # Query MCP
/mcp list                       # List connected MCPs

# Utility commands
/help                           # Show help
/explain [concept]              # Explain causal concept
/template [name]                # Load workflow template
/settings                       # Open settings
```

---

## Dependencies & Integrations

### Required Dependencies

1. **VS Code Extension API** (v1.85+)
   - Core extension functionality
   - Webview for UI
   - Command registration

2. **VS Code Jupyter Extension** (latest)
   - Notebook connection
   - Kernel management
   - Cell execution

3. **Anthropic SDK** or **OpenAI SDK**
   - LLM integration
   - Streaming responses
   - Function calling

4. **Mastra AI** (optional, recommended)
   - Agent wrapper
   - Tool management
   - Multi-LLM support

### Optional Integrations

1. **MCP Servers** (user-configured)
   - Domain knowledge bases
   - Literature search
   - Computation offloading

2. **Proprietary SDKs** (user-configured)
   - CausalML
   - DoWhy
   - PyWhy
   - Custom SDKs

3. **Git Integration** (future)
   - Version control for workflows
   - Collaboration features

4. **Cloud Storage** (future)
   - Save workflows to cloud
   - Share templates

---

## Release Planning

### MVP (v0.1) - Month 3

**Goal**: Validate core concept with early adopters

**Features**:
- ✅ Basic chat interface
- ✅ Jupyter notebook connection
- ✅ EDA Agent (basic)
- ✅ DAG Builder Agent (basic)
- ✅ Sequential workflow (no feedback loops)
- ✅ Single MCP connection
- ✅ Manual SDK configuration

**Success Metrics**:
- 50 beta users
- 70% complete at least one workflow
- NPS > 30

---

### Beta (v0.5) - Month 6

**Goal**: Feature-complete with feedback loops

**Features**:
- ✅ All 6 agents implemented
- ✅ Iterative feedback loops
- ✅ Multiple MCP connections
- ✅ Interactive DAG editor
- ✅ Basic reporting
- ✅ Workflow templates
- ✅ Improved error handling

**Success Metrics**:
- 500 beta users
- 60% retention (month 2)
- 80% reach sensitivity analysis stage
- NPS > 40

---

### v1.0 (Public Launch) - Month 12

**Goal**: Production-ready, general availability

**Features**:
- ✅ All beta features polished
- ✅ Comprehensive documentation
- ✅ Multi-format reporting
- ✅ Extensive workflow templates
- ✅ Performance optimizations
- ✅ Robust error recovery
- ✅ Telemetry & analytics
- ✅ Marketplace listing

**Success Metrics**:
- 10,000 users
- 40% MAU
- NPS > 50
- <5% error rate

---

### v1.5 (Enhancement) - Month 18

**Features**:
- ✅ R language support
- ✅ Collaborative workflows (multi-user)
- ✅ Cloud workflow storage
- ✅ Advanced visualization tools
- ✅ Agent learning from feedback
- ✅ Custom agent creation (extensibility)

---

### v2.0 (Enterprise) - Month 24

**Features**:
- ✅ On-premise deployment
- ✅ SSO/LDAP integration
- ✅ Audit logging
- ✅ Team management
- ✅ Dedicated support
- ✅ SLA guarantees

---

## Risks & Mitigations

### Risk 1: LLM Reliability (High Impact, High Probability)

**Risk**: LLMs may generate incorrect causal reasoning (e.g., wrong adjustment sets, invalid DAGs)

**Impact**: Users get wrong results, lose trust, publish incorrect findings

**Mitigation**:
- Implement rigorous validation at each stage using formal causal inference algorithms
- Multiple validation layers: rule-based + LLM-based
- Flag low-confidence results for user review
- Provide explanations and references for all decisions
- User can always override agent decisions
- Community feedback loop to improve prompts

---

### Risk 2: Jupyter Integration Fragility (Medium Impact, Medium Probability)

**Risk**: Jupyter kernel crashes, connection issues, version incompatibilities

**Impact**: Workflow interruption, poor UX, data loss

**Mitigation**:
- Robust error handling with graceful degradation
- Automatic retry with exponential backoff
- Save workflow state frequently
- Support kernel restart/reconnection
- Extensive testing across Jupyter versions
- Fallback to external Python process if needed

---

### Risk 3: MCP Server Availability (Medium Impact, Low Probability)

**Risk**: MCP servers down, slow, or return incorrect data

**Impact**: Workflow blocked, poor DAG suggestions, user frustration

**Mitigation**:
- MCP queries are optional enhancements, not required
- Fallback to LLM-only mode if MCP unavailable
- Cache MCP responses
- Health checks before queries
- User can provide domain knowledge manually
- Timeout and retry logic

---

### Risk 4: SDK Incompatibility (High Impact, Medium Probability)

**Risk**: User's SDK version differs, API changes, import failures

**Impact**: Estimation fails, workflow blocked

**Mitigation**:
- SDK integration is configurable and optional
- Version checking during setup
- Generate code that user can inspect/modify before execution
- Support multiple SDK versions via configuration
- Fallback to standard libraries (statsmodels, scikit-learn)
- Community-contributed SDK configurations

---

### Risk 5: Privacy/Security Concerns (High Impact, Low Probability)

**Risk**: Users don't trust sending data to cloud LLMs, regulatory issues

**Impact**: Adoption blocked in healthcare, finance sectors

**Mitigation**:
- Support local LLM deployment (Ollama, etc.)
- Data anonymization options
- Clear privacy policy
- On-premise deployment option (enterprise)
- GDPR/HIPAA compliance documentation
- User controls what data leaves their machine

---

### Risk 6: Scope Creep (Medium Impact, High Probability)

**Risk**: Feature requests expand beyond causal inference, diluting focus

**Impact**: Delayed launch, unfocused product, confused users

**Mitigation**:
- Strict adherence to causal inference domain
- Clear product vision document
- Prioritization framework (P0/P1/P2)
- Regular roadmap reviews
- Say "no" to non-causal features
- Extensibility API for custom agents (v2.0)

---

### Risk 7: Performance/Scalability (Low Impact, Medium Probability)

**Risk**: LLM latency, Jupyter execution time, large datasets

**Impact**: Poor UX, user frustration, abandonment

**Mitigation**:
- Streaming LLM responses for perceived speed
- Progress indicators for all operations
- Parallel execution where possible
- Optimize prompts to reduce token usage
- Lazy loading and pagination
- Performance testing with realistic workloads

---

## Open Questions

### Product Questions

1. **Pricing Model**: Free tier limits? Paid features? Enterprise pricing?
   - **Decision**: Freemium with 100 workflow runs/month free, unlimited for $19/month

2. **Multi-language Support**: R support in v1.0 or v1.5?
   - **Decision**: Python-only for MVP, R in v1.5 if demand exists

3. **Offline Mode**: Should system work without internet?
   - **Decision**: Requires internet for LLM, but support local LLM option

4. **Collaboration**: Multi-user workflows in v1.0?
   - **Decision**: Single-user for v1.0, collaborative in v1.5

5. **Telemetry**: What usage data to collect?
   - **Decision**: Anonymous usage stats (stages completed, error rates), opt-in detailed telemetry

### Technical Questions

1. **Agent Framework**: Full Mastra, partial Mastra, or custom?
   - **Decision**: Partial Mastra (agent wrapper only) + custom orchestration

2. **MCP Protocol Version**: Which version to support?
   - **Decision**: Latest stable MCP spec, backward compatibility where possible

3. **State Persistence**: Local files, SQLite, or cloud?
   - **Decision**: Local JSON files for v1.0, cloud option in v1.5

4. **LLM Context Window**: How to handle long workflows exceeding context limits?
   - **Decision**: Summarization between stages, RAG for workflow history

5. **Code Execution Security**: Sandboxing Jupyter code?
   - **Decision**: Trust user's Jupyter kernel (same risk as manual use), add warnings

### Design Questions

1. **DAG Editor**: Build custom or use existing library (e.g., ReactFlow)?
   - **Decision**: Use dagre-d3 for rendering, custom interaction layer

2. **Report Format**: Which formats to prioritize?
   - **Decision**: Markdown (v1.0), PDF via Pandoc (v1.0), LaTeX (v1.5)

3. **Mobile Support**: Should extension work on VS Code mobile?
   - **Decision**: Desktop-only for v1.0, mobile considerations in v2.0

4. **Accessibility**: WCAG compliance level?
   - **Decision**: WCAG 2.1 AA for v1.0

---

## Appendices

### Appendix A: Causal Inference Terminology

- **Treatment**: The intervention or exposure of interest (e.g., drug, policy)
- **Outcome**: The result or effect being measured (e.g., survival, income)
- **Confounder**: Variable that affects both treatment and outcome, causing spurious association
- **Mediator**: Variable in causal pathway between treatment and outcome
- **Collider**: Variable affected by both treatment and outcome
- **DAG (Directed Acyclic Graph)**: Visual representation of causal relationships
- **Backdoor Path**: Non-causal path from treatment to outcome
- **Backdoor Criterion**: Condition for identifying causal effects by blocking backdoor paths
- **Positivity**: Assumption that all units have non-zero probability of receiving any treatment level
- **SUTVA**: Stable Unit Treatment Value Assumption - no interference between units
- **Propensity Score**: Probability of receiving treatment given covariates
- **Instrumental Variable**: Variable that affects outcome only through treatment
- **Difference-in-Differences**: Method comparing treatment/control groups before/after intervention
- **Regression Discontinuity**: Method exploiting discontinuous treatment assignment

### Appendix B: Workflow Stage Details

*[Detailed specifications for each workflow stage - EDA, DAG, Identification, Estimation, Sensitivity, Reporting]*

### Appendix C: Validation Criteria Library

*[Complete validation rules for each stage]*

### Appendix D: Prompt Template Library

*[Full prompt templates for all agents and stages]*

### Appendix E: SDK Integration Examples

*[Code examples for CausalML, DoWhy, PyWhy integrations]*

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1 | Oct 22, 2025 | Product Team | Initial draft |
| 1.0 | TBD | Product Team | Final for development |

---

## Approval

**Product Manager**: ___________________ Date: ___________

**Engineering Lead**: ___________________ Date: ___________

**Design Lead**: ___________________ Date: ___________

**Stakeholder**: ___________________ Date: ___________

---

*End of PRD*
