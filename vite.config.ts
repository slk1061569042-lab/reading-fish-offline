import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * GitHub Pages project site URL: https://<user>.github.io/<REPO_NAME>/
 * Must match the repository name (path segment after github.io).
 */
const GITHUB_PAGES_REPO = 'reading-fish-offline'

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'serve' ? '/' : `/${GITHUB_PAGES_REPO}/`,
}))
