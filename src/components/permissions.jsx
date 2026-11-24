// Admin allowlist — used only for frontend gating (the backend enforces access).
// Set VITE_ADMIN_EMAILS (comma-separated) at build time; no admins when unset.
// Backend mirrors this via ADMIN_EMAILS env var (see backend/.env.example).

function getAdminEmails() {
  const raw = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ADMIN_EMAILS)
    ? import.meta.env.VITE_ADMIN_EMAILS
    : '';
  return raw.split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
}

/**
 * Verifica si un usuario es administrador basado en email
 * @param {Object} user - Usuario de api.auth.me()
 * @returns {boolean}
 */
export function isAdmin(user) {
  if (!user) return false;
  const email = (user.email || user.primaryEmail || '').toLowerCase().trim();
  return Boolean(email) && getAdminEmails().includes(email);
}

/**
 * Verifica si un usuario puede aprobar add-ons
 * @param {Object} user
 * @returns {boolean}
 */
export function canApproveAddons(user) {
  return isAdmin(user);
}

/**
 * Verifica si un usuario puede gestionar clasificaciones
 * @param {Object} user
 * @returns {boolean}
 */
export function canManageClassifications(user) {
  return isAdmin(user);
}

/**
 * Verifica si un usuario puede ver panel de administración
 * @param {Object} user
 * @returns {boolean}
 */
export function canAccessAdminPanel(user) {
  return isAdmin(user);
}
