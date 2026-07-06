"use strict";
/*
Copyright 2025 Adobe. All rights reserved.
Licensed under the Apache License, Version 2.0
*/
Object.defineProperty(exports, "__esModule", { value: true });
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
const { getClient } = require('@adobedjangir/commerce-admin-management/abdb');
const { toStateKey } = require('@adobedjangir/commerce-admin-management/shared');
const COLLECTION = 'system_config_data';
const PATH = '_system/access/roles';
const DOC_ID = toStateKey('default', '0', PATH);
const ROLES = ['admin', 'editor', 'viewer'];
function normEmail(e) {
    return String(e || '').trim().toLowerCase();
}
function parseEmails(raw) {
    return String(raw || '').split(/[,\s;]+/).map((s) => normEmail(s)).filter(Boolean);
}
function superAdminEmails(params) {
    // Accept either SUPER_ADMIN_EMAILS (list) or SUPER_ADMIN_EMAIL (single).
    return parseEmails(params.SUPER_ADMIN_EMAILS || params.SUPER_ADMIN_EMAIL || '');
}
function pickToken(params) {
    const h = (params && params.__ow_headers) || {};
    const raw = h.authorization || h.Authorization;
    return raw ? String(raw).replace(/^Bearer\s+/i, '').trim() : null;
}
// Small per-warm-container cache of token → email. fetchCallerEmail hits the
// IMS profile endpoint on every gated write / profile load; the same user's
// token repeats across requests in a warm container, so caching the lookup
// (short TTL) removes that IMS round-trip from the RBAC hot path. Keyed by a
// short fingerprint of the token (not the token itself); bounded in size.
const _emailCache = new Map(); // fp -> { email, at }
const EMAIL_TTL_MS = 5 * 60 * 1000;
const EMAIL_CACHE_MAX = 200;
function tokenFingerprint(token) {
    // Cheap, non-reversible-ish fingerprint: length + head/tail slices. Enough to
    // distinguish tokens within a container without storing the whole secret.
    const s = String(token);
    return `${s.length}:${s.slice(0, 12)}:${s.slice(-12)}`;
}
// Resolve the caller's IMS email from their forwarded bearer token.
async function fetchCallerEmail(params) {
    const token = pickToken(params);
    if (!token)
        return null;
    const fp = tokenFingerprint(token);
    const now = Date.now();
    const hit = _emailCache.get(fp);
    if (hit && (now - hit.at) < EMAIL_TTL_MS)
        return hit.email;
    try {
        const headers = { Authorization: 'Bearer ' + token };
        const key = params.OAUTH_CLIENT_ID || params.IMS_OAUTH_S2S_CLIENT_ID;
        if (key)
            headers['x-api-key'] = key;
        const res = await fetch('https://ims-na1.adobelogin.com/ims/profile/v1', { headers });
        if (!res.ok)
            return null;
        const p = await res.json();
        const email = normEmail(p && p.email);
        if (_emailCache.size >= EMAIL_CACHE_MAX)
            _emailCache.clear(); // simple bound
        _emailCache.set(fp, { email, at: now });
        return email;
    }
    catch (_) {
        return null;
    }
}
async function ensureCollection(client) {
    try {
        await client.createCollection(COLLECTION);
    }
    catch (err) {
        const m = (err && err.message) ? String(err.message) : String(err);
        if (!/exist|already|duplicate/i.test(m))
            throw err;
    }
}
// Per-warm-container cache of the email→role map. RBAC gates (assertMinRole)
// and ims-user-profile read this on every gated write / page load, so caching
// it briefly removes a repeated ABDB round-trip from the hot path. TTL bounds
// cross-container staleness (a role change made elsewhere is visible within
// ASSIGN_TTL_MS); a write in THIS container clears the cache immediately.
let _assignCache = null;
let _assignCacheAt = 0;
const ASSIGN_TTL_MS = 30 * 1000;
async function readAssignments(params) {
    const now = Date.now();
    if (_assignCache && (now - _assignCacheAt) < ASSIGN_TTL_MS)
        return _assignCache;
    let handle;
    try {
        handle = await getClient(params);
    }
    catch (_) {
        return {};
    }
    try {
        await ensureCollection(handle.client);
        const col = await handle.client.collection(COLLECTION);
        let doc = null;
        try {
            const arr = await col.find({ _id: DOC_ID }).limit(1).toArray();
            doc = arr && arr[0];
        }
        catch (_) { }
        if (!doc || !doc.value) {
            _assignCache = {};
            _assignCacheAt = now;
            return {};
        }
        try {
            const parsed = typeof doc.value === 'string' ? JSON.parse(doc.value) : doc.value;
            const map = (parsed && parsed.assignments) || {};
            // Normalise keys to lowercase emails.
            const out = {};
            for (const [k, v] of Object.entries(map)) {
                if (ROLES.includes(v))
                    out[normEmail(k)] = v;
            }
            _assignCache = out;
            _assignCacheAt = now;
            return out;
        }
        catch (_) {
            return {};
        }
    }
    finally {
        try {
            await handle.close();
        }
        catch (_) { }
    }
}
async function writeAssignments(params, assignments) {
    // Invalidate the local cache so the caller sees its own write immediately.
    _assignCache = null;
    _assignCacheAt = 0;
    const { client, close } = await getClient(params);
    try {
        await ensureCollection(client);
        const col = await client.collection(COLLECTION);
        const now = new Date().toISOString();
        const value = JSON.stringify({ assignments });
        try {
            await col.updateOne({ _id: DOC_ID }, { $set: { value, updatedAt: now, scope: 'default', scope_id: '0', path: PATH }, $setOnInsert: { _id: DOC_ID, createdAt: now } }, { upsert: true });
        }
        catch (err) {
            const arr = await col.find({ _id: DOC_ID }).limit(1).toArray();
            if (arr && arr[0])
                await col.updateOne({ _id: DOC_ID }, { $set: { value, updatedAt: now } });
            else
                await col.insertOne({ _id: DOC_ID, scope: 'default', scope_id: '0', path: PATH, value, createdAt: now, updatedAt: now });
        }
    }
    finally {
        try {
            await close();
        }
        catch (_) { }
    }
}
function resolveRole(email, assignments, params) {
    const e = normEmail(email);
    if (!e)
        return 'viewer';
    if (superAdminEmails(params).includes(e))
        return 'admin';
    const r = assignments && assignments[e];
    return ROLES.includes(r) ? r : 'viewer';
}
// Resolve caller identity + effective role in one shot (reads token + ABDB once).
async function resolveCaller(params) {
    const email = await fetchCallerEmail(params);
    const assignments = await readAssignments(params);
    const role = resolveRole(email, assignments, params);
    return {
        email,
        role,
        isSuperAdmin: !!email && superAdminEmails(params).includes(normEmail(email)),
        assignments
    };
}
module.exports = {
    COLLECTION, PATH, DOC_ID, ROLES,
    normEmail, parseEmails, superAdminEmails,
    fetchCallerEmail, readAssignments, writeAssignments,
    resolveRole, resolveCaller
};
