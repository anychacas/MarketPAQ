/**
 * env.ts — loads backend/.env into process.env.
 *
 * In production the environment comes from the process manager (docker
 * compose, systemd, …) and no .env file exists. For local development the
 * .env file next to backend/package.json is the natural place for the
 * configuration, so it is loaded here.
 *
 * Rules:
 *   - Variables that already exist in the environment always win, so an
 *     orchestrator can override anything the file defines.
 *   - Missing files are ignored (production has none).
 *
 * Import this module FIRST (before any module that reads process.env) —
 * see the import order in src/index.ts.
 */
import fs from 'node:fs'
import path from 'node:path'

/**
 * Root of the backend package.
 * Works for both layouts: backend/src/config (tsx) and backend/dist/config (compiled).
 */
export const BACKEND_ROOT = path.resolve(__dirname, '..', '..')

/** Parses the content of a .env file into a plain object. */
export function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const withoutExport = line.startsWith('export ') ? line.slice(7).trim() : line
    const eq = withoutExport.indexOf('=')
    if (eq === -1) continue
    const key = withoutExport.slice(0, eq).trim()
    if (!key) continue
    let value = withoutExport.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
      (value.startsWith("'") && value.endsWith("'") && value.length > 1)
    ) {
      value = value.slice(1, -1)
    }
    result[key] = value
  }
  return result
}

/**
 * Reads a .env file and fills in the variables that are not set yet.
 * Returns true when the file was read.
 */
export function loadEnvFile(filePath: string): boolean {
  if (!fs.existsSync(filePath)) return false
  const parsed = parseEnvFile(fs.readFileSync(filePath, 'utf8'))
  for (const [key, value] of Object.entries(parsed)) {
    if (key in process.env) continue
    process.env[key] = value
  }
  return true
}

/** Loads backend/.env (if present) into process.env. */
export function loadEnv(): boolean {
  return loadEnvFile(path.join(BACKEND_ROOT, '.env'))
}

// Side effect on import: every module that imports this file gets the values
// from backend/.env before it reads process.env.
loadEnv()
