import { CausalFramingFramework, loadFraming, generateFramingMarkdown } from "./src/causal/framing.ts"

async function validateAndGenerate() {
  try {
    // Load the framing document
    const framing = await loadFraming("./causal_workflow_framing.json")

    // Validate the framing
    const validation = CausalFramingFramework.validateFraming(framing)

    console.log("=== VALIDATION RESULTS ===")
    console.log("Valid:", validation.valid)
    if (!validation.valid) {
      console.log("Errors:", validation.errors)
    }

    // Generate data requirements
    const dataRequirements = CausalFramingFramework.generateDataRequirements(framing)
    console.log("\n=== DATA REQUIREMENTS ===")
    dataRequirements.forEach((req) => console.log("- " + req))

    // Generate markdown summary
    const markdown = generateFramingMarkdown(framing)

    // Save markdown summary
    await Bun.write("./causal_workflow_framing.md", markdown)
    console.log("\n=== MARKDOWN SUMMARY ===")
    console.log("Markdown summary saved to causal_workflow_framing.md")

    // Display key information
    console.log("\n=== FRAMING SUMMARY ===")
    console.log("Research Question:", framing.research_question)
    console.log("Study Design:", framing.study_design.type)
    console.log("Estimand:", framing.estimand.type)
    console.log("Variables:", framing.variables.length)
    console.log("Treatment Variables:", framing.variables.filter((v) => v.role === "treatment").length)
    console.log("Outcome Variables:", framing.variables.filter((v) => v.role === "outcome").length)
    console.log("Instrument Variables:", framing.variables.filter((v) => v.role === "instrument").length)
    console.log("Covariate Variables:", framing.variables.filter((v) => v.role === "covariate").length)
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : String(error))
  }
}

validateAndGenerate()
