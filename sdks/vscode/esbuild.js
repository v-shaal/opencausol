const esbuild = require("esbuild")

const production = process.argv.includes("--production")
const watch = process.argv.includes("--watch")

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
  name: "esbuild-problem-matcher",

  setup(build) {
    build.onStart(() => {
      console.log("[watch] build started")
    })
    build.onEnd((result) => {
      result.errors.forEach(({ text, location }) => {
        console.error(`✘ [ERROR] ${text}`)
        console.error(`    ${location.file}:${location.line}:${location.column}:`)
      })
      console.log("[watch] build finished")
    })
  },
}

async function main() {
  const builds = [
    {
      name: "extension",
      options: {
        entryPoints: ["src/extension.ts"],
        bundle: true,
        format: "cjs",
        minify: production,
        sourcemap: !production,
        sourcesContent: false,
        platform: "node",
        target: "node18",
        outfile: "dist/extension.js",
        external: ["vscode"],
        logLevel: "silent",
      },
    },
    {
      name: "rtc-webview",
      options: {
        entryPoints: ["src/webview/rtcNotebook.ts"],
        bundle: true,
        format: "iife",
        minify: production,
        sourcemap: !production,
        platform: "browser",
        target: "es2020",
        outfile: "media/rtc-notebook.js",
        legalComments: "none",
        logLevel: "silent",
      },
    },
  ]

  if (watch) {
    const contexts = []
    for (const build of builds) {
      const ctx = await esbuild.context({
        ...build.options,
        plugins: [esbuildProblemMatcherPlugin],
      })
      await ctx.watch()
      contexts.push(ctx)
    }
  } else {
    for (const build of builds) {
      await esbuild.build({
        ...build.options,
      })
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
