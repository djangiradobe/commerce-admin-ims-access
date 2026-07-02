/*
Copyright 2025 Adobe. All rights reserved.
Licensed under the Apache License, Version 2.0
*/

// Email → role access store for the RBAC add-on.
//
// Roles are resolved by the caller's IMS email, with this precedence:
//   1. email ∈ SUPER_ADMIN_EMAILS (.env)  → 'admin'   (bootstrap; never lockable)
//   2. email ∈ stored assignments (ABDB)  → that role
//   3. otherwise                          → 'viewer'  (least privilege)
//
// Assignments live in a single ABDB doc (system_config_data at
// _system/access/roles) as { assignments: { "email": "role" } }. Emails +
// roles aren't secrets, so the value is stored as plain JSON (not encrypted).

const { getClient } = require('@adobedjangir/commerce-admin-management/abdb')
const { toStateKey } = require('@adobedjangir/commerce-admin-management/shared')

const COLLECTION = 'system_config_data'
const PATH = '_system/access/roles'
const DOC_ID = toStateKey('default', '0', PATH)
const ROLES = ['admin', 'editor', 'viewer']

function normEmail (e) {
  return String(e || '').trim().toLowerCase()
}

function parseEmails (raw) {
  return String(raw || '').split(/[,\s;]+/).map((s) => normEmail(s)).filter(Boolean)
}

function superAdminEmails (params) {
  // Accept either SUPER_ADMIN_EMAILS (list) or SUPER_ADMIN_EMAIL (single).
  return parseEmails(params.SUPER_ADMIN_EMAILS || params.SUPER_ADMIN_EMAIL || '')
}

function pickToken (params) {
  const h = (params && params.__ow_headers) || {}
  const raw = h.authorization || h.Authorization
  return raw ? String(raw).replace(/^Bearer\s+/i, '').trim() : null
}

// Resolve the caller's IMS email from their forwarded bearer token.
async function fetchCallerEmail (params) {
  const token = pickToken(params)
  if (!token) return null
  try {
    const headers = { Authorization: 'Bearer ' + token }
    const key = params.OAUTH_CLIENT_ID || params.IMS_OAUTH_S2S_CLIENT_ID
    if (key) headers['x-api-key'] = key
    const res = await fetch('https://ims-na1.adobelogin.com/ims/profile/v1', { headers })
    if (!res.ok) return null
    const p = await res.json()
    return normEmail(p && p.email)
  } catch (_) { return null }
}

async function ensureCollection (client) {
  try { await client.createCollection(COLLECTION) } catch (err) {
    const m = (err && err.message) ? String(err.message) : String(err)
    if (!/exist|already|duplicate/i.test(m)) throw err
  }
}

async function readAssignments (params) {
  let handle
  try { handle = await getClient(params) } catch (_) { return {} }
  try {
    await ensureCollection(handle.client)
    const col = await handle.client.collection(COLLECTION)
    let doc = null
    try { const arr = await col.find({ _id: DOC_ID }).limit(1).toArray(); doc = arr && arr[0] } catch (_) {}
    if (!doc || !doc.value) return {}
    try {
      const parsed = typeof doc.value === 'string' ? JSON.parse(doc.value) : doc.value
      const map = (parsed && parsed.assignments) || {}
      // Normalise keys to lowercase emails.
      const out = {}
      for (const [k, v] of Object.entries(map)) {
        if (ROLES.includes(v)) out[normEmail(k)] = v
      }
      return out
    } catch (_) { return {} }
  } finally { try { await handle.close() } catch (_) {} }
}

async function writeAssignments (params, assignments) {
  const { client, close } = await getClient(params)
  try {
    await ensureCollection(client)
    const col = await client.collection(COLLECTION)
    const now = new Date().toISOString()
    const value = JSON.stringify({ assignments })
    try {
      await col.updateOne(
        { _id: DOC_ID },
        { $set: { value, updatedAt: now, scope: 'default', scope_id: '0', path: PATH }, $setOnInsert: { _id: DOC_ID, createdAt: now } },
        { upsert: true }
      )
    } catch (err) {
      const arr = await col.find({ _id: DOC_ID }).limit(1).toArray()
      if (arr && arr[0]) await col.updateOne({ _id: DOC_ID }, { $set: { value, updatedAt: now } })
      else await col.insertOne({ _id: DOC_ID, scope: 'default', scope_id: '0', path: PATH, value, createdAt: now, updatedAt: now })
    }
  } finally { try { await close() } catch (_) {} }
}

function resolveRole (email, assignments, params) {
  const e = normEmail(email)
  if (!e) return 'viewer'
  if (superAdminEmails(params).includes(e)) return 'admin'
  const r = assignments && assignments[e]
  return ROLES.includes(r) ? r : 'viewer'
}

// Resolve caller identity + effective role in one shot (reads token + ABDB once).
async function resolveCaller (params) {
  const email = await fetchCallerEmail(params)
  const assignments = await readAssignments(params)
  const role = resolveRole(email, assignments, params)
  return {
    email,
    role,
    isSuperAdmin: !!email && superAdminEmails(params).includes(normEmail(email)),
    assignments
  }
}

module.exports = {
  COLLECTION, PATH, DOC_ID, ROLES,
  normEmail, parseEmails, superAdminEmails,
  fetchCallerEmail, readAssignments, writeAssignments,
  resolveRole, resolveCaller
}
