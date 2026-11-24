/**
 * paths.ts — filesystem locations used by the backend.
 *
 * UPLOAD_DIR is where uploaded images are written and served from
 * (the API serves it at /api/uploads/). The same value is used by the
 * upload routes and by the static file plugin, so a relative UPLOAD_DIR is
 * resolved against the backend folder — not against the current directory.
 *
 * The environment must already be loaded (see config/env.ts) when this
 * module is evaluated.
 */
import path from 'path'
import { BACKEND_ROOT } from './env'

function resolveUploadDir(): string {
  const configured = process.env.UPLOAD_DIR
  if (!configured) return path.resolve(BACKEND_ROOT, 'uploads')
  return path.isAbsolute(configured)
    ? configured
    : path.resolve(BACKEND_ROOT, configured)
}

/** Absolute path of the upload directory. */
export const UPLOAD_DIR = resolveUploadDir()
