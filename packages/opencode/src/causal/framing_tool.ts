import { Tool } from "../tool/tool"
import { z } from "zod"
import {
  CausalFramingFramework,
  createCausalFraming,
  saveFraming,
  loadFraming,
  generateFramingMarkdown,
  type CausalFraming,
} from "./framing"

const CreateFramingSchema = z.object({
  research_question: z.string(),
  background: z.string().optional(),
  scenario: z.enum(["observational", "RCT", "instrumental", "difference_in_differences"]).optional(),
  treatment_variables: z.array(
    z.object({
      name: z.string(),
      type: z.enum(["binary", "continuous", "categorical", "count", "time_to_event"]),
      description: z.string(),
    }),
  ),
  outcome_variables: z.array(
    z.object({
      name: z.string(),
      type: z.enum(["binary", "continuous", "categorical", "count", "time_to_event"]),
      description: z.string(),
    }),
  ),
  covariate_variables: z
    .array(
      z.object({
        name: z.string(),
        type: z.enum(["binary", "continuous", "categorical", "count", "time_to_event"]),
        description: z.string(),
      }),
    )
    .optional(),
  estimand_type: z.enum(["ATE", "ATT", "ATC", "CATE", "NDE", "NIE", "LATE"]).default("ATE"),
  target_population: z.string(),
  sample_size: z.number().optional(),
  temporal_structure: z.enum(["cross_sectional", "longitudinal", "time_series", "panel"]).optional(),
  save_path: z.string().optional(),
})

const LoadFramingSchema = z.object({
  filepath: z.string(),
})

const ValidateFramingSchema = z.object({
  framing: z.any(), // Will be validated against CausalFraming schema
})

const GenerateMarkdownSchema = z.object({
  framing: z.any(), // Will be validated against CausalFraming schema
  output_path: z.string().optional(),
})

async function createFraming(input: unknown) {
  const params = CreateFramingSchema.parse(input)

  // Start with template if scenario specified
  let framing: Partial<CausalFraming> = {}
  if (params.scenario) {
    framing = CausalFramingFramework.createTemplate(params.scenario)
  }

  // Build variables array
  const variables = [
    ...params.treatment_variables.map((v) => ({
      ...v,
      role: "treatment" as const,
      validation: { required: true },
    })),
    ...params.outcome_variables.map((v) => ({
      ...v,
      role: "outcome" as const,
      validation: { required: true },
    })),
    ...(params.covariate_variables?.map((v) => ({
      ...v,
      role: "covariate" as const,
      validation: { required: false },
    })) || []),
  ]

  // Complete the framing
  const completeFraming: CausalFraming = {
    ...framing,
    research_question: params.research_question,
    background: params.background,
    variables,
    estimand: {
      ...framing.estimand,
      type: params.estimand_type,
      description: `${params.estimand_type} for ${params.target_population}`,
      target_population: params.target_population,
    },
    study_design: {
      type: framing.study_design?.type || "observational",
      description: framing.study_design?.description || "Observational study",
      temporal_structure: params.temporal_structure || framing.study_design?.temporal_structure || "cross_sectional",
      assignment_mechanism: framing.study_design?.assignment_mechanism,
      data_collection_method: framing.study_design?.data_collection_method,
    },
    data_requirements: {
      required_variables: variables.map((v) => v.name),
      sample_size: params.sample_size,
      data_structure: "Tabular dataset with one row per observation unit",
    },
    assumptions: framing.assumptions || [],
    validation_criteria: framing.validation_criteria || [],
    limitations: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  // Validate the complete framing
  const validation = CausalFramingFramework.validateFraming(completeFraming)
  if (!validation.valid) {
    throw new Error(`Invalid framing: ${validation.errors.join(", ")}`)
  }

  // Save if path provided
  if (params.save_path) {
    saveFraming(completeFraming, params.save_path)
  }

  return {
    success: true,
    framing: completeFraming,
    validation,
    data_requirements: CausalFramingFramework.generateDataRequirements(completeFraming),
  }
}

async function loadFramingDocument(input: unknown) {
  const params = LoadFramingSchema.parse(input)

  try {
    const framing = await loadFraming(params.filepath)
    const validation = CausalFramingFramework.validateFraming(framing)

    return {
      success: true,
      framing,
      validation,
      data_requirements: CausalFramingFramework.generateDataRequirements(framing),
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error loading framing",
    }
  }
}

async function validateFraming(input: unknown) {
  const params = ValidateFramingSchema.parse(input)

  try {
    const framing = createCausalFraming(params.framing)
    const validation = CausalFramingFramework.validateFraming(framing)

    return {
      success: true,
      validation,
      data_requirements: CausalFramingFramework.generateDataRequirements(framing),
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error validating framing",
    }
  }
}

async function generateMarkdown(input: unknown) {
  const params = GenerateMarkdownSchema.parse(input)

  try {
    const framing = createCausalFraming(params.framing)
    const markdown = generateFramingMarkdown(framing)

    if (params.output_path) {
      await Bun.write(params.output_path, markdown)
    }

    return {
      success: true,
      markdown,
      output_path: params.output_path,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error generating markdown",
    }
  }
}

function listTemplates() {
  return {
    success: true,
    templates: [
      {
        name: "observational",
        description: "Observational study with confounding adjustment",
        common_use_cases: ["Healthcare studies", "Economic research", "Social science research"],
        key_assumptions: ["Conditional independence", "Positivity", "Consistency"],
      },
      {
        name: "RCT",
        description: "Randomized controlled trial with random assignment",
        common_use_cases: ["Clinical trials", "A/B testing", "Policy experiments"],
        key_assumptions: ["Random assignment", "No interference", "Compliance"],
      },
      {
        name: "instrumental",
        description: "Instrumental variables design for unmeasured confounding",
        common_use_cases: ["Economics", "Education research", "Policy evaluation"],
        key_assumptions: ["Instrument relevance", "Exclusion restriction", "Independence"],
      },
      {
        name: "difference_in_differences",
        description: "DiD design for policy interventions with panel data",
        common_use_cases: ["Policy evaluation", "Economic impact studies", "Labor market research"],
        key_assumptions: ["Parallel trends", "No anticipation", "SUTVA"],
      },
    ],
  }
}

export const CausalFramingTool = Tool.define("causal_framing", async () => ({
  description: "Create, validate, and manage causal analysis framing documents",
  parameters: z.object({
    action: z.enum(["create", "load", "validate", "generate_markdown", "list_templates"]),
    input: z.any().optional(),
  }),
  execute: async ({ action, input }: { action: string; input?: unknown }, ctx) => {
    let result
    switch (action) {
      case "create":
        result = await createFraming(input)
        break
      case "load":
        result = await loadFramingDocument(input)
        break
      case "validate":
        result = await validateFraming(input)
        break
      case "generate_markdown":
        result = await generateMarkdown(input)
        break
      case "list_templates":
        result = listTemplates()
        break
      default:
        throw new Error(`Unknown action: ${action}`)
    }

    return {
      title: `Causal Framing: ${action}`,
      metadata: {},
      output: JSON.stringify(result, null, 2),
    }
  },
}))
