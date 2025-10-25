import { Tool } from "../tool/tool"
import { z } from "zod"
import {
  CausalIdentificationFramework,
  createIdentificationResult,
  saveIdentificationResult,
  loadIdentificationResult,
  type IdentificationResult,
  type DAG,
} from "./identification"

const IdentifyFromDAGSchema = z.object({
  dag: z.any(), // Will be validated against DAG schema
  framing: z.any().optional(), // Optional framing for context
  save_path: z.string().optional(),
})

const LoadIdentificationResultSchema = z.object({
  filepath: z.string(),
})

const ValidateIdentificationResultSchema = z.object({
  result: z.any(), // Will be validated against IdentificationResult schema
})

const GenerateReportSchema = z.object({
  result: z.any(), // Will be validated against IdentificationResult schema
  output_path: z.string().optional(),
})

const AnalyzeAdjustmentSetsSchema = z.object({
  dag: z.any(),
  treatment: z.string(),
  outcome: z.string(),
})

const TestInstrumentValiditySchema = z.object({
  dag: z.any(),
  instrument: z.string(),
  treatment: z.string(),
  outcome: z.string(),
})

export const CausalIdentificationTool = Tool.define("causal_identification", async () => ({
  description: "Analyze DAGs and determine causal identifiability with appropriate strategies",
  parameters: z.object({
    action: z.enum([
      "identify",
      "load",
      "validate",
      "generate_report",
      "analyze_adjustment_sets",
      "test_instrument_validity",
      "list_strategies",
    ]),
    input: z.any().optional(),
  }),
  execute: async ({ action, input }: { action: string; input?: unknown }, ctx) => {
    let result
    switch (action) {
      case "identify":
        result = await identifyFromDAG(input)
        break
      case "load":
        result = await loadIdentification(input)
        break
      case "validate":
        result = await validateIdentification(input)
        break
      case "generate_report":
        result = await generateReport(input)
        break
      case "analyze_adjustment_sets":
        result = await analyzeAdjustmentSets(input)
        break
      case "test_instrument_validity":
        result = await testInstrumentValidity(input)
        break
      case "list_strategies":
        result = listIdentificationStrategies()
        break
      default:
        throw new Error(`Unknown action: ${action}`)
    }

    return {
      title: `Causal Identification: ${action}`,
      metadata: {},
      output: JSON.stringify(result, null, 2),
    }
  },
}))

async function identifyFromDAG(input: unknown) {
  const params = IdentifyFromDAGSchema.parse(input)

  try {
    const dag = createDAG(params.dag)
    const result = CausalIdentificationFramework.identify(dag, params.framing)

    // Save if path provided
    if (params.save_path) {
      saveIdentificationResult(result, params.save_path)
    }

    return {
      success: true,
      identification_result: result,
      report: CausalIdentificationFramework.generateIdentificationReport(result),
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error during identification",
    }
  }
}

async function loadIdentification(input: unknown) {
  const params = LoadIdentificationResultSchema.parse(input)

  try {
    const result = await loadIdentificationResult(params.filepath)

    return {
      success: true,
      identification_result: result,
      report: CausalIdentificationFramework.generateIdentificationReport(result),
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error loading identification result",
    }
  }
}

async function validateIdentification(input: unknown) {
  const params = ValidateIdentificationResultSchema.parse(input)

  try {
    const result = createIdentificationResult(params.result)

    // Perform additional validation checks
    const validationChecks = performAdditionalValidation(result)

    return {
      success: true,
      identification_result: result,
      validation_checks: validationChecks,
      valid: validationChecks.every((check) => check.passed),
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error validating identification result",
    }
  }
}

async function generateReport(input: unknown) {
  const params = GenerateReportSchema.parse(input)

  try {
    const result = createIdentificationResult(params.result)
    const report = CausalIdentificationFramework.generateIdentificationReport(result)

    if (params.output_path) {
      await Bun.write(params.output_path, report)
    }

    return {
      success: true,
      report,
      output_path: params.output_path,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error generating report",
    }
  }
}

async function analyzeAdjustmentSets(input: unknown) {
  const params = AnalyzeAdjustmentSetsSchema.parse(input)

  try {
    const dag = createDAG(params.dag)
    const adjustmentSets = CausalIdentificationFramework.findAdjustmentSets(dag, params.treatment, params.outcome)

    return {
      success: true,
      treatment: params.treatment,
      outcome: params.outcome,
      adjustment_sets: adjustmentSets,
      minimal_sets: adjustmentSets.filter((as) => as.minimal),
      sufficient_sets: adjustmentSets.filter((as) => as.sufficient),
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error analyzing adjustment sets",
    }
  }
}

async function testInstrumentValidity(input: unknown) {
  const params = TestInstrumentValiditySchema.parse(input)

  try {
    const dag = createDAG(params.dag)
    const validityTests = performInstrumentValidityTests(dag, params.instrument, params.treatment, params.outcome)

    return {
      success: true,
      instrument: params.instrument,
      treatment: params.treatment,
      outcome: params.outcome,
      validity_tests: validityTests,
      is_valid: validityTests.every((test) => test.passed),
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error testing instrument validity",
    }
  }
}

function listIdentificationStrategies() {
  return {
    success: true,
    strategies: [
      {
        name: "Backdoor Adjustment",
        type: "backdoor",
        description: "Adjust for confounders to block backdoor paths between treatment and outcome",
        requirements: [
          "All confounders must be measured",
          "No unmeasured confounding",
          "Positivity assumption must hold",
          "Correct model specification",
        ],
        estimand: "ATE (Average Treatment Effect)",
        confidence: "Medium to High (if assumptions hold)",
        common_use_cases: [
          "Observational studies with rich covariate data",
          "Healthcare research with comprehensive patient records",
          "Economic studies with detailed demographic and economic data",
        ],
      },
      {
        name: "Instrumental Variables",
        type: "instrumental",
        description: "Use instrumental variable to address unmeasured confounding",
        requirements: [
          "Valid instrument available",
          "Instrument relevance (correlation with treatment)",
          "Exclusion restriction (no direct effect on outcome)",
          "Independence from confounders",
        ],
        estimand: "LATE (Local Average Treatment Effect)",
        confidence: "Medium (depends on instrument validity)",
        common_use_cases: [
          "Economics with natural experiments",
          "Education research with random assignment",
          "Policy evaluation with eligibility criteria",
        ],
      },
      {
        name: "Frontdoor Adjustment",
        type: "frontdoor",
        description: "Use mediators to identify causal effect when backdoor is blocked",
        requirements: [
          "Complete mediation through measured variables",
          "No unmeasured confounding of mediator-outcome",
          "All mediators must be measured",
          "Treatment affects mediators",
        ],
        estimand: "ATE (Average Treatment Effect)",
        confidence: "Low to Medium (strong assumptions)",
        common_use_cases: [
          "Psychology research with mediators",
          "Marketing studies with consumer behavior",
          "Social science with mechanism analysis",
        ],
      },
      {
        name: "Difference-in-Differences",
        type: "difference_in_differences",
        description: "Compare changes over time between treatment and control groups",
        requirements: [
          "Panel data with pre- and post-treatment periods",
          "Parallel trends assumption",
          "No anticipation effects",
          "Stable unit treatment value",
        ],
        estimand: "ATT (Average Treatment Effect on Treated)",
        confidence: "Medium (depends on parallel trends)",
        common_use_cases: [
          "Policy evaluation with implementation dates",
          "Economic impact studies",
          "Labor market research with policy changes",
        ],
      },
      {
        name: "Regression Discontinuity",
        type: "regression_discontinuity",
        description: "Exploit threshold-based treatment assignment",
        requirements: [
          "Clear treatment assignment threshold",
          "Continuous running variable",
          "No precise manipulation of running variable",
          "Local randomization around threshold",
        ],
        estimand: "LATE (Local Average Treatment Effect at threshold)",
        confidence: "High (if assumptions hold)",
        common_use_cases: [
          "Education research with test score thresholds",
          "Healthcare with clinical cutoffs",
          "Social programs with eligibility thresholds",
        ],
      },
    ],
  }
}

// Helper functions

function createDAG(input: unknown): DAG {
  // This would validate against DAG schema
  // For now, just return the input as DAG
  return input as DAG
}

function performAdditionalValidation(result: IdentificationResult): Array<{
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

  // Check if recommended strategy is identifiable
  checks.push({
    name: "Identifiability",
    description: "Recommended strategy can identify causal effect",
    passed: result.recommended_strategy.identification_status === "identifiable",
    details: result.recommended_strategy.identification_status,
  })

  // Check confidence level
  checks.push({
    name: "Confidence Level",
    description: "Overall confidence in identification",
    passed: result.confidence_level !== "low",
    details: `Confidence: ${result.confidence_level}`,
  })

  // Check if ready for estimation
  checks.push({
    name: "Ready for Estimation",
    description: "All validation checks passed",
    passed: result.proceed_to_estimation,
    details: result.proceed_to_estimation ? "Ready to proceed" : "Issues need to be addressed",
  })

  return checks
}

function performInstrumentValidityTests(
  dag: DAG,
  instrument: string,
  treatment: string,
  outcome: string,
): Array<{
  name: string
  description: string
  passed: boolean
  details?: string
}> {
  const tests: Array<{
    name: string
    description: string
    passed: boolean
    details?: string
  }> = []

  // Check if instrument exists
  const instrumentNode = dag.nodes.find((n) => n.name === instrument)
  tests.push({
    name: "Instrument Exists",
    description: "Instrument variable is present in DAG",
    passed: !!instrumentNode,
    details: instrumentNode ? `Found: ${instrumentNode.type}` : "Not found",
  })

  // Check if instrument is observed
  tests.push({
    name: "Instrument Observed",
    description: "Instrument variable is observed/measured",
    passed: instrumentNode?.observed || false,
    details: instrumentNode ? (instrumentNode.observed ? "Observed" : "Unobserved") : "Not found",
  })

  // Check for path from instrument to treatment
  const hasPathToTreatment = checkPathExists(dag, instrument, treatment)
  tests.push({
    name: "Relevance",
    description: "Instrument affects treatment",
    passed: hasPathToTreatment,
    details: hasPathToTreatment ? "Path exists" : "No path found",
  })

  // Check for direct path from instrument to outcome (should not exist for exclusion)
  const hasDirectPathToOutcome = checkDirectPathExists(dag, instrument, outcome)
  tests.push({
    name: "Exclusion Restriction",
    description: "No direct effect of instrument on outcome",
    passed: !hasDirectPathToOutcome,
    details: hasDirectPathToOutcome
      ? "Direct path exists (violates exclusion)"
      : "No direct path (satisfies exclusion)",
  })

  return tests
}

function checkPathExists(dag: DAG, from: string, to: string): boolean {
  const visited = new Set<string>()
  const adjacencyList: Record<string, string[]> = {}

  // Build adjacency list
  for (const node of dag.nodes) {
    adjacencyList[node.name] = []
  }
  for (const edge of dag.edges) {
    adjacencyList[edge.from].push(edge.to)
  }

  const dfs = (current: string): boolean => {
    if (current === to) return true
    if (visited.has(current)) return false

    visited.add(current)
    for (const neighbor of adjacencyList[current]) {
      if (dfs(neighbor)) return true
    }
    return false
  }

  return dfs(from)
}

function checkDirectPathExists(dag: DAG, from: string, to: string): boolean {
  return dag.edges.some((edge) => edge.from === from && edge.to === to)
}
