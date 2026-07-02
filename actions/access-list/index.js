/*
Copyright 2025 Adobe. All rights reserved.
Licensed under the Apache License, Version 2.0
*/

// List email→role assignments. Admin-only. Also returns the caller's own
// resolved identity/role and the super-admin list (from .env) for display.

const { Core } = require('@adobe/aio-sdk')
const store = require('../access-store.js')

async function main (params) {
  const logger = Core.Logger('access-list', { level: params.LOG_LEVEL || 'info' })
  try {
    const caller = await store.resolveCaller(params)
    if (caller.role !== 'admin') {
      return { statusCode: 403, body: { ok: false, error: 'Admin role required to view access management.' } }
    }
    const superAdmins = store.superAdminEmails(params)
    const items = Object.entries(caller.assignments)
      .map(([email, role]) => ({ email, role }))
      .sort((a, b) => a.email.localeCompare(b.email))
    return {
      statusCode: 200,
      body: {
        ok: true,
        items,
        superAdmins,
        caller: { email: caller.email, role: caller.role, isSuperAdmin: caller.isSuperAdmin }
      }
    }
  } catch (e) {
    logger.error(e)
    return { statusCode: 500, body: { ok: false, error: e.message || 'access-list failed' } }
  }
}

exports.main = main
