import 'dotenv-flow/config'
import fs from 'fs-extra'
import path from 'path'
import { fork } from 'child_process'
import * as esbuild from 'esbuild'
import { fileURLToPath } from 'url'

const dev = process.argv.includes('--dev')
const dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(dirname, './')
const buildDir = path.join(rootDir, 'build')

await fs.emptyDir(buildDir)

/**
 * Build Client
 */

const clientPublicDir = path.join(rootDir, 'src/client/public')
const clientBuildDir = path.join(rootDir, 'build/public')
const clientHtmlSrc = path.join(rootDir, 'src/client/public/index.html')
const clientHtmlDest = path.join(rootDir, 'build/public/index.html')

{
  const clientCtx = await esbuild.context({
    entryPoints: [path.join(rootDir, 'src/client/index.js')],
    entryNames: '/[name]-[hash]',
    outdir: clientBuildDir,
    platform: 'browser',
    format: 'esm',
    bundle: true,
    treeShaking: true,
    minify: false,
    sourcemap: true,
    metafile: true,
    jsx: 'automatic',
    jsxImportSource: '@firebolt-dev/jsx',
    resolveExtensions: ['.js', '.jsx'],
    absWorkingDir: rootDir,
    define: {
      // 'process.env.NODE_ENV': '"development"',
    },
    loader: {
      '.js': 'jsx',
    },
    alias: {
      react: 'react', // always use our own local react (jsx)
    },
    plugins: [
      {
        name: 'client-finalize-plugin',
        setup(build) {
          build.onEnd(async result => {
            // Skip processing if build failed
            if (result.errors.length > 0) {
              return
            }
            
            // copy over public files
            await fs.copy(clientPublicDir, clientBuildDir)
            // find js output file
            const metafile = result.metafile
            const outputFiles = Object.keys(metafile.outputs)
            const jsFile = outputFiles.find(file => file.endsWith('.js')).split('build/public')[1]
            // inject into html and copy over
            let htmlContent = await fs.readFile(clientHtmlSrc, 'utf-8')
            htmlContent = htmlContent.replace('{jsFile}', jsFile)
            htmlContent = htmlContent.replaceAll('{buildId}', Date.now())
            await fs.writeFile(clientHtmlDest, htmlContent)
          })
        },
      },
    ],
  })
  if (dev) {
    await clientCtx.watch()
  } else {
    await clientCtx.rebuild()
  }
}

/**
 * Build Server
 */

let spawn

{
  const serverCtx = await esbuild.context({
    entryPoints: [path.join(rootDir, 'src/server/index.js')],
    outfile: path.join(buildDir, 'index.js'),
    platform: 'node',
    format: 'esm',
    bundle: true,
    treeShaking: true,
    minify: false,
    sourcemap: true,
    packages: 'external',
    resolveExtensions: ['.js', '.jsx'],
    define: {
      'process.env.CLIENT': 'false',
      'process.env.SERVER': 'true',
    },
    plugins: [
      {
        name: 'server-finalize-plugin',
        setup(build) {
          build.onEnd(async result => {
            // Skip processing if build failed
            if (result.errors.length > 0) {
              return
            }
            
            // copy over physx wasm
            const physxWasmSrc = path.join(rootDir, 'src/server/physx/physx-js-webidl.wasm')
            const physxWasmDest = path.join(buildDir, 'physx-js-webidl.wasm')
            await fs.copy(physxWasmSrc, physxWasmDest)
            // start the server or stop here
            if (dev) {
              // (re)start server
              spawn?.kill('SIGTERM')
              spawn = fork(path.join(buildDir, 'index.js'))
            } else {
              process.exit(1)
            }
          })
        },
      },
    ],
    loader: {
      '.js': 'jsx',
    },
  })
  if (dev) {
    await serverCtx.watch()
  } else {
    await serverCtx.rebuild()
  }
}
