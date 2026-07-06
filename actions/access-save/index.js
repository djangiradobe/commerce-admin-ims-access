"use strict";
/*
Copyright 2025 Adobe. All rights reserved.
Licensed under the Apache License, Version 2.0
*/
Object.defineProperty(exports, "__esModule", { value: true });
// Assign a role to an email. Admin-only. Server-side gated: the caller must
// resolve to 'admin' (super-admin from .env or an assigned admin) — this
// prevents a viewer/editor from granting themselves a higher role.
const { Core } = require('@adobe/aio-sdk');
const store = require('../access-store.js');
async function main(params) {
    const logger = Core.Logger('access-save', { level: params.LOG_LEVEL || 'info' });
    try {
        const email = store.normEmail(params.email);
        const role = String(params.role || '').trim().toLowerCase();
        if (!email || !email.includes('@')) {
            return { statusCode: 400, body: { ok: false, error: 'A valid email is required.' } };
        }
        if (!store.ROLES.includes(role)) {
            return { statusCode: 400, body: { ok: false, error: "role must be one of 'admin', 'editor', 'viewer'." } };
        }
        const caller = await store.resolveCaller(params);
        if (caller.role !== 'admin') {
            return { statusCode: 403, body: { ok: false, error: 'Admin role required to change access.' } };
        }
        if (store.superAdminEmails(params).includes(email)) {
            return { statusCode: 400, body: { ok: false, error: 'That email is a super-admin (configured in .env) and always has admin — no change needed.' } };
        }
        const assignments = { ...caller.assignments, [email]: role };
        await store.writeAssignments(params, assignments);
        return { statusCode: 200, body: { ok: true, email, role } };
    }
    catch (e) {
        logger.error(e);
        return { statusCode: 500, body: { ok: false, error: e.message || 'access-save failed' } };
    }
}
exports.main = main;
