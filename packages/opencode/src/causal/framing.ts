import { z } from "zod"

// Core schemas for causal framing
export const VariableSchema = z.object({
  name: z.string(),
  type: z.enum(["binary", "continuous", "categorical", "count", "time_to_event"]),
  description: z.string(),
  role: z.enum(["treatment", "outcome", "covariate", "instrument", "mediator", "moderator"]),
  measurement: z.string().optional(),
  validation: z
    .object({
      range: z.tuple([z.number(), z.number()]).optional(),
      categories: z.array(z.string()).optional(),
      required: z.boolean().default(true),
    })
    .optional(),
})

export const EstimandSchema = z.object({
  type: z.enum(["ATE", "ATT", "ATC", "CATE", "NDE", "NIE", "LATE"]),
  description: z.string(),
  target_population: z.string(),
  treatment_levels: z.array(z.string()).optional(),
  outcome_scale: z.enum(["difference", "ratio", "odds_ratio"]).optional(),
  conditions: z.string().optional(),
})

export const AssumptionSchema = z.object({
  name: z.string(),
  description: z.string(),
  type: z.enum(["identifiability", "statistical", "structural"]),
  status: z.enum(["assumed", "testable", "violated", "unknown"]),
  test_method: z.string().optional(),
  rationale: z.string().optional(),
})

export const StudyDesignSchema = z.object({
  type: z.enum(["observational", "RCT", "quasi_experimental", "natural_experiment", "instrumental"]),
  description: z.string(),
  assignment_mechanism: z.string().optional(),
  data_collection_method: z.string().optional(),
  temporal_structure: z.enum(["cross_sectional", "longitudinal", "time_series", "panel"]),
})

export const ValidationCriteriaSchema = z.object({
  name: z.string(),
  description: z.string(),
  threshold: z.union([z.number(), z.string()]).optional(),
  test: z.string().optional(),
  required: z.boolean().default(true),
})

export const CausalFramingSchema = z.object({
  research_question: z.string(),
  background: z.string().optional(),
  variables: z.array(VariableSchema),
  estimand: EstimandSchema,
  study_design: StudyDesignSchema,
  assumptions: z.array(AssumptionSchema),
  validation_criteria: z.array(ValidationCriteriaSchema),
  data_requirements: z.object({
    sample_size: z.number().optional(),
    time_periods: z.number().optional(),
    required_variables: z.array(z.string()),
    data_structure: z.string().optional(),
  }),
  limitations: z.array(z.string()).optional(),
  created_at: z.string().default(() => new Date().toISOString()),
  updated_at: z.string().default(() => new Date().toISOString()),
})

export type Variable = z.infer<typeof VariableSchema>
export type Estimand = z.infer<typeof EstimandSchema>
export type Assumption = z.infer<typeof AssumptionSchema>
export type StudyDesign = z.infer<typeof StudyDesignSchema>
export type ValidationCriteria = z.infer<typeof ValidationCriteriaSchema>
export type CausalFraming = z.infer<typeof CausalFramingSchema>

// Template generators for common scenarios
export class CausalFramingFramework {
  static createTemplate(
    scenario: "observational" | "RCT" | "instrumental" | "difference_in_differences",
  ): Partial<CausalFraming> {
    switch (scenario) {
      case "observational":
        return this.createObservationalTemplate()
      case "RCT":
        return this.createRCTTemplate()
      case "instrumental":
        return this.createInstrumentalTemplate()
      case "difference_in_differences":
        return this.createDifferenceInDifferencesTemplate()
      default:
        throw new Error(`Unknown scenario: ${scenario}`)
    }
  }

  private static createObservationalTemplate(): Partial<CausalFraming> {
    return {
      study_design: {
        type: "observational",
        description: "Observational study where treatment assignment is not controlled by researcher",
        assignment_mechanism: "Natural or self-selection",
        data_collection_method: "Retrospective or prospective data collection",
        temporal_structure: "cross_sectional",
      },
      assumptions: [
        {
          name: "Conditional Independence",
          description: "Treatment assignment is independent of potential outcomes given covariates",
          type: "identifiability",
          status: "assumed",
          test_method: "Balance tests, sensitivity analysis",
          rationale: "Required for identifying causal effect from observational data",
        },
        {
          name: "Positivity",
          description: "Every covariate combination has non-zero probability of receiving each treatment level",
          type: "identifiability",
          status: "testable",
          test_method: "Propensity score distribution analysis",
          rationale: "Ensures overlap between treatment groups",
        },
        {
          name: "Consistency",
          description: "Potential outcome under observed treatment equals observed outcome",
          type: "structural",
          status: "assumed",
          rationale: "Links potential outcomes to observed data",
        },
      ],
      validation_criteria: [
        {
          name: "Covariate Balance",
          description: "Standardized mean differences < 0.1 after adjustment",
          threshold: 0.1,
          test: "Standardized mean difference calculation",
          required: true,
        },
        {
          name: "Overlap Assessment",
          description: "Propensity scores between 0.1 and 0.9 for all units",
          threshold: "0.1-0.9",
          test: "Propensity score histogram",
          required: true,
        },
      ],
    }
  }

  private static createRCTTemplate(): Partial<CausalFraming> {
    return {
      study_design: {
        type: "RCT",
        description: "Randomized controlled trial with random treatment assignment",
        assignment_mechanism: "Random assignment",
        data_collection_method: "Prospective data collection",
        temporal_structure: "longitudinal",
      },
      assumptions: [
        {
          name: "Random Assignment",
          description: "Treatment is randomly assigned independent of potential outcomes",
          type: "identifiability",
          status: "assumed",
          test_method: "Baseline balance tests",
          rationale: "Randomization ensures unbiased estimation",
        },
        {
          name: "No Interference",
          description: "One unit's treatment does not affect another's outcome",
          type: "identifiability",
          status: "assumed",
          rationale: "Required for SUTVA assumption",
        },
        {
          name: "Compliance",
          description: "Participants adhere to assigned treatment",
          type: "statistical",
          status: "testable",
          test_method: "Compliance rate calculation",
          rationale: "Non-compliance requires intention-to-treat analysis",
        },
      ],
      validation_criteria: [
        {
          name: "Randomization Check",
          description: "No significant baseline differences between groups",
          threshold: "p > 0.05",
          test: "Baseline balance tests",
          required: true,
        },
        {
          name: "Attrition Analysis",
          description: "Differential attrition < 5%",
          threshold: 0.05,
          test: "Attrition rate comparison",
          required: true,
        },
      ],
    }
  }

  private static createInstrumentalTemplate(): Partial<CausalFraming> {
    return {
      study_design: {
        type: "instrumental",
        description: "Study using instrumental variable to address unmeasured confounding",
        assignment_mechanism: "Instrument-induced variation",
        data_collection_method: "Observational data with valid instrument",
        temporal_structure: "cross_sectional",
      },
      assumptions: [
        {
          name: "Instrument Relevance",
          description: "Instrument is correlated with treatment assignment",
          type: "identifiability",
          status: "testable",
          test_method: "F-statistic > 10 in first stage",
          rationale: "Weak instruments produce biased estimates",
        },
        {
          name: "Instrument Exclusion",
          description: "Instrument affects outcome only through treatment",
          type: "identifiability",
          status: "assumed",
          test_method: "Overidentification tests (if multiple instruments)",
          rationale: "Core identifying assumption",
        },
        {
          name: "Independence",
          description: "Instrument is independent of confounders",
          type: "identifiability",
          status: "assumed",
          rationale: "Required for valid IV estimation",
        },
      ],
      validation_criteria: [
        {
          name: "First Stage F-statistic",
          description: "F-statistic > 10 for strong instrument",
          threshold: 10,
          test: "First stage regression",
          required: true,
        },
        {
          name: "Overidentification Test",
          description: "Hansen J test p-value > 0.05 (if multiple instruments)",
          threshold: "p > 0.05",
          test: "Hansen J test",
          required: false,
        },
      ],
    }
  }

  private static createDifferenceInDifferencesTemplate(): Partial<CausalFraming> {
    return {
      study_design: {
        type: "quasi_experimental",
        description: "Difference-in-differences design comparing treatment and control over time",
        assignment_mechanism: "Policy change or intervention",
        data_collection_method: "Panel data collection",
        temporal_structure: "panel",
      },
      assumptions: [
        {
          name: "Parallel Trends",
          description: "Treatment and control groups would have followed parallel trends without treatment",
          type: "identifiability",
          status: "testable",
          test_method: "Pre-treatment trend analysis",
          rationale: "Core identifying assumption for DiD",
        },
        {
          name: "No Anticipation",
          description: "No behavioral changes before treatment implementation",
          type: "identifiability",
          status: "assumed",
          rationale: "Prevents bias from anticipation effects",
        },
        {
          name: "Stable Unit Treatment Value",
          description: "No spillovers between treatment and control units",
          type: "identifiability",
          status: "assumed",
          rationale: "SUTVA assumption",
        },
      ],
      validation_criteria: [
        {
          name: "Pre-treatment Trends",
          description: "No significant differences in pre-treatment trends",
          threshold: "p > 0.05 for trend interaction",
          test: "Event study regression",
          required: true,
        },
        {
          name: "Placebo Test",
          description: "No effect in pre-treatment periods",
          threshold: "p > 0.05 for placebo effects",
          test: "Placebo DiD estimation",
          required: true,
        },
      ],
    }
  }

  static validateFraming(framing: CausalFraming): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    // Check if we have at least one treatment and one outcome variable
    const treatments = framing.variables.filter((v) => v.role === "treatment")
    const outcomes = framing.variables.filter((v) => v.role === "outcome")

    if (treatments.length === 0) {
      errors.push("At least one treatment variable must be specified")
    }

    if (outcomes.length === 0) {
      errors.push("At least one outcome variable must be specified")
    }

    // Check if required variables are in data requirements
    const required_vars = framing.data_requirements.required_variables
    const var_names = framing.variables.map((v) => v.name)
    const missing_vars = required_vars.filter((rv) => !var_names.includes(rv))
    if (missing_vars.length > 0) {
      errors.push(`Data requirements reference undefined variables: ${missing_vars.join(", ")}`)
    }

    // Validate estimand consistency with study design
    if (framing.estimand.type === "LATE" && framing.study_design.type !== "instrumental") {
      errors.push("LATE estimand requires instrumental study design")
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  static generateDataRequirements(framing: CausalFraming): string[] {
    const requirements: string[] = []

    // Basic variable requirements
    requirements.push("Dataset with clearly defined treatment and outcome variables")

    // Sample size considerations
    if (framing.data_requirements.sample_size) {
      requirements.push(`Minimum sample size: ${framing.data_requirements.sample_size}`)
    }

    // Study design specific requirements
    switch (framing.study_design.type) {
      case "observational":
        requirements.push("Comprehensive set of confounders for adjustment")
        requirements.push("Variables for propensity score estimation")
        break
      case "RCT":
        requirements.push("Random assignment indicator")
        requirements.push("Baseline covariates for balance checking")
        break
      case "instrumental":
        requirements.push("Valid instrumental variable(s)")
        requirements.push("Variables for instrument relevance testing")
        break
      case "quasi_experimental":
        if (framing.study_design.temporal_structure === "panel") {
          requirements.push("Panel data with pre- and post-treatment observations")
          requirements.push("Clear treatment implementation timing")
        }
        break
    }

    // Temporal requirements
    if (
      framing.study_design.temporal_structure === "longitudinal" ||
      framing.study_design.temporal_structure === "panel"
    ) {
      requirements.push("Time variable for temporal ordering")
      if (framing.data_requirements.time_periods) {
        requirements.push(`Minimum ${framing.data_requirements.time_periods} time periods`)
      }
    }

    return requirements
  }
}

// Utility functions for creating framings
export function createCausalFraming(input: unknown): CausalFraming {
  const result = CausalFramingSchema.safeParse(input)
  if (!result.success) {
    throw new Error(`Invalid causal framing: ${result.error.message}`)
  }
  return result.data
}

export function saveFraming(framing: CausalFraming, filepath: string): void {
  const framing_with_timestamp = {
    ...framing,
    updated_at: new Date().toISOString(),
  }
  Bun.write(filepath, JSON.stringify(framing_with_timestamp, null, 2))
}

export async function loadFraming(filepath: string): Promise<CausalFraming> {
  const content = await Bun.file(filepath).text()
  const framing = JSON.parse(content)
  return createCausalFraming(framing)
}

export function generateFramingMarkdown(framing: CausalFraming): string {
  return `# Causal Analysis Framing

## Research Question
${framing.research_question}

${framing.background ? `\n## Background\n${framing.background}` : ""}

## Study Design
- **Type**: ${framing.study_design.type}
- **Description**: ${framing.study_design.description}
${framing.study_design.assignment_mechanism ? `- **Assignment Mechanism**: ${framing.study_design.assignment_mechanism}` : ""}
${framing.study_design.data_collection_method ? `- **Data Collection**: ${framing.study_design.data_collection_method}` : ""}
- **Temporal Structure**: ${framing.study_design.temporal_structure}

## Variables

### Treatment Variables
${framing.variables
  .filter((v) => v.role === "treatment")
  .map((v) => `- **${v.name}** (${v.type}): ${v.description}`)
  .join("\n")}

### Outcome Variables
${framing.variables
  .filter((v) => v.role === "outcome")
  .map((v) => `- **${v.name}** (${v.type}): ${v.description}`)
  .join("\n")}

### Covariates
${framing.variables
  .filter((v) => v.role === "covariate")
  .map((v) => `- **${v.name}** (${v.type}): ${v.description}`)
  .join("\n")}

${
  framing.variables.some((v) => v.role === "instrument")
    ? `
### Instrumental Variables
${framing.variables
  .filter((v) => v.role === "instrument")
  .map((v) => `- **${v.name}** (${v.type}): ${v.description}`)
  .join("\n")}
`
    : ""
}

## Estimand
- **Type**: ${framing.estimand.type}
- **Description**: ${framing.estimand.description}
- **Target Population**: ${framing.estimand.target_population}
${framing.estimand.treatment_levels ? `- **Treatment Levels**: ${framing.estimand.treatment_levels.join(", ")}` : ""}
${framing.estimand.outcome_scale ? `- **Outcome Scale**: ${framing.estimand.outcome_scale}` : ""}
${framing.estimand.conditions ? `- **Conditions**: ${framing.estimand.conditions}` : ""}

## Causal Assumptions

${framing.assumptions
  .map(
    (a) =>
      `### ${a.name}
- **Type**: ${a.type}
- **Status**: ${a.status}
- **Description**: ${a.description}
${a.test_method ? `- **Test Method**: ${a.test_method}` : ""}
${a.rationale ? `- **Rationale**: ${a.rationale}` : ""}
`,
  )
  .join("\n")}

## Validation Criteria

${framing.validation_criteria
  .map(
    (vc) =>
      `### ${vc.name}
- **Description**: ${vc.description}
${vc.threshold ? `- **Threshold**: ${vc.threshold}` : ""}
${vc.test ? `- **Test**: ${vc.test}` : ""}
- **Required**: ${vc.required ? "Yes" : "No"}
`,
  )
  .join("\n")}

## Data Requirements
${framing.data_requirements.required_variables.map((req) => `- ${req}`).join("\n")}

${framing.data_requirements.sample_size ? `- **Minimum Sample Size**: ${framing.data_requirements.sample_size}` : ""}
${framing.data_requirements.time_periods ? `- **Time Periods**: ${framing.data_requirements.time_periods}` : ""}
${framing.data_requirements.data_structure ? `- **Data Structure**: ${framing.data_requirements.data_structure}` : ""}

${
  framing.limitations && framing.limitations.length > 0
    ? `
## Limitations
${framing.limitations.map((l) => `- ${l}`).join("\n")}
`
    : ""
}

---
*Created: ${framing.created_at}*  
*Updated: ${framing.updated_at}*
`
}
