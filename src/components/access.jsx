/**
 * Centralized access control helpers
 * All user permission checks should use these functions
 */

/**
 * Check if user has developer access (developer, partner_leader, or admin).
 * Partner Líderes are also developers: they can publish add-ons and have a developer profile.
 */
export function isDeveloper(user) {
  if (!user) return false;
  return (
    user.userType === 'developer' ||
    user.userType === 'partner_leader' ||
    user.role === 'admin'
  );
}

/**
 * Check if user is a plain partner (userType === 'partner')
 */
export function isPartner(user) {
  if (!user) return false;
  return user.userType === 'partner';
}

/**
 * Check if user is a Partner Líder (userType === 'partner_leader')
 */
export function isPartnerLeader(user) {
  if (!user) return false;
  return user.userType === 'partner_leader';
}

/**
 * Check if user can publish add-ons.
 * Admin bypass OR (isDeveloper AND canPublishAddons flag set by backend).
 */
export function canPublish(user) {
  if (!user) return false;
  return user.role === 'admin' || (isDeveloper(user) && user.canPublishAddons === true);
}

/**
 * Check if user needs to complete onboarding
 */
export function needsOnboarding(user) {
  if (!user) return true;
  return user.onboardingComplete !== true || !user.userType || user.userType === 'unset';
}

/**
 * Check if user has access to developer profile features (same as isDeveloper).
 */
export function canAccessDeveloperProfile(user) {
  if (!user) return false;
  return isDeveloper(user);
}
