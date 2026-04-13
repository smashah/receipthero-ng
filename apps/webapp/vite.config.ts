import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

function parseAllowedHosts() {
  const rawHosts = process.env.ALLOWED_HOSTS || process.env.VITE_ALLOWED_HOSTS

  if (!rawHosts || rawHosts.trim().length === 0) {
    return undefined
  }

  if (rawHosts.trim() === '*') {
    return true
  }

  return rawHosts
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean)
}

const allowedHosts = parseAllowedHosts()

const config = defineConfig({
  plugins: [
    devtools(),
    nitro(),
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
  server: {
    host: true,
    ...(allowedHosts !== undefined ? { allowedHosts } : {}),
  },
  preview: {
    host: true,
    ...(allowedHosts !== undefined ? { allowedHosts } : {}),
  },
})

export default config
