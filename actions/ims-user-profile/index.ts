/*
Copyright 2025 Adobe. All rights reserved.
Licensed under the Apache License, Version 2.0
*/

// Returns the calling user's IMS profile + effective role so the UI can
// hide/disable fields based on `requiredRole` declared in the schema.
//
// Role model (email-based RBAC, managed in the Access Management UI):
//   1. email ∈ SUPER_ADMIN_EMAILS (.env)   → 'admin'
//   2. email ∈ stored assignments (ABDB)   → that role
//   3. otherwise                           → 'viewer'
// The caller forwards their user IMS token (require-adobe-auth: false; the
// token itself is the identity — we read the email from /ims/profile/v1).

const { Core } = require('@adobe/aio-sdk')
const { errorResponse } = require('@adobedjangir/commerce-admin-management/actions/utils')
const store = require('../access-store.js')

function parseList (v) {
  if (!v) return []
  return String(v).split(',').map((s) => s.trim()).filter(Boolean)
}

function pickFirstHeader (headers, names) {
  if (!headers) return null
  for (const n of names) {
    if (headers[n]) return String(headers[n]).replace(/^Bearer\s+/i, '').trim()
  }
  return null
}

async function fetchProfile (token, clientId) {
  if (!token) return null
  try {
    // IMS /ims/profile/v1 requires BOTH the Bearer token AND an x-api-key
    // header (the client id). Without x-api-key it returns 401/400 and we'd
    // get a null profile even for a perfectly valid token.
    const headers = { Authorization: `Bearer ${token}` }
    if (clientId) headers['x-api-key'] = clientId
    const res = await fetch('https://ims-na1.adobelogin.com/ims/profile/v1', { headers })
    if (!res.ok) return null
    return await res.json()
  } catch (_) { return null }
}

// Decode a JWT's payload (claims) without verifying the signature — we only
// read identity/role hints the caller already presented, so verification is
// the token issuer's job, not ours.
function decodeJwtClaims (token) {
  try {
    const part = String(token).split('.')[1]
    if (!part) return null
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const json = Buffer.from(b64, 'base64').toString('utf8')
    return JSON.parse(json)
  } catch (_) { return null }
}

// Extract role/group identifiers straight from the token claims. Requires the
// token to have been minted with `additional_info.roles` and
// `additional_info.projectedProductContext` scopes (see mint config). This is
// far more reliable than the /organizations endpoint — the identifiers are
// already in the token the caller presented.
function groupsFromTokenClaims (token) {
  const claims = decodeJwtClaims(token)
  if (!claims) return []
  const out = new Set()
  // `roles` (from additional_info.roles): [{ organization, named-role, target, principal }]
  const roles = Array.isArray(claims.roles) ? claims.roles : []
  for (const r of roles) {
    if (!r) continue
    if (r['named-role']) out.add(String(r['named-role']))
    if (r.role) out.add(String(r.role))
    if (r.principal && r.organization) out.add(`${r.organization}:${r['named-role'] || r.role || ''}`)
  }
  // `projectedProductContext` (from additional_info.projectedProductContext):
  // [{ prodCtx: { serviceCode, label, groupid, ... } }]
  const ppc = Array.isArray(claims.projectedProductContext) ? claims.projectedProductContext : []
  for (const p of ppc) {
    const ctx = (p && p.prodCtx) ? p.prodCtx : p
    if (!ctx) continue
    if (ctx.label) out.add(String(ctx.label))
    if (ctx.serviceCode) out.add(String(ctx.serviceCode))
    if (ctx.groupid != null) out.add('group:' + ctx.groupid)
  }
  return Array.from(out).filter(Boolean)
}

async function fetchGroups (token, clientId) {
  if (!token) return []
  // Primary source: the token's own role/product-context claims. Reliable and
  // needs no extra network call.
  const fromClaims = groupsFromTokenClaims(token)
  if (fromClaims.length) return fromClaims
  // Fallback: the IMS organizations endpoint (best-effort; parsing varies by
  // IMS version, so a miss just yields an empty list → viewer).
  try {
    const url = 'https://ims-na1.adobelogin.com/ims/organizations/v6'
    const headers = { Authorization: `Bearer ${token}` }
    if (clientId) headers['x-api-key'] = clientId
    const res = await fetch(url, { headers })
    if (!res.ok) return []
    const orgs = await res.json()
    const groups = []
    for (const org of (Array.isArray(orgs) ? orgs : [])) {
      for (const g of (org.groups || [])) {
        if (g && g.groupName) groups.push(String(g.groupName))
      }
    }
    return groups
  } catch (_) { return [] }
}

function resolveRole (groups, params) {
  const adminGroups = parseList(params.ROLE_MAP_ADMIN)
  const editorGroups = parseList(params.ROLE_MAP_EDITOR)
  const viewerGroups = parseList(params.ROLE_MAP_VIEWER)
  const has = (list) => list.some((g) => groups.includes(g))
  if (has(adminGroups)) return 'admin'
  if (has(editorGroups)) return 'editor'
  if (has(viewerGroups)) return 'viewer'
  return 'viewer'
}

async function main (params) {
  const logger = Core.Logger('ims-user-profile', { level: params.LOG_LEVEL || 'info' })
  const token = pickFirstHeader(params.__ow_headers, ['authorization', 'Authorization'])
  try {
    const profile: any = await fetchProfile(token, params.OAUTH_CLIENT_ID)
    const email = (profile && profile.email) ? profile.email : await store.fetchCallerEmail(params)
    // Role from the email-based store: super-admin (.env) → assignment → viewer.
    const assignments = await store.readAssignments(params)
    const role = store.resolveRole(email, assignments, params)
    const isSuperAdmin = !!email && store.superAdminEmails(params).includes(store.normEmail(email))
    return {
      statusCode: 200,
      // Per-user response (role/identity varies by caller) — never cache it.
      // A shared cache keys on URL, not the Authorization header, so caching
      // would risk serving one user's role to another.
      headers: { 'Cache-Control': 'no-store' },
      body: {
        ok: true,
        role,
        isSuperAdmin,
        source: 'email-rbac',
        // `groups` retained for UI back-compat; now reflects the resolution source.
        groups: isSuperAdmin ? ['super-admin (.env)'] : (assignments[store.normEmail(email)] ? ['assigned: ' + role] : []),
        profile: profile
          ? { email: profile.email, userId: profile.userId, displayName: profile.displayName }
          : (email ? { email } : null)
      }
    }
  } catch (error) {
    logger.error(error)
    return errorResponse(500, error.message || 'profile fetch failed', logger)
  }
}

exports.main = main
