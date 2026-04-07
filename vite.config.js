import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
// HTTPS in dev: required for getUserMedia on LAN (http://192.168.x.x is not a secure context).
// Browsers will warn about the self-signed cert — proceed once per device.
// Optional: set VITE_DEV_TLS_DOMAINS=192.168.50.89,localhost to reduce name mismatch warnings.
const devTlsDomains = (process.env.VITE_DEV_TLS_DOMAINS || '')
  .split(',')
  .map((d) => d.trim())
  .filter(Boolean)

// Node.js 22.21.0: HTTPS dev + HMR WebSocket upgrade crashes (shouldUpgradeCallback).
// Fixed in 22.21.1+. See https://github.com/nodejs/node/issues/60336
const nodeHttpsHmrBroken = process.version === 'v22.21.0'
const devHttpsOptOut = process.env.VITE_DEV_NO_HTTPS === '1'
const useDevHttps = !nodeHttpsHmrBroken && !devHttpsOptOut

// Avoid noise when Vite loads this config for production builds.
const isNpmBuild = process.env.npm_lifecycle_event === 'build'

if (nodeHttpsHmrBroken && !isNpmBuild) {
  console.warn(
    '\n[vite] Dev HTTPS is disabled on Node.js 22.21.0 (HTTPS + HMR hits a Node bug). ' +
      'Upgrade to Node.js 22.21.1+ or use Node 20 LTS to enable https:// LAN dev for camera APIs.\n'
  )
} else if (devHttpsOptOut && !isNpmBuild) {
  console.warn('\n[vite] Dev HTTPS disabled (VITE_DEV_NO_HTTPS=1).\n')
}

const sslPlugin =
  devTlsDomains.length > 0
    ? basicSsl({ name: 'handyman-tracker-dev', domains: devTlsDomains })
    : basicSsl({ name: 'handyman-tracker-dev' })

export default defineConfig({
  plugins: [react(), ...(useDevHttps ? [sslPlugin] : [])],
  server: {
    host: '0.0.0.0', // Listen on all network interfaces (LAN accessible)
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  // `vite preview` has no dev proxy unless configured — mirror so LAN / relative /api works after build
  preview: {
    host: '0.0.0.0',
    port: 4173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  build: {
    outDir: 'dist'
  }
})
