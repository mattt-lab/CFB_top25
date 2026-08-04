import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  // GitHub Pages serves this repo from https://mattt-lab.github.io/CFB_top25/ — production
  // builds need that prefix on every asset URL, or the deployed build 404s on refresh/direct
  // links. Local dev stays at the root so `npm run dev` / preview_start keep working normally.
  base: command === 'build' ? '/CFB_top25/' : '/',
}))
