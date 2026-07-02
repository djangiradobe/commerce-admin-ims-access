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
 * Fail-OPEN when the role can't be resolved (returns null → allowed): a
 * transient IMS/ABDB hiccup must not lock everyone out, and the UI gates
 * visibility regardless. When the role DOES resolve, it is strictly enforced.
 */
async function assertMinRole (params, minRole) {
  const role = await resolveCallerRole(params)
  if (role == null) return null
  if (rank(role) < rank(minRole)) {
    return `This action requires the '${minRole}' role or higher (your role is '${role}').`
  }
  return null
}

module.exports = { checkFieldRole, resolveCallerRole, assertMinRole, ROLE_RANK }
