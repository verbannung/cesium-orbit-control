import { defineConfig, type Plugin } from 'vite'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(rootDir, '..')
const engineRoot = path.resolve(projectRoot, 'node_modules/@cesium/engine')
const engineBuild = path.resolve(engineRoot, 'Build')
const engineAssets = path.resolve(engineRoot, 'Source/Assets')

function serveCesiumAssets(): Plugin {
  const copyDirs = [
    { from: path.join(engineBuild, 'Workers'), to: 'Workers' },
    { from: path.join(engineBuild, 'ThirdParty'), to: 'ThirdParty' },
    { from: engineAssets, to: 'Assets' },
  ] as const

  return {
    name: 'serve-cesium-engine-assets',
    config() {
      return {
        define: {
          CESIUM_BASE_URL: JSON.stringify('/cesium/'),
        },
      }
    },
    configureServer(server) {
      server.middlewares.use('/cesium', (req, res, next) => {
        const reqPath = decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/')
        const candidates = [
          path.join(engineBuild, reqPath),
          path.join(engineAssets, reqPath.replace(/^\/?Assets\/?/, '')),
          path.join(engineRoot, 'Source', reqPath),
        ]
        const filePath = candidates.find(
          (candidate) =>
            fs.existsSync(candidate) && !fs.statSync(candidate).isDirectory(),
        )
        if (!filePath) {
          next()
          return
        }
        res.setHeader('Content-Type', contentType(filePath))
        fs.createReadStream(filePath).pipe(res)
      })
    },
    closeBundle() {
      const outDir = path.resolve(rootDir, 'dist')
      for (const { from, to } of copyDirs) {
        copyRecursive(from, path.join(outDir, 'cesium', to))
      }
    },
  }
}

function contentType(filePath: string): string {
  if (filePath.endsWith('.js')) return 'application/javascript'
  if (filePath.endsWith('.css')) return 'text/css'
  if (filePath.endsWith('.json')) return 'application/json'
  if (filePath.endsWith('.wasm')) return 'application/wasm'
  if (filePath.endsWith('.png')) return 'image/png'
  if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) return 'image/jpeg'
  if (filePath.endsWith('.svg')) return 'image/svg+xml'
  if (filePath.endsWith('.xml')) return 'application/xml'
  return 'application/octet-stream'
}

function copyRecursive(src: string, dest: string): void {
  if (!fs.existsSync(src)) return
  const stat = fs.statSync(src)
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true })
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry))
    }
    return
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.copyFileSync(src, dest)
}

export default defineConfig({
  root: rootDir,
  envPrefix: ['VITE_', 'CESIUM_'],
  plugins: [serveCesiumAssets()],
  resolve: {
    alias: {
      'cesium-orbit-control': path.resolve(projectRoot, 'src/index.ts'),
    },
    dedupe: ['@cesium/engine'],
  },
  optimizeDeps: {
    include: ['@cesium/engine'],
  },
  server: {
    port: 5173,
    open: false,
  },
  build: {
    outDir: path.resolve(rootDir, 'dist'),
    emptyOutDir: true,
  },
})
