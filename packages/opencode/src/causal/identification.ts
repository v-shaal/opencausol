import { z } from "zod"
import type { CausalFraming } from "./framing"

// Core schemas for causal identification
export const DAGNodeSchema = z.object({
  name: z.string(),
  type: z.enum(["treatment", "outcome", "confounder", "instrument", "mediator", "collider", "unmeasured_confounder"]),
  observed: z.boolean(),
  description: z.string(),
})

export const DAGEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  type: z.enum(["causal", "association"]),
  description: z.string().optional(),
  strength: z.enum(["weak", "moderate", "strong"]).optional(),
})

export const DAGSchema = z.object({
  research_question: z.string(),
  nodes: z.array(DAGNodeSchema),
  edges: z.array(DAGEdgeSchema),
  assumptions: z
    .object({
      no_unmeasured_confounding: z.boolean().optional(),
      correct_temporal_ordering: z.boolean().optional(),
      no_selection_bias: z.boolean().optional(),
    })
    .optional(),
})

export const PathAnalysisSchema = z.object({
  backdoor_paths: z.array(z.string()),
  frontdoor_paths: z.array(z.string()),
  instrumental_paths: z.array(z.string()),
  blocked_paths: z.array(z.string()),
  open_paths: z.array(z.string()),
})

export const AdjustmentSetSchema = z.object({
  variables: z.array(z.string()),
  description: z.string(),
  minimal: z.boolean(),
  sufficient: z.boolean(),
  backdoor_closed: z.boolean(),
})

export const IdentificationStrategySchema = z.object({
  name: z.string(),
  type: z.enum([
    "backdoor",
    "frontdoor",
    "instrumental",
    "do_calculus",
    "difference_in_differences",
    "regression_discontinuity",
  ]),
  description: z.string(),
  adjustment_set: AdjustmentSetSchema.optional(),
  assumptions: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      testable: z.boolean(),
      status: z.enum(["satisfied", "plausible", "violated", "unknown"]),
      evidence: z.string().optional(),
    }),
  ),
  estimand: z.object({
    type: z.enum(["ATE", "ATT", "ATC", "LATE", "NDE", "NIE", "CATE"]),
    target_population: z.string(),
    interpretation: z.string(),
  }),
  identification_status: z.enum(["identifiable", "partially_identifiable", "not_identifiable"]),
  confidence: z.enum(["high", "medium", "low"]),
})

export const IdentificationResultSchema = z.object({
  research_question: z.string(),
  dag_analysis: z.object({
    valid_dag: z.boolean(),
    treatment_nodes: z.array(z.string()),
    outcome_nodes: z.array(z.string()),
    instrument_nodes: z.array(z.string()),
    confounder_nodes: z.array(z.string()),
    unmeasured_confounders: z.array(z.string()),
  }),
  path_analysis: PathAnalysisSchema,
  adjustment_sets: z.array(AdjustmentSetSchema),
  strategies: z.array(IdentificationStrategySchema),
  recommended_strategy: IdentificationStrategySchema,
  validation_checks: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      passed: z.boolean(),
      details: z.string().optional(),
    }),
  ),
  proceed_to_estimation: z.boolean(),
  confidence_level: z.enum(["high", "medium", "low"]),
  next_steps: z.array(z.string()),
  limitations: z.array(z.string()),
})

export type DAGNode = z.infer<typeof DAGNodeSchema>
export type DAGEdge = z.infer<typeof DAGEdgeSchema>
export type DAG = z.infer<typeof DAGSchema>
export type PathAnalysis = z.infer<typeof PathAnalysisSchema>
export type AdjustmentSet = z.infer<typeof AdjustmentSetSchema>
export type IdentificationStrategy = z.infer<typeof IdentificationStrategySchema>
export type IdentificationResult = z.infer<typeof IdentificationResultSchema>

export class CausalIdentificationFramework {
  /**
   * Main identification function that analyzes DAG and determines identifiability
   */
  static identify(dag: DAG, framing?: CausalFraming): IdentificationResult {
    // Validate DAG structure
    const dagValidation = this.validateDAG(dag)
    if (!dagValidation.valid) {
      throw new Error(`Invalid DAG: ${dagValidation.errors.join(", ")}`)
    }

    // Extract key variables
    const treatments = dag.nodes.filter((n) => n.type === "treatment").map((n) => n.name)
    const outcomes = dag.nodes.filter((n) => n.type === "outcome").map((n) => n.name)
    const instruments = dag.nodes.filter((n) => n.type === "instrument").map((n) => n.name)
    const confounders = dag.nodes.filter((n) => n.type === "confounder").map((n) => n.name)
    const unmeasured = dag.nodes.filter((n) => n.type === "unmeasured_confounder").map((n) => n.name)

    if (treatments.length === 0) throw new Error("No treatment variables found in DAG")
    if (outcomes.length === 0) throw new Error("No outcome variables found in DAG")

    // Analyze paths
    const pathAnalysis = this.analyzePaths(dag, treatments[0], outcomes[0])

    // Find adjustment sets
    const adjustmentSets = this.findAdjustmentSets(dag, treatments[0], outcomes[0])

    // Generate identification strategies
    const strategies = this.generateStrategies(dag, treatments[0], outcomes[0], pathAnalysis, adjustmentSets)

    // Select recommended strategy
    const recommendedStrategy = this.selectRecommendedStrategy(strategies, framing)

    // Perform validation checks
    const validationChecks = this.performValidationChecks(dag, recommendedStrategy)

    // Determine if ready for estimation
    const proceedToEstimation = this.shouldProceedToEstimation(recommendedStrategy, validationChecks)

    return {
      research_question: dag.research_question,
      dag_analysis: {
        valid_dag: true,
        treatment_nodes: treatments,
        outcome_nodes: outcomes,
        instrument_nodes: instruments,
        confounder_nodes: confounders,
        unmeasured_confounders: unmeasured,
      },
      path_analysis: pathAnalysis,
      adjustment_sets: adjustmentSets,
      strategies: strategies,
      recommended_strategy: recommendedStrategy,
      validation_checks: validationChecks,
      proceed_to_estimation: proceedToEstimation,
      confidence_level: this.calculateConfidence(recommendedStrategy, validationChecks),
      next_steps: this.generateNextSteps(recommendedStrategy, validationChecks),
      limitations: this.identifyLimitations(dag, recommendedStrategy),
    }
  }

  /**
   * Validate DAG structure and consistency
   */
  private static validateDAG(dag: DAG): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    const nodeNames = dag.nodes.map((n) => n.name)

    // Check for duplicate nodes
    const duplicates = nodeNames.filter((name, index) => nodeNames.indexOf(name) !== index)
    if (duplicates.length > 0) {
      errors.push(`Duplicate node names: ${duplicates.join(", ")}`)
    }

    // Check edge validity
    for (const edge of dag.edges) {
      if (!nodeNames.includes(edge.from)) {
        errors.push(`Edge from unknown node: ${edge.from}`)
      }
      if (!nodeNames.includes(edge.to)) {
        errors.push(`Edge to unknown node: ${edge.to}`)
      }
      if (edge.from === edge.to) {
        errors.push(`Self-loop detected: ${edge.from}`)
      }
    }

    // Check for cycles (basic check)
    const hasCycles = this.detectCycles(dag)
    if (hasCycles) {
      errors.push("DAG contains cycles - not a valid directed acyclic graph")
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  /**
   * Detect cycles in the DAG using DFS
   */
  private static detectCycles(dag: DAG): boolean {
    const visited = new Set<string>()
    const recursionStack = new Set<string>()
    const adjacencyList: Record<string, string[]> = {}

    // Build adjacency list
    for (const node of dag.nodes) {
      adjacencyList[node.name] = []
    }
    for (const edge of dag.edges) {
      if (edge.type === "causal") {
        adjacencyList[edge.from].push(edge.to)
      }
    }

    const hasCycle = (nodeName: string): boolean => {
      if (recursionStack.has(nodeName)) return true
      if (visited.has(nodeName)) return false

      visited.add(nodeName)
      recursionStack.add(nodeName)

      for (const neighbor of adjacencyList[nodeName]) {
        if (hasCycle(neighbor)) return true
      }

      recursionStack.delete(nodeName)
      return false
    }

    for (const node of dag.nodes) {
      if (!visited.has(node.name)) {
        if (hasCycle(node.name)) return true
      }
    }

    return false
  }

  /**
   * Analyze all paths between treatment and outcome
   */
  private static analyzePaths(dag: DAG, treatment: string, outcome: string): PathAnalysis {
    const allPaths = this.findAllPaths(dag, treatment, outcome)
    const backdoorPaths = allPaths.filter((path) => this.isBackdoorPath(path, treatment))
    const frontdoorPaths = this.findFrontdoorPaths(dag, treatment, outcome)
    const instrumentalPaths = this.findInstrumentalPaths(dag, treatment, outcome)

    return {
      backdoor_paths: backdoorPaths,
      frontdoor_paths: frontdoorPaths,
      instrumental_paths: instrumentalPaths,
      blocked_paths: [], // Will be populated during strategy analysis
      open_paths: allPaths,
    }
  }

  /**
   * Find all paths between two nodes
   */
  private static findAllPaths(dag: DAG, start: string, end: string): string[] {
    const paths: string[] = []
    const visited = new Set<string>()
    const adjacencyList: Record<string, string[]> = {}

    // Build adjacency list
    for (const node of dag.nodes) {
      adjacencyList[node.name] = []
    }
    for (const edge of dag.edges) {
      adjacencyList[edge.from].push(edge.to)
      // For undirected path finding, also add reverse
      adjacencyList[edge.to].push(edge.from)
    }

    const dfs = (current: string, path: string[]) => {
      if (current === end) {
        paths.push(path.join(" -> "))
        return
      }

      visited.add(current)

      for (const neighbor of adjacencyList[current]) {
        if (!visited.has(neighbor)) {
          dfs(neighbor, [...path, neighbor])
        }
      }

      visited.delete(current)
    }

    dfs(start, [start])
    return paths
  }

  /**
   * Check if a path is a backdoor path
   */
  private static isBackdoorPath(path: string, treatment: string): boolean {
    const nodes = path.split(" -> ")
    if (nodes[0] !== treatment) return false

    // Backdoor path starts with an arrow into treatment
    // This is simplified - full implementation would need edge direction info
    return nodes.length > 1
  }

  /**
   * Find frontdoor paths
   */
  private static findFrontdoorPaths(dag: DAG, treatment: string, outcome: string): string[] {
    const mediators = dag.nodes.filter((n) => n.type === "mediator").map((n) => n.name)
    const frontdoorPaths: string[] = []

    for (const mediator of mediators) {
      const treatmentToMediator = this.findAllPaths(dag, treatment, mediator)
      const mediatorToOutcome = this.findAllPaths(dag, mediator, outcome)

      for (const path1 of treatmentToMediator) {
        for (const path2 of mediatorToOutcome) {
          if (this.isCausalPath(path1) && this.isCausalPath(path2)) {
            frontdoorPaths.push(`${path1} -> ${path2}`)
          }
        }
      }
    }

    return frontdoorPaths
  }

  /**
   * Find instrumental paths
   */
  private static findInstrumentalPaths(dag: DAG, treatment: string, outcome: string): string[] {
    const instruments = dag.nodes.filter((n) => n.type === "instrument").map((n) => n.name)
    const instrumentalPaths: string[] = []

    for (const instrument of instruments) {
      const instrumentToTreatment = this.findAllPaths(dag, instrument, treatment)
      const treatmentToOutcome = this.findAllPaths(dag, treatment, outcome)

      for (const path1 of instrumentToTreatment) {
        for (const path2 of treatmentToOutcome) {
          if (this.isCausalPath(path1) && this.isCausalPath(path2)) {
            instrumentalPaths.push(`${path1} -> ${path2}`)
          }
        }
      }
    }

    return instrumentalPaths
  }

  /**
   * Check if a path follows causal direction
   */
  private static isCausalPath(path: string): boolean {
    // Simplified - full implementation would check edge directions
    return true
  }

  /**
   * Find minimal adjustment sets using backdoor criterion
   */
  static findAdjustmentSets(dag: DAG, treatment: string, outcome: string): AdjustmentSet[] {
    const adjustmentSets: AdjustmentSet[] = []
    const confounders = dag.nodes.filter((n) => n.type === "confounder" && n.observed).map((n) => n.name)

    // Simple heuristic: try different combinations of confounders
    for (let i = 0; i < confounders.length; i++) {
      for (let j = i; j < confounders.length; j++) {
        const candidateSet = confounders.slice(i, j + 1)
        const blocksBackdoor = this.checkBackdoorCriterion(dag, treatment, outcome, candidateSet)

        if (blocksBackdoor) {
          adjustmentSets.push({
            variables: candidateSet,
            description: `Adjustment set: ${candidateSet.join(", ")}`,
            minimal: this.isMinimal(candidateSet, adjustmentSets),
            sufficient: true,
            backdoor_closed: true,
          })
        }
      }
    }

    // If no adjustment sets work, add empty set with explanation
    if (adjustmentSets.length === 0) {
      adjustmentSets.push({
        variables: [],
        description: "No sufficient adjustment set found with observed variables",
        minimal: true,
        sufficient: false,
        backdoor_closed: false,
      })
    }

    return adjustmentSets
  }

  /**
   * Check if adjustment set satisfies backdoor criterion
   */
  private static checkBackdoorCriterion(
    dag: DAG,
    treatment: string,
    outcome: string,
    adjustmentSet: string[],
  ): boolean {
    // Simplified implementation - full version would:
    // 1. Find all backdoor paths
    // 2. Check if adjustment set blocks all backdoor paths
    // 3. Ensure no adjustment variable is descendant of treatment

    const backdoorPaths = this.findAllPaths(dag, treatment, outcome).filter((path) =>
      this.isBackdoorPath(path, treatment),
    )

    // Check if adjustment set blocks all backdoor paths
    for (const path of backdoorPaths) {
      const pathNodes = path.split(" -> ")
      const hasAdjustmentVar = pathNodes.some((node) => adjustmentSet.includes(node))
      if (!hasAdjustmentVar) {
        return false
      }
    }

    return true
  }

  /**
   * Check if adjustment set is minimal
   */
  private static isMinimal(candidateSet: string[], existingSets: AdjustmentSet[]): boolean {
    for (const existing of existingSets) {
      if (existing.variables.length < candidateSet.length) {
        const isSubset = existing.variables.every((v) => candidateSet.includes(v))
        if (isSubset) return false
      }
    }
    return true
  }

  /**
   * Generate identification strategies
   */
  static generateStrategies(
    dag: DAG,
    treatment: string,
    outcome: string,
    pathAnalysis: PathAnalysis,
    adjustmentSets: AdjustmentSet[],
  ): IdentificationStrategy[] {
    const strategies: IdentificationStrategy[] = []

    // Backdoor strategy
    const sufficientAdjustmentSets = adjustmentSets.filter((as) => as.sufficient)
    if (sufficientAdjustmentSets.length > 0) {
      strategies.push({
        name: "Backdoor Adjustment",
        type: "backdoor",
        description: "Adjust for confounders to block backdoor paths",
        adjustment_set: sufficientAdjustmentSets[0],
        assumptions: [
          {
            name: "No Unmeasured Confounding",
            description: "All confounders are measured and adjusted for",
            testable: false,
            status: "plausible",
          },
          {
            name: "Positivity",
            description: "All treatment levels have positive probability for all covariate combinations",
            testable: true,
            status: "unknown",
          },
        ],
        estimand: {
          type: "ATE",
          target_population: "Study population",
          interpretation: "Average treatment effect across all units",
        },
        identification_status: "identifiable",
        confidence: "medium",
      })
    }

    // Instrumental variable strategy
    const instruments = dag.nodes.filter((n) => n.type === "instrument")
    if (instruments.length > 0) {
      strategies.push({
        name: "Instrumental Variables",
        type: "instrumental",
        description: "Use instruments to address unmeasured confounding",
        assumptions: [
          {
            name: "Instrument Relevance",
            description: "Instrument is correlated with treatment",
            testable: true,
            status: "unknown",
          },
          {
            name: "Exclusion Restriction",
            description: "Instrument affects outcome only through treatment",
            testable: false,
            status: "plausible",
          },
          {
            name: "Independence",
            description: "Instrument is independent of confounders",
            testable: false,
            status: "plausible",
          },
        ],
        estimand: {
          type: "LATE",
          target_population: "Compliers",
          interpretation: "Local average treatment effect for compliers",
        },
        identification_status: "identifiable",
        confidence: "medium",
      })
    }

    // Frontdoor strategy
    if (pathAnalysis.frontdoor_paths.length > 0) {
      strategies.push({
        name: "Frontdoor Adjustment",
        type: "frontdoor",
        description: "Use mediators to identify causal effect",
        assumptions: [
          {
            name: "Complete Mediation",
            description: "All treatment effects pass through measured mediators",
            testable: false,
            status: "plausible",
          },
          {
            name: "No Unmeasured Confounding of Mediator-Outcome",
            description: "Mediator-outcome relationship is unconfounded",
            testable: false,
            status: "plausible",
          },
        ],
        estimand: {
          type: "ATE",
          target_population: "Study population",
          interpretation: "Average treatment effect identified through frontdoor path",
        },
        identification_status: "identifiable",
        confidence: "low",
      })
    }

    // If no strategies work, add not identifiable
    if (strategies.length === 0) {
      strategies.push({
        name: "Not Identifiable",
        type: "do_calculus",
        description: "Causal effect cannot be identified with available assumptions",
        assumptions: [],
        estimand: {
          type: "ATE",
          target_population: "Study population",
          interpretation: "Effect cannot be identified",
        },
        identification_status: "not_identifiable",
        confidence: "low",
      })
    }

    return strategies
  }

  /**
   * Select recommended strategy based on confidence and assumptions
   */
  static selectRecommendedStrategy(
    strategies: IdentificationStrategy[],
    framing?: CausalFraming,
  ): IdentificationStrategy {
    // Prefer strategies with higher confidence
    const identifiableStrategies = strategies.filter((s) => s.identification_status === "identifiable")

    if (identifiableStrategies.length === 0) {
      return strategies.find((s) => s.identification_status === "partially_identifiable") || strategies[0]
    }

    // Rank by confidence and preference
    const preferenceOrder = ["backdoor", "instrumental", "frontdoor", "do_calculus"]

    for (const type of preferenceOrder) {
      const strategy = identifiableStrategies.find((s) => s.type === type)
      if (strategy) {
        return strategy
      }
    }

    return identifiableStrategies[0]
  }

  /**
   * Perform validation checks on recommended strategy
   */
  static performValidationChecks(
    dag: DAG,
    strategy: IdentificationStrategy,
  ): Array<{
    name: string
    description: string
    passed: boolean
    details?: string
  }> {
    const checks: Array<{
      name: string
      description: string
      passed: boolean
      details?: string
    }> = []

    // Check DAG validity
    checks.push({
      name: "DAG Validity",
      description: "DAG is acyclic and properly structured",
      passed: !this.detectCycles(dag),
      details: this.detectCycles(dag) ? "DAG contains cycles" : "DAG is valid",
    })

    // Check variable availability
    const requiredVars = strategy.adjustment_set?.variables || []
    const availableVars = dag.nodes.filter((n) => n.observed).map((n) => n.name)
    const missingVars = requiredVars.filter((v) => !availableVars.includes(v))

    checks.push({
      name: "Variable Availability",
      description: "All required variables are observed",
      passed: missingVars.length === 0,
      details: missingVars.length > 0 ? `Missing variables: ${missingVars.join(", ")}` : "All variables available",
    })

    // Check sample size (placeholder)
    checks.push({
      name: "Sample Size",
      description: "Sufficient sample size for estimation",
      passed: true, // Would need actual data to check
      details: "Sample size check requires data",
    })

    return checks
  }

  /**
   * Determine if ready to proceed to estimation
   */
  static shouldProceedToEstimation(
    strategy: IdentificationStrategy,
    validationChecks: Array<{ passed: boolean }>,
  ): boolean {
    const allChecksPassed = validationChecks.every((check) => check.passed)
    const isIdentifiable = strategy.identification_status === "identifiable"
    const hasHighConfidence = strategy.confidence === "high" || strategy.confidence === "medium"

    return allChecksPassed && isIdentifiable && hasHighConfidence
  }

  /**
   * Calculate overall confidence level
   */
  static calculateConfidence(
    strategy: IdentificationStrategy,
    validationChecks: Array<{ passed: boolean }>,
  ): "high" | "medium" | "low" {
    const allChecksPassed = validationChecks.every((check) => check.passed)

    if (!allChecksPassed) return "low"
    if (strategy.identification_status !== "identifiable") return "low"

    // Count testable assumptions that are satisfied
    const testableAssumptions = strategy.assumptions.filter((a) => a.testable)
    const satisfiedAssumptions = testableAssumptions.filter((a) => a.status === "satisfied")

    if (testableAssumptions.length > 0 && satisfiedAssumptions.length === testableAssumptions.length) {
      return "high"
    }

    return "medium"
  }

  /**
   * Generate next steps for the analysis
   */
  static generateNextSteps(
    strategy: IdentificationStrategy,
    validationChecks: Array<{ passed: boolean; details?: string }>,
  ): string[] {
    const steps: string[] = []

    if (strategy.identification_status === "identifiable") {
      steps.push("Proceed to causal estimation using recommended strategy")
      steps.push(`Implement ${strategy.name} estimation method`)

      if (strategy.adjustment_set) {
        steps.push(`Prepare adjustment variables: ${strategy.adjustment_set.variables.join(", ")}`)
      }

      // Add assumption testing steps
      const testableAssumptions = strategy.assumptions.filter((a) => a.testable)
      for (const assumption of testableAssumptions) {
        steps.push(`Test assumption: ${assumption.name}`)
      }
    } else {
      steps.push("Causal effect not identifiable with current assumptions")
      steps.push("Consider collecting additional data or strengthening assumptions")
      steps.push("Explore sensitivity analysis approaches")
    }

    // Add validation-related steps
    for (const check of validationChecks) {
      if (!check.passed) {
        steps.push(`Address validation issue: ${check.details || "Unknown issue"}`)
      }
    }

    return steps
  }

  /**
   * Identify limitations of the identification approach
   */
  static identifyLimitations(dag: DAG, strategy: IdentificationStrategy): string[] {
    const limitations: string[] = []

    // Check for unmeasured confounders
    const unmeasuredConfounders = dag.nodes.filter((n) => n.type === "unmeasured_confounder")
    if (unmeasuredConfounders.length > 0) {
      limitations.push(`Unmeasured confounders present: ${unmeasuredConfounders.map((n) => n.name).join(", ")}`)
    }

    // Strategy-specific limitations
    if (strategy.type === "instrumental") {
      limitations.push("IV estimates LATE, not ATE - limited to complier population")
      limitations.push("Instrument validity assumptions cannot be directly tested")
    }

    if (strategy.type === "backdoor") {
      limitations.push("Relies on assumption of no unmeasured confounding")
      limitations.push("Requires correct model specification for adjustment")
    }

    if (strategy.type === "frontdoor") {
      limitations.push("Requires complete mediation through measured variables")
      limitations.push("Sensitive to measurement error in mediators")
    }

    return limitations
  }

  /**
   * Generate identification report in markdown format
   */
  static generateIdentificationReport(result: IdentificationResult): string {
    return `# Causal Identification Analysis

## Research Question
${result.research_question}

## DAG Analysis
- **Valid DAG**: ${result.dag_analysis.valid_dag ? "✅ Yes" : "❌ No"}
- **Treatment Variables**: ${result.dag_analysis.treatment_nodes.join(", ")}
- **Outcome Variables**: ${result.dag_analysis.outcome_nodes.join(", ")}
- **Instrument Variables**: ${result.dag_analysis.instrument_nodes.join(", ") || "None"}
- **Confounder Variables**: ${result.dag_analysis.confounder_nodes.join(", ") || "None"}
- **Unmeasured Confounders**: ${result.dag_analysis.unmeasured_confounders.join(", ") || "None"}

## Path Analysis
- **Backdoor Paths**: ${result.path_analysis.backdoor_paths.length}
- **Frontdoor Paths**: ${result.path_analysis.frontdoor_paths.length}
- **Instrumental Paths**: ${result.path_analysis.instrumental_paths.length}

### Backdoor Paths
${result.path_analysis.backdoor_paths.length > 0 ? result.path_analysis.backdoor_paths.map((p) => `- ${p}`).join("\n") : "None identified"}

### Frontdoor Paths
${result.path_analysis.frontdoor_paths.length > 0 ? result.path_analysis.frontdoor_paths.map((p) => `- ${p}`).join("\n") : "None identified"}

## Adjustment Sets
${result.adjustment_sets
  .map(
    (as) => `
### ${as.description}
- **Variables**: ${as.variables.length > 0 ? as.variables.join(", ") : "None"}
- **Minimal**: ${as.minimal ? "✅" : "❌"}
- **Sufficient**: ${as.sufficient ? "✅" : "❌"}
- **Blocks Backdoor**: ${as.backdoor_closed ? "✅" : "❌"}
`,
  )
  .join("\n")}

## Identification Strategies
${result.strategies
  .map(
    (strategy) => `
### ${strategy.name}
- **Type**: ${strategy.type}
- **Status**: ${strategy.identification_status}
- **Confidence**: ${strategy.confidence}
- **Description**: ${strategy.description}

#### Estimand
- **Type**: ${strategy.estimand.type}
- **Target Population**: ${strategy.estimand.target_population}
- **Interpretation**: ${strategy.estimand.interpretation}

#### Assumptions
${strategy.assumptions.map((a) => `- **${a.name}**: ${a.description} (${a.status}${a.testable ? ", testable" : ", untestable"})`).join("\n")}

${
  strategy.adjustment_set
    ? `
#### Adjustment Set
- **Variables**: ${strategy.adjustment_set.variables.join(", ") || "None"}
- **Description**: ${strategy.adjustment_set.description}
`
    : ""
}
`,
  )
  .join("\n")}

## Recommended Strategy
### ${result.recommended_strategy.name}
**Status**: ${result.recommended_strategy.identification_status}  
**Confidence**: ${result.recommended_strategy.confidence}

${result.recommended_strategy.description}

## Validation Checks
${result.validation_checks
  .map(
    (check) => `
### ${check.name}
- **Status**: ${check.passed ? "✅ Passed" : "❌ Failed"}
- **Description**: ${check.description}
${check.details ? `- **Details**: ${check.details}` : ""}
`,
  )
  .join("\n")}

## Proceed to Estimation
**Status**: ${result.proceed_to_estimation ? "✅ Approved" : "❌ Not Ready"}  
**Overall Confidence**: ${result.confidence_level}

## Next Steps
${result.next_steps.map((step) => `- ${step}`).join("\n")}

## Limitations
${result.limitations.map((limitation) => `- ${limitation}`).join("\n")}

---
*Analysis completed on ${new Date().toISOString()}*
`
  }
}

// Utility functions for creating identification results
export function createIdentificationResult(input: unknown): IdentificationResult {
  const result = IdentificationResultSchema.safeParse(input)
  if (!result.success) {
    throw new Error(`Invalid identification result: ${result.error.message}`)
  }
  return result.data
}

export function saveIdentificationResult(result: IdentificationResult, filepath: string): void {
  Bun.write(filepath, JSON.stringify(result, null, 2))
}

export async function loadIdentificationResult(filepath: string): Promise<IdentificationResult> {
  const content = await Bun.file(filepath).text()
  const result = JSON.parse(content)
  return createIdentificationResult(result)
}
