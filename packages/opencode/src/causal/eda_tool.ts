import { Tool } from "../tool/tool"
import { z } from "zod"
import { loadFraming, type CausalFraming } from "./framing"

const EDATemplateSchema = z.object({
  action: z.enum(["create_template", "run_eda", "validate_data", "generate_report"]),
  framing_path: z.string().optional(),
  data_path: z.string().optional(),
  config_path: z.string().optional(),
  output_dir: z.string().optional(),
  template_type: z.enum(["python", "r", "json"]).default("json"),
})

const DataValidationSchema = z.object({
  data_path: z.string(),
  framing_path: z.string(),
  validation_rules: z
    .object({
      missingness_threshold: z.number().default(0.05),
      positivity_threshold: z.number().default(0.1),
      balance_threshold: z.number().default(0.1),
      sample_size_minimum: z.number().optional(),
    })
    .optional(),
})

const ReportGenerationSchema = z.object({
  eda_results_path: z.string(),
  output_format: z.enum(["json", "html", "markdown"]).default("json"),
  include_plots: z.boolean().default(true),
  output_path: z.string().optional(),
})

export const CausalEDATool = Tool.define("causal_eda", {
  description: "Comprehensive exploratory data analysis for causal inference studies",
  parameters: z.object({
    action: z.enum(["create_template", "run_eda", "validate_data", "generate_report", "list_templates"]),
    input: z.any().optional(),
  }),
  execute: async ({ action, input }: { action: string; input?: unknown }, ctx) => {
    let result: any

    switch (action) {
      case "create_template":
        result = await createEDATemplate(input)
        break
      case "run_eda":
        result = await runEDA(input)
        break
      case "validate_data":
        result = await validateData(input)
        break
      case "generate_report":
        result = await generateReport(input)
        break
      case "list_templates":
        result = listEDATemplates()
        break
      default:
        throw new Error(`Unknown action: ${action}`)
    }

    return {
      title: `Causal EDA: ${action}`,
      metadata: { success: result.success },
      output: JSON.stringify(result, null, 2),
    }
  },
})

async function createEDATemplate(input: unknown) {
  const params = EDATemplateSchema.parse(input)

  try {
    let template: any = {}

    if (params.template_type === "json") {
      // Load EDA template
      template = await Bun.file("./src/causal/eda_template.json").json()

      // If framing path provided, integrate with framing
      if (params.framing_path) {
        const framing = await loadFraming(params.framing_path)
        template = integrateFramingWithEDA(template, framing)
      }

      // Save template
      const outputPath = params.output_dir ? `${params.output_dir}/eda_template.json` : "eda_template.json"

      await Bun.write(outputPath, JSON.stringify(template, null, 2))

      return {
        success: true,
        message: `EDA template created at ${outputPath}`,
        template_path: outputPath,
        template_type: "json",
      }
    } else if (params.template_type === "python") {
      // Copy Python template
      const pythonTemplate = await Bun.file("./src/causal/eda_python_template.py").text()

      // If config path provided, create config
      if (params.config_path) {
        const configTemplate = await Bun.file("./src/causal/eda_config_template.json").json()
        const configPath = params.output_dir ? `${params.output_dir}/eda_config.json` : "eda_config.json"
        await Bun.write(configPath, JSON.stringify(configTemplate, null, 2))
      }

      const outputPath = params.output_dir ? `${params.output_dir}/causal_eda.py` : "causal_eda.py"

      await Bun.write(outputPath, pythonTemplate)

      return {
        success: true,
        message: `Python EDA template created at ${outputPath}`,
        template_path: outputPath,
        template_type: "python",
      }
    } else if (params.template_type === "r") {
      // Copy R template
      const rTemplate = await Bun.file("./src/causal/eda_r_template.R").text()

      const outputPath = params.output_dir ? `${params.output_dir}/causal_eda.R` : "causal_eda.R"

      await Bun.write(outputPath, rTemplate)

      return {
        success: true,
        message: `R EDA template created at ${outputPath}`,
        template_path: outputPath,
        template_type: "r",
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error creating template",
    }
  }
}

async function runEDA(input: unknown) {
  const params = EDATemplateSchema.parse(input)

  try {
    if (!params.data_path || !params.framing_path) {
      throw new Error("Both data_path and framing_path are required for running EDA")
    }

    // Load framing
    const framing = await loadFraming(params.framing_path)

    // Validate data exists
    try {
      await Bun.file(params.data_path).text()
    } catch {
      throw new Error(`Data file not found: ${params.data_path}`)
    }

    // Create EDA configuration from framing
    const edaConfig = createEDAConfigFromFraming(framing, params.data_path)

    // Save configuration
    const configPath = params.output_dir ? `${params.output_dir}/eda_config.json` : "eda_config.json"
    await Bun.write(configPath, JSON.stringify(edaConfig, null, 2))

    // Generate analysis script
    const scriptPath = await generateAnalysisScript(framing, params.data_path, params.output_dir)

    // Create output directory structure
    const outputDir = params.output_dir || "eda_results"
    await ensureDirectory(outputDir)
    await ensureDirectory(`${outputDir}/plots`)
    await ensureDirectory(`${outputDir}/data`)

    return {
      success: true,
      message: "EDA analysis setup completed",
      config_path: configPath,
      script_path: scriptPath,
      output_directory: outputDir,
      next_steps: [
        "Review the generated configuration file",
        "Run the analysis script with your data",
        "Check the generated plots and reports",
      ],
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error running EDA",
    }
  }
}

async function validateData(input: unknown) {
  const params = DataValidationSchema.parse(input)

  try {
    // Load framing
    const framing = await loadFraming(params.framing_path)

    // Basic data validation (would be more sophisticated in practice)
    const validationResults = {
      data_access: false,
      schema_validation: false,
      missingness_check: false,
      variable_types: false,
      sample_size: false,
      overall_status: "FAIL" as "PASS" | "WARNING" | "FAIL",
    }

    // Check data access
    try {
      const dataContent = await Bun.file(params.data_path).text()
      validationResults.data_access = true

      // Basic CSV parsing check
      const lines = dataContent.split("\n")
      if (lines.length > 1) {
        validationResults.sample_size = lines.length - 1 >= (framing.data_requirements.sample_size || 100)
      }
    } catch {
      validationResults.data_access = false
    }

    // Validate required variables
    const requiredVars = framing.data_requirements.required_variables
    const headerLine = (await Bun.file(params.data_path).text()).split("\n")[0]
    const availableVars = headerLine.split(",").map((v) => v.trim().replace(/"/g, ""))

    const missingVars = requiredVars.filter(
      (reqVar) => !availableVars.some((availableVar) => availableVar.toLowerCase() === reqVar.toLowerCase()),
    )

    validationResults.schema_validation = missingVars.length === 0

    // Generate validation report
    const validationReport = {
      validation_date: new Date().toISOString(),
      data_path: params.data_path,
      framing_path: params.framing_path,
      results: validationResults,
      missing_variables: missingVars,
      available_variables: availableVars,
      required_variables: requiredVars,
      recommendations: generateValidationRecommendations(validationResults, missingVars, framing),
    }

    validationResults.overall_status =
      validationResults.data_access && validationResults.schema_validation ? "PASS" : "FAIL"

    return {
      success: true,
      validation: validationReport,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error validating data",
    }
  }
}

async function generateReport(input: unknown) {
  const params = ReportGenerationSchema.parse(input)

  try {
    // Load EDA results
    const edaResults = await Bun.file(params.eda_results_path).json()

    let reportContent = ""
    let outputPath = params.output_path || "eda_report"

    if (params.output_format === "json") {
      reportContent = JSON.stringify(edaResults, null, 2)
      outputPath += ".json"
    } else if (params.output_format === "markdown") {
      reportContent = generateMarkdownReport(edaResults)
      outputPath += ".md"
    } else if (params.output_format === "html") {
      reportContent = generateHTMLReport(edaResults)
      outputPath += ".html"
    }

    await Bun.write(outputPath, reportContent)

    return {
      success: true,
      message: `Report generated at ${outputPath}`,
      report_path: outputPath,
      format: params.output_format,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error generating report",
    }
  }
}

function listEDATemplates() {
  return {
    success: true,
    templates: [
      {
        name: "json",
        description: "JSON template for EDA results structure",
        file: "eda_template.json",
        use_case: "Structuring EDA results and metadata",
      },
      {
        name: "python",
        description: "Comprehensive Python EDA script",
        file: "eda_python_template.py",
        use_case: "Full EDA analysis using Python ecosystem",
      },
      {
        name: "r",
        description: "Comprehensive R EDA script",
        file: "eda_r_template.R",
        use_case: "Full EDA analysis using R ecosystem",
      },
      {
        name: "config",
        description: "Configuration template for EDA parameters",
        file: "eda_config_template.json",
        use_case: "Customizing EDA analysis settings",
      },
    ],
    features: [
      "Data profiling and quality assessment",
      "Missing data pattern analysis",
      "Propensity score estimation and overlap assessment",
      "Covariate balance evaluation",
      "Correlation and multicollinearity analysis",
      "Instrument relevance testing (for IV designs)",
      "Comprehensive visualization suite",
      "Automated report generation",
    ],
  }
}

function integrateFramingWithEDA(template: any, framing: CausalFraming): any {
  // Integrate framing information into EDA template
  const integratedTemplate = { ...template }

  // Update metadata
  integratedTemplate.eda_metadata.causal_framing_reference = framing.research_question
  integratedTemplate.eda_metadata.estimand_type = framing.estimand.type
  integratedTemplate.eda_metadata.study_design = framing.study_design.type

  // Extract variable roles from framing
  const treatmentVars = framing.variables.filter((v) => v.role === "treatment").map((v) => v.name)
  const outcomeVars = framing.variables.filter((v) => v.role === "outcome").map((v) => v.name)
  const covariateVars = framing.variables.filter((v) => v.role === "covariate").map((v) => v.name)
  const instrumentVars = framing.variables.filter((v) => v.role === "instrument").map((v) => v.name)

  // Update validation criteria based on framing
  if (framing.validation_criteria) {
    integratedTemplate.validation_outcomes = framing.validation_criteria.map((vc) => ({
      [vc.name]: {
        criteria: vc.description,
        threshold: vc.threshold,
        result: "PENDING", // To be filled after analysis
        details: vc.test,
      },
    }))
  }

  return integratedTemplate
}

function createEDAConfigFromFraming(framing: CausalFraming, dataPath: string): any {
  const treatmentVars = framing.variables.filter((v) => v.role === "treatment")
  const outcomeVars = framing.variables.filter((v) => v.role === "outcome")
  const covariateVars = framing.variables.filter((v) => v.role === "covariate")
  const instrumentVars = framing.variables.filter((v) => v.role === "instrument")

  return {
    dataset_info: {
      path: dataPath,
      format: "csv",
      encoding: "utf-8",
    },
    variable_roles: {
      treatment_variables: treatmentVars.map((v) => ({
        name: v.name,
        type: v.type,
        description: v.description,
      })),
      outcome_variables: outcomeVars.map((v) => ({
        name: v.name,
        type: v.type,
        description: v.description,
      })),
      covariate_variables: covariateVars.map((v) => ({
        name: v.name,
        type: v.type,
        description: v.description,
      })),
      instrument_variables: instrumentVars.map((v) => ({
        name: v.name,
        type: v.type,
        description: v.description,
      })),
    },
    analysis_settings: {
      study_design: framing.study_design.type,
      estimand_type: framing.estimand.type,
      missing_data_threshold: 0.05,
      overlap_threshold: 0.1,
      balance_threshold: 0.1,
    },
    output: {
      directory: "eda_results",
      create_subdirectories: true,
      save_plots: true,
      save_reports: true,
    },
  }
}

async function generateAnalysisScript(framing: CausalFraming, dataPath: string, outputDir?: string): Promise<string> {
  const scriptDir = outputDir || "."
  const scriptPath = `${scriptDir}/run_eda.py`

  // Generate a simple Python script that uses the template
  const scriptContent = `#!/usr/bin/env python3
"""
Auto-generated EDA analysis script
Generated for: ${framing.research_question}
Study Design: ${framing.study_design.type}
Estimand: ${framing.estimand.type}
"""

import sys
import os
import json
from pathlib import Path

# Add the current directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from causal_eda_template import CausalEDA
except ImportError:
    print("Error: causal_eda_template.py not found in the current directory")
    print("Please ensure the EDA template is in the same directory as this script")
    sys.exit(1)

def main():
    # Load configuration
    config_path = "eda_config.json"
    if not os.path.exists(config_path):
        print(f"Error: Configuration file not found: {config_path}")
        sys.exit(1)
    
    with open(config_path, 'r') as f:
        config = json.load(f)
    
    # Load data
    data_path = config['dataset_info']['path']
    if not os.path.exists(data_path):
        print(f"Error: Data file not found: {data_path}")
        sys.exit(1)
    
    print(f"Loading data from: {data_path}")
    
    # This is a placeholder - in practice, you'd use pandas or similar
    # to load the data and run the EDA analysis
    print("EDA analysis setup complete!")
    print("Next steps:")
    print("1. Install required Python packages: pandas, numpy, matplotlib, seaborn, scipy, statsmodels")
    print("2. Run: python causal_eda_template.py --data data.csv --config eda_config.json --output results/")

if __name__ == "__main__":
    main()
`

  await Bun.write(scriptPath, scriptContent)
  return scriptPath
}

async function ensureDirectory(dirPath: string): Promise<void> {
  try {
    const fs = await import("fs")
    await fs.promises.mkdir(dirPath, { recursive: true })
  } catch (error) {
    // Directory might already exist
  }
}

function generateValidationRecommendations(results: any, missingVars: string[], framing: CausalFraming): string[] {
  const recommendations: string[] = []

  if (!results.data_access) {
    recommendations.push("Check data file path and permissions")
  }

  if (!results.schema_validation) {
    recommendations.push(`Missing required variables: ${missingVars.join(", ")}`)
    recommendations.push("Ensure variable names in data match framing specification")
  }

  if (!results.sample_size) {
    recommendations.push(`Sample size below recommended minimum of ${framing.data_requirements.sample_size}`)
  }

  if (results.data_access && results.schema_validation && results.sample_size) {
    recommendations.push("Data validation passed - ready for EDA analysis")
  }

  return recommendations
}

function generateMarkdownReport(edaResults: any): string {
  return `# Causal Exploratory Data Analysis Report

## Analysis Summary

**Analysis Date:** ${edaResults.eda_metadata?.analysis_date || "N/A"}  
**Total Observations:** ${edaResults.data_profiling?.total_observations || "N/A"}  
**Total Variables:** ${edaResults.data_profiling?.total_variables || "N/A"}

## Data Quality Overview

${
  edaResults.data_profiling?.overall_data_quality
    ? `
- **Complete Cases:** ${edaResults.data_profiling.overall_data_quality.complete_cases}
- **Complete Case Percentage:** ${edaResults.data_profiling.overall_data_quality.complete_case_percentage}%
- **Data Quality Score:** ${edaResults.data_profiling.overall_data_quality.data_quality_score}
`
    : "Data quality information not available."
}

## Key Findings

### Missing Data Analysis
${
  edaResults.missingness_analysis
    ? `
- **Missingness Mechananism:** ${edaResults.missingness_analysis.missingness_mechanism?.assessment || "N/A"}
- **Impact Assessment:** ${edaResults.missingness_analysis.impact_assessment?.treatment_effect_bias_risk || "N/A"} risk for treatment effect bias
`
    : "Missing data analysis not available."
}

### Overlap and Positivity
${
  edaResults.overlap_positivity_assessment
    ? `
- **Overlap Percentage:** ${edaResults.overlap_positivity_assessment.propensity_score_analysis?.overlap_statistics?.percentage_in_overlap || "N/A"}%
- **Positivity Validation:** ${edaResults.overlap_positivity_assessment.positivity_validation?.criteria_met || "N/A"}
`
    : "Overlap analysis not available."
}

### Covariate Balance
${
  edaResults.overlap_positivity_assessment?.covariate_balance
    ? `
- **Overall Balance:** ${edaResults.overlap_positivity_assessment.covariate_balance.balance_assessment?.overall_balance || "N/A"}
- **Balanced Variables (SMD < 0.1):** ${edaResults.overlap_positivity_assessment.covariate_balance.balance_assessment?.variables_balanced_smd_0_1?.join(", ") || "None"}
`
    : "Balance analysis not available."
}

## Recommendations

${
  edaResults.key_risks_and_recommendations?.recommendations
    ? edaResults.key_risks_and_recommendations.recommendations.map((rec: string) => `- ${rec}`).join("\n")
    : "No specific recommendations available."
}

## Next Steps

1. Review data quality issues and address if necessary
2. Consider appropriate missing data handling strategies
3. Evaluate need for propensity score adjustment or weighting
4. Proceed with causal effect estimation

---
*Report generated by Causal EDA Tool*
`
}

function generateHTMLReport(edaResults: any): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Causal EDA Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        .header { background-color: #f4f4f4; padding: 20px; border-radius: 5px; }
        .section { margin: 20px 0; }
        .metric { background-color: #e9ecef; padding: 10px; margin: 5px 0; border-radius: 3px; }
        .pass { color: #28a745; }
        .warning { color: #ffc107; }
        .fail { color: #dc3545; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Causal Exploratory Data Analysis Report</h1>
        <p><strong>Analysis Date:</strong> ${edaResults.eda_metadata?.analysis_date || "N/A"}</p>
        <p><strong>Total Observations:</strong> ${edaResults.data_profiling?.total_observations || "N/A"}</p>
        <p><strong>Total Variables:</strong> ${edaResults.data_profiling?.total_variables || "N/A"}</p>
    </div>

    <div class="section">
        <h2>Data Quality Overview</h2>
        ${
          edaResults.data_profiling?.overall_data_quality
            ? `
            <div class="metric">Complete Cases: ${edaResults.data_profiling.overall_data_quality.complete_cases}</div>
            <div class="metric">Complete Case Percentage: ${edaResults.data_profiling.overall_data_quality.complete_case_percentage}%</div>
            <div class="metric">Data Quality Score: ${edaResults.data_profiling.overall_data_quality.data_quality_score}</div>
        `
            : "<p>Data quality information not available.</p>"
        }
    </div>

    <div class="section">
        <h2>Key Findings</h2>
        
        <h3>Missing Data Analysis</h3>
        ${
          edaResults.missingness_analysis
            ? `
            <div class="metric">Missingness Mechanism: ${edaResults.missingness_analysis.missingness_mechanism?.assessment || "N/A"}</div>
            <div class="metric">Treatment Effect Bias Risk: ${edaResults.missingness_analysis.impact_assessment?.treatment_effect_bias_risk || "N/A"}</div>
        `
            : "<p>Missing data analysis not available.</p>"
        }
        
        <h3>Overlap and Positivity</h3>
        ${
          edaResults.overlap_positivity_assessment
            ? `
            <div class="metric">Overlap Percentage: ${edaResults.overlap_positivity_assessment.propensity_score_analysis?.overlap_statistics?.percentage_in_overlap || "N/A"}%</div>
            <div class="metric">Positivity Validation: <span class="${edaResults.overlap_positivity_assessment.positivity_validation?.criteria_met?.toLowerCase() || ""}">${edaResults.overlap_positivity_assessment.positivity_validation?.criteria_met || "N/A"}</span></div>
        `
            : "<p>Overlap analysis not available.</p>"
        }
    </div>

    <div class="section">
        <h2>Recommendations</h2>
        ${
          edaResults.key_risks_and_recommendations?.recommendations
            ? `<ul>${edaResults.key_risks_and_recommendations.recommendations.map((rec: string) => `<li>${rec}</li>`).join("")}</ul>`
            : "<p>No specific recommendations available.</p>"
        }
    </div>

    <div class="section">
        <h2>Next Steps</h2>
        <ol>
            <li>Review data quality issues and address if necessary</li>
            <li>Consider appropriate missing data handling strategies</li>
            <li>Evaluate need for propensity score adjustment or weighting</li>
            <li>Proceed with causal effect estimation</li>
        </ol>
    </div>

    <footer>
        <p><em>Report generated by Causal EDA Tool</em></p>
    </footer>
</body>
</html>`
}
