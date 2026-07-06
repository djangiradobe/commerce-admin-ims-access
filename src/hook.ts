/*
Copyright 2025 Adobe. All rights reserved.
Licensed under the Apache License, Version 2.0
*/

// Server-side hook for core's RBAC gate. Core soft-requires this when
// enforcing field-level requiredRole, so the role rank table lives with
// the add-on (not in core). When not installed, core treats the caller as
// admin (fail-open) — the UI side enforces visibility regardless.

const store = require('../actions/access-store.js')

const ROLE_RANK = { viewer: 0, editor: 1, admin: 2 }
function rank (r) { return ROLE_RANK[r] ?? -1 }

/**
 * Compare a caller-supplied role against a field's requiredRole.
 * Returns `null` when allowed, or a string error message when blocked.
 */
function checkFieldRole (callerRole, field) {
  if (!field || !field.requiredRole) return null
  if (!callerRole) return null // can't enforce without a role hint
  const need = ROLE_RANK[field.requiredRole] ?? 99
  const have = ROLE_RANK[callerRole] ?? -1
  if (have < need) {
    return `requires '${field.requiredRole}' role (caller has '${callerRole}')`
  }
  return null
}

/**
 * SERVER-SIDE role resolution — the trustworthy source. Reads the caller's IMS
 * email from their forwarded token, then resolves super-admin (.env) →
 * assignment (ABDB) → viewer. Returns the role string, or null when it
 * genuinely can't resolve (no token / IMS or ABDB error).
 */
async function resolveCallerRole (params) {
  try {
    const caller = await store.resolveCaller(params)
    return (caller && caller.role) || 'viewer'
  } catch (_) {
    return null
  }
}

/**
 * Gate an action on a minimum role. Returns null when allowed, or an error
 * message when the caller's role is below `minRole`.
 *
 * By default fail-OPEN when the caller's role can't be RESOLVED (a transient
 * IMS/ABDB hiccup returns null → allowed) so an outage doesn't lock everyone
 * out. Note an unauthenticated/invalid token resolves to 'viewer', so admin/
 * editor gates already deny it — fail-open only concerns hard resolution errors.
 *
 * @param {object} opts
 * @param {boolean} [opts.failClosed] deny (return an error) when the role
 *        can't be resolved. Use for sensitive actions (credential export/write)
 *        where "allow on error" is the wrong default.
 */
async function assertMinRole (params, minRole, opts: any = {}) {
  let caller = null
  let resolutionError = false
  try { caller = await store.resolveCaller(params) } catch (_) { resolutionError = true }

  if (resolutionError || !caller) {
    return opts.failClosed
      ? `Could not verify your access — denying (this action requires the '${minRole}' role).`
      : null
  }
  const role = caller.role || 'viewer'
  if (rank(role) < rank(minRole)) {
    return `This action requires the '${minRole}' role or higher (your role is '${role}').`
  }
  return null
}

/**
 * Authentication check: require a VALID Adobe IMS identity behind the token
 * (email resolved from IMS). Returns null when authenticated, or an error
 * message when the token is missing/invalid. Use for actions that must not
 * run for an unauthenticated caller regardless of role (e.g. a REST proxy
 * that uses server-held Commerce credentials).
 */
async function assertValidCaller (params) {
  // Only needs to confirm a valid IMS identity — resolve the email straight
  // from IMS (no ABDB read / role lookup).
  let email = null
  try { email = await store.fetchCallerEmail(params) } catch (_) { email = null }
  if (!email) return 'A valid Adobe IMS token is required for this action.'
  return null
}

export { checkFieldRole, resolveCallerRole, assertMinRole, assertValidCaller, ROLE_RANK }
