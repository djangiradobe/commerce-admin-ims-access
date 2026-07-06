/*
Copyright 2025 Adobe. All rights reserved.
Licensed under the Apache License, Version 2.0
*/

// useUserRole — fetches the caller's resolved role (admin/editor/viewer)
// from the ims-user-profile action and caches it for the session. Falls
// back to 'admin' when the action is unreachable or returns no role (e.g.
// raw localhost / no IMS token available) so dev isn't blocked.
//
// The action is `require-adobe-auth: false` and self-authenticates from the
// forwarded Bearer token. We fetch once on mount and cache ONLY on success —
// a failed/empty response is never cached, so a later mount (once the IMS
// context is available) can still resolve.

import { useEffect, useRef, useState } from 'react'
import { callAction } from '@adobedjangir/commerce-admin-management/web'
import { getActionKey } from '@adobedjangir/commerce-admin-management/web'

let CACHED = null

export function useUserRole (props) {
  const [state, setState] = useState(() => CACHED || { loading: true, role: 'admin', groups: [], profile: null })
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    if (CACHED) { setState(CACHED); return () => { mounted.current = false } }

    ;(async () => {
      try {
        const res = await callAction(props, getActionKey('imsUserProfile'), '', {})
        const body = res?.body || res
        if (body && body.ok && body.role) {
          CACHED = { loading: false, role: body.role, groups: body.groups || [], profile: body.profile || null }
          if (mounted.current) setState(CACHED)
          return
        }
      } catch (_) { /* fall through to soft fallback */ }
      // Unreachable or no role — default to admin so we don't lock the dev
      // user out. NOT cached, so a later mount can still resolve. The server
      // still enforces requiredRole based on whatever role is passed in.
      if (mounted.current) setState({ loading: false, role: 'admin', groups: [], profile: null })
    })()

    return () => { mounted.current = false }
  }, [])

  return state
}

export const ROLE_RANK = { viewer: 0, editor: 1, admin: 2 }

export function hasRole (userRole, required) {
  if (!required) return true
  return (ROLE_RANK[userRole] ?? -1) >= (ROLE_RANK[required] ?? 99)
}
