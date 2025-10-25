import { z } from "zod"
import type { DAG, IdentificationResult } from "./identification"
import { CausalIdentificationFramework } from "./identification"

export const IdentificationTemplateSchema = z.object({
  name: z.string(),
  description: z.string(),
  scenario: z.enum([
    "observational_confounding",
    "instrumental_variables",
    "frontdoor_mediator",
    "did_panel",
    "rd_threshold",
  ]),
  dag_template: z.any(), // DAG structure template
  common_assumptions: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      testable: z.boolean(),
      status: z.enum(["satisfied", "plausible", "violated", "unknown"]),
    }),
  ),
  validation_checks: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      method: z.string(),
      threshold: z.union([z.string(), z.number()]).optional(),
    }),
  ),
  estimation_methods: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      requirements: z.array(z.string()),
      assumptions: z.array(z.string()),
    }),
  ),
})

export type IdentificationTemplate = z.infer<typeof IdentificationTemplateSchema>

export class IdentificationTemplateFramework {
  private static templates: Map<string, IdentificationTemplate> = new Map()

  static {
    // Initialize templates
    this.templates.set("observational_confounding", this.createObservationalTemplate())
    this.templates.set("instrumental_variables", this.createInstrumentalTemplate())
    this.templates.set("frontdoor_mediator", this.createFrontdoorTemplate())
    this.templates.set("did_panel", this.createDifferenceInDifferencesTemplate())
    this.templates.set("rd_threshold", this.createRegressionDiscontinuityTemplate())
  }

  /**
   * Get template by name
   */
  static getTemplate(name: string): IdentificationTemplate | undefined {
    return this.templates.get(name)
  }

  /**
   * List all available templates
   */
  static listTemplates(): Array<{ name: string; description: string; scenario: string }> {
    return Array.from(this.templates.entries()).map(([name, template]) => ({
      name,
      description: template.description,
      scenario: template.scenario,
    }))
  }

  /**
   * Apply template to specific research question
   */
  static applyTemplate(
    templateName: string,
    researchQuestion: string,
    variables: {
      treatment: string
      outcome: string
      confounders?: string[]
      instruments?: string[]
      mediators?: string[]
    },
  ): DAG {
    const template = this.getTemplate(templateName)
    if (!template) {
      throw new Error(`Template not found: ${templateName}`)
    }

    return this.instantiateDAG(template.dag_template, researchQuestion, variables)
  }

  /**
   * Generate identification analysis from template
   */
  static generateFromTemplate(
    templateName: string,
    researchQuestion: string,
    variables: {
      treatment: string
      outcome: string
      confounders?: string[]
      instruments?: string[]
      mediators?: string[]
    },
  ): IdentificationResult {
    const dag = this.applyTemplate(templateName, researchQuestion, variables)
    return CausalIdentificationFramework.identify(dag)
  }

  /**
   * Create observational confounding template
   */
  private static createObservationalTemplate(): IdentificationTemplate {
    return {
      name: "observational_confounding",
      description: "Observational study with confounding adjustment using backdoor criterion",
      scenario: "observational_confounding",
      dag_template: {
        research_question: "What is the causal effect of T on Y?",
        nodes: [
          { name: "T", type: "treatment", observed: true, description: "Treatment variable" },
          { name: "Y", type: "outcome", observed: true, description: "Outcome variable" },
          { name: "C1", type: "confounder", observed: true, description: "Confounder 1" },
          { name: "C2", type: "confounder", observed: true, description: "Confounder 2" },
          { name: "U", type: "unmeasured_confounder", observed: false, description: "Unmeasured confounder" },
        ],
        edges: [
          { from: "T", to: "Y", type: "causal", description: "Causal effect" },
          { from: "C1", to: "T", type: "causal", description: "Confounder affects treatment" },
          { from: "C1", to: "Y", type: "causal", description: "Confounder affects outcome" },
          { from: "C2", to: "T", type: "causal", description: "Confounder affects treatment" },
          { from: "C2", to: "Y", type: "causal", description: "Confounder affects outcome" },
          { from: "U", to: "T", type: "causal", description: "Unmeasured confounder affects treatment" },
          { from: "U", to: "Y", type: "causal", description: "Unmeasured confounder affects outcome" },
        ],
      },
      common_assumptions: [
        {
          name: "Conditional Independence",
          description: "Treatment assignment is independent of potential outcomes given measured confounders",
          testable: false,
          status: "plausible",
        },
        {
          name: "Positivity",
          description: "All treatment levels have positive probability for all covariate combinations",
          testable: true,
          status: "unknown",
        },
        {
          name: "No Unmeasured Confounding",
          description: "All important confounders are measured and adjusted for",
          testable: false,
          status: "plausible",
        },
      ],
      validation_checks: [
        {
          name: "Covariate Balance",
          description: "Standardized mean differences < 0.1 after adjustment",
          method: "Calculate standardized mean differences",
          threshold: 0.1,
        },
        {
          name: "Overlap Assessment",
          description: "Propensity scores between 0.1 and 0.9",
          method: "Examine propensity score distributions",
          threshold: "0.1-0.9",
        },
        {
          name: "Model Specification",
          description: "Correct specification of functional form",
          method: "Residual analysis, goodness-of-fit tests",
          threshold: "p > 0.05 for specification tests",
        },
      ],
      estimation_methods: [
        {
          name: "Propensity Score Matching",
          description: "Match treated and control units on propensity scores",
          requirements: ["Propensity score estimation", "Matching algorithm", "Balance assessment"],
          assumptions: ["Conditional independence", "Positivity", "Correct model specification"],
        },
        {
          name: "Inverse Probability Weighting",
          description: "Weight observations by inverse probability of treatment",
          requirements: ["Propensity score estimation", "Weight calculation", "Variance estimation"],
          assumptions: ["Conditional independence", "Positivity", "Correct model specification"],
        },
        {
          name: "Targeted Maximum Likelihood Estimation",
          description: "Semiparametric efficient estimation with machine learning",
          requirements: ["Machine learning algorithms", "Cross-validation", "Targeting step"],
          assumptions: ["Conditional independence", "Positivity", "Correct model specification"],
        },
      ],
    }
  }

  /**
   * Create instrumental variables template
   */
  private static createInstrumentalTemplate(): IdentificationTemplate {
    return {
      name: "instrumental_variables",
      description: "Instrumental variables design for unmeasured confounding",
      scenario: "instrumental_variables",
      dag_template: {
        research_question: "What is the causal effect of T on Y using instrument Z?",
        nodes: [
          { name: "Z", type: "instrument", observed: true, description: "Instrument" },
          { name: "T", type: "treatment", observed: true, description: "Treatment" },
          { name: "Y", type: "outcome", observed: true, description: "Outcome" },
          { name: "U", type: "unmeasured_confounder", observed: false, description: "Unmeasured confounder" },
        ],
        edges: [
          { from: "Z", to: "T", type: "causal", description: "Instrument affects treatment" },
          { from: "T", to: "Y", type: "causal", description: "Causal effect" },
          { from: "U", to: "T", type: "causal", description: "Confounder affects treatment" },
          { from: "U", to: "Y", type: "causal", description: "Confounder affects outcome" },
        ],
      },
      common_assumptions: [
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
        {
          name: "Monotonicity",
          description: "No defiers (no one who does opposite of instrument)",
          testable: false,
          status: "plausible",
        },
      ],
      validation_checks: [
        {
          name: "First Stage F-statistic",
          description: "F-statistic > 10 for strong instrument",
          method: "First stage regression",
          threshold: 10,
        },
        {
          name: "Overidentification Test",
          description: "Hansen J test p-value > 0.05 (if multiple instruments)",
          method: "Hansen J test",
          threshold: "p > 0.05",
        },
        {
          name: "Weak Instrument Robustness",
          description: "Compare 2SLS with LIML estimates",
          method: "Alternative estimators",
          threshold: "Similar estimates across methods",
        },
      ],
      estimation_methods: [
        {
          name: "Two-Stage Least Squares (2SLS)",
          description: "Standard IV estimation method",
          requirements: ["First stage regression", "Second stage regression", "Standard error correction"],
          assumptions: ["Instrument relevance", "Exclusion restriction", "Independence", "Monotonicity"],
        },
        {
          name: "Limited Information Maximum Likelihood (LIML)",
          description: "More robust to weak instruments",
          requirements: ["Maximum likelihood estimation", "Numerical optimization"],
          assumptions: ["Instrument relevance", "Exclusion restriction", "Independence", "Monotonicity"],
        },
        {
          name: "Anderson-Rubin Test",
          description: "Robust inference under weak instruments",
          requirements: ["Test statistic calculation", "Critical values"],
          assumptions: ["Instrument relevance", "Exclusion restriction", "Independence"],
        },
      ],
    }
  }

  /**
   * Create frontdoor mediator template
   */
  private static createFrontdoorTemplate(): IdentificationTemplate {
    return {
      name: "frontdoor_mediator",
      description: "Frontdoor adjustment using mediators when backdoor is blocked",
      scenario: "frontdoor_mediator",
      dag_template: {
        research_question: "What is the causal effect of T on Y through mediator M?",
        nodes: [
          { name: "T", type: "treatment", observed: true, description: "Treatment" },
          { name: "M", type: "mediator", observed: true, description: "Mediator" },
          { name: "Y", type: "outcome", observed: true, description: "Outcome" },
          { name: "U", type: "unmeasured_confounder", observed: false, description: "Unmeasured confounder" },
        ],
        edges: [
          { from: "T", to: "M", type: "causal", description: "Treatment affects mediator" },
          { from: "M", to: "Y", type: "causal", description: "Mediator affects outcome" },
          { from: "U", to: "T", type: "causal", description: "Confounder affects treatment" },
          { from: "U", to: "Y", type: "causal", description: "Confounder affects outcome" },
        ],
      },
      common_assumptions: [
        {
          name: "Complete Mediation",
          description: "All treatment effects pass through measured mediators",
          testable: false,
          status: "plausible",
        },
        {
          name: "No Unmeasured Confounding of M-Y",
          description: "Mediator-outcome relationship is unconfounded",
          testable: false,
          status: "plausible",
        },
        {
          name: "No Unmeasured Confounding of T-M",
          description: "Treatment-mediator relationship is unconfounded",
          testable: false,
          status: "plausible",
        },
      ],
      validation_checks: [
        {
          name: "Mediator Test",
          description: "Treatment significantly affects mediator",
          method: "Regression of mediator on treatment",
          threshold: "p < 0.05",
        },
        {
          name: "Mediator-Outcome Test",
          description: "Mediator significantly affects outcome controlling for treatment",
          method: "Regression of outcome on mediator and treatment",
          threshold: "p < 0.05",
        },
        {
          name: "Sensitivity Analysis",
          description: "Test robustness to unmeasured confounding",
          method: "Mediation sensitivity analysis",
          threshold: "Reasonable sensitivity parameters",
        },
      ],
      estimation_methods: [
        {
          name: "Traditional Mediation Analysis",
          description: "Product of coefficients method",
          requirements: ["Linear models", "Normality assumptions"],
          assumptions: ["Complete mediation", "No M-Y confounding", "Linear relationships"],
        },
        {
          name: "Counterfactual Mediation",
          description: "Based on potential outcomes framework",
          requirements: ["Mediation formulas", "Cross-world independence"],
          assumptions: ["Complete mediation", "No M-Y confounding", "Cross-world independence"],
        },
        {
          name: "Frontdoor Adjustment",
          description: "Direct application of frontdoor formula",
          requirements: ["Probability estimation", "Conditional independence"],
          assumptions: ["Complete mediation", "No M-Y confounding", "Positivity"],
        },
      ],
    }
  }

  /**
   * Create difference-in-differences template
   */
  private static createDifferenceInDifferencesTemplate(): IdentificationTemplate {
    return {
      name: "did_panel",
      description: "Difference-in-differences design with panel data",
      scenario: "did_panel",
      dag_template: {
        research_question: "What is the causal effect of treatment T on outcome Y over time?",
        nodes: [
          { name: "T", type: "treatment", observed: true, description: "Treatment indicator" },
          { name: "Y", type: "outcome", observed: true, description: "Outcome" },
          { name: "Time", type: "confounder", observed: true, description: "Time period" },
          { name: "Group", type: "confounder", observed: true, description: "Treatment/control group" },
          {
            name: "U",
            type: "unmeasured_confounder",
            observed: false,
            description: "Time-invariant unobserved heterogeneity",
          },
        ],
        edges: [
          { from: "T", to: "Y", type: "causal", description: "Treatment effect" },
          { from: "Time", to: "Y", type: "causal", description: "Time trend" },
          { from: "Time", to: "T", type: "causal", description: "Treatment implementation" },
          { from: "Group", to: "T", type: "causal", description: "Group assignment" },
          { from: "Group", to: "Y", type: "causal", description: "Group differences" },
          { from: "U", to: "Y", type: "causal", description: "Unobserved heterogeneity" },
        ],
      },
      common_assumptions: [
        {
          name: "Parallel Trends",
          description: "Treatment and control groups would have followed parallel trends without treatment",
          testable: true,
          status: "unknown",
        },
        {
          name: "No Anticipation",
          description: "No behavioral changes before treatment implementation",
          testable: false,
          status: "plausible",
        },
        {
          name: "Stable Unit Treatment Value",
          description: "No spillovers between units",
          testable: false,
          status: "plausible",
        },
      ],
      validation_checks: [
        {
          name: "Pre-treatment Trends",
          description: "No significant differences in pre-treatment trends",
          method: "Event study regression",
          threshold: "p > 0.05 for trend interaction",
        },
        {
          name: "Placebo Test",
          description: "No effect in pre-treatment periods",
          method: "Placebo DiD estimation",
          threshold: "p > 0.05 for placebo effects",
        },
        {
          name: "Event Study",
          description: "Dynamic treatment effects show reasonable pattern",
          method: "Event study coefficients",
          threshold: "No pre-treatment effects, reasonable post-treatment pattern",
        },
      ],
      estimation_methods: [
        {
          name: "Two-Way Fixed Effects",
          description: "Include unit and time fixed effects",
          requirements: ["Panel data", "Unit identifiers", "Time variables"],
          assumptions: ["Parallel trends", "No anticipation", "SUTVA"],
        },
        {
          name: "Event Study",
          description: "Dynamic treatment effects with leads and lags",
          requirements: ["Panel data", "Treatment timing", "Multiple time periods"],
          assumptions: ["Parallel trends", "No anticipation", "SUTVA"],
        },
        {
          name: "Synthetic Control",
          description: "Construct synthetic control group",
          requirements: ["Pre-treatment outcomes", "Donor pool", "Optimization"],
          assumptions: ["Parallel trends", "No anticipation", "SUTVA"],
        },
      ],
    }
  }

  /**
   * Create regression discontinuity template
   */
  private static createRegressionDiscontinuityTemplate(): IdentificationTemplate {
    return {
      name: "rd_threshold",
      description: "Regression discontinuity design with treatment assignment threshold",
      scenario: "rd_threshold",
      dag_template: {
        research_question: "What is the causal effect at the treatment threshold?",
        nodes: [
          { name: "X", type: "confounder", observed: true, description: "Running variable" },
          { name: "T", type: "treatment", observed: true, description: "Treatment assignment" },
          { name: "Y", type: "outcome", observed: true, description: "Outcome" },
          { name: "U", type: "unmeasured_confounder", observed: false, description: "Unobserved factors" },
        ],
        edges: [
          { from: "X", to: "T", type: "causal", description: "Running variable determines treatment" },
          { from: "X", to: "Y", type: "causal", description: "Running variable affects outcome" },
          { from: "T", to: "Y", type: "causal", description: "Treatment effect" },
          { from: "U", to: "Y", type: "causal", description: "Unobserved factors affect outcome" },
        ],
      },
      common_assumptions: [
        {
          name: "Continuity of Potential Outcomes",
          description: "Potential outcomes are continuous at the threshold",
          testable: false,
          status: "plausible",
        },
        {
          name: "No Precise Manipulation",
          description: "Agents cannot precisely manipulate the running variable",
          testable: true,
          status: "unknown",
        },
        {
          name: "Local Randomization",
          description: "Treatment assignment is as good as random near threshold",
          testable: false,
          status: "plausible",
        },
      ],
      validation_checks: [
        {
          name: "McCrary Density Test",
          description: "No manipulation of running variable",
          method: "Density test at threshold",
          threshold: "p > 0.05 for discontinuity in density",
        },
        {
          name: "Covariate Balance",
          description: "Covariates are continuous at threshold",
          method: "Test for discontinuities in covariates",
          threshold: "p > 0.05 for covariate discontinuities",
        },
        {
          name: "Bandwidth Sensitivity",
          description: "Results are robust to bandwidth choice",
          method: "Vary bandwidth and check stability",
          threshold: "Similar estimates across reasonable bandwidths",
        },
      ],
      estimation_methods: [
        {
          name: "Local Linear Regression",
          description: "Linear regression on each side of threshold",
          requirements: ["Running variable", "Threshold", "Bandwidth selection"],
          assumptions: ["Continuity", "No manipulation", "Correct bandwidth"],
        },
        {
          name: "Local Polynomial Regression",
          description: "Higher-order polynomials near threshold",
          requirements: ["Running variable", "Threshold", "Polynomial order"],
          assumptions: ["Continuity", "No manipulation", "Correct polynomial order"],
        },
        {
          name: "Fuzzy RD",
          description: "Treatment probability jumps at threshold",
          requirements: ["Running variable", "Threshold", "First stage"],
          assumptions: ["Continuity", "No manipulation", "Monotonicity"],
        },
      ],
    }
  }

  /**
   * Instantiate DAG template with specific variables
   */
  private static instantiateDAG(
    template: any,
    researchQuestion: string,
    variables: {
      treatment: string
      outcome: string
      confounders?: string[]
      instruments?: string[]
      mediators?: string[]
    },
  ): DAG {
    const nodeMap: Record<string, string> = {
      T: variables.treatment,
      Y: variables.outcome,
    }

    // Map confounders
    if (variables.confounders) {
      variables.confounders.forEach((confounder, index) => {
        nodeMap[`C${index + 1}`] = confounder
      })
    }

    // Map instruments
    if (variables.instruments) {
      variables.instruments.forEach((instrument, index) => {
        nodeMap[`Z${index + 1}`] = instrument
      })
    }

    // Map mediators
    if (variables.mediators) {
      variables.mediators.forEach((mediator, index) => {
        nodeMap[`M${index + 1}`] = mediator
      })
    }

    // Transform nodes
    const nodes = template.nodes.map((node: any) => ({
      ...node,
      name: nodeMap[node.name] || node.name,
    }))

    // Transform edges
    const edges = template.edges.map((edge: any) => ({
      ...edge,
      from: nodeMap[edge.from] || edge.from,
      to: nodeMap[edge.to] || edge.to,
    }))

    return {
      research_question: researchQuestion,
      nodes,
      edges,
      assumptions: template.assumptions,
    }
  }
}
