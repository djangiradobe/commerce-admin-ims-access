/*
Copyright 2025 Adobe. All rights reserved.
Licensed under the Apache License, Version 2.0
*/

// Remove an email→role assignment. Admin-only. Removing a stored assignment
// drops that user back to the default 'viewer'. Super-admins (.env) can't be
// removed here — they're not stored assignments.

const { Core } = require('@adobe/aio-sdk')
const store = require('../access-store.js')

async function main (params) {
  const logger = Core.Logger('access-delete', { level: params.LOG_LEVEL || 'info' })
  try {
    const email = store.normEmail(params.email)
    if (!email) return { statusCode: 400, body: { ok: false, error: 'email is required.' } }

    const caller = await store.resolveCaller(params)
    if (caller.role !== 'admin') {
      return { statusCode: 403, body: { ok: false, error: 'Admin role required to change access.' } }
    }
    if (store.superAdminEmails(params).includes(email)) {
      return { statusCode: 400, body: { ok: false, error: 'That email is a super-admin (configured in .env); remove it from .env instead.' } }
    }

    const assignments = { ...caller.assignments }
    if (!(email in assignments)) {
      return { statusCode: 200, body: { ok: true, email, removed: false } }
    }
    delete assignments[email]
    await store.writeAssignments(params, assignments)
    return { statusCode: 200, body: { ok: true, email, removed: true } }
  } catch (e) {
    logger.error(e)
    return { statusCode: 500, body: { ok: false, error: e.message || 'access-delete failed' } }
  }
}

export { main }
