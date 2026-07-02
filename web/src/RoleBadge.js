/*
Copyright 2025 Adobe. All rights reserved.
Licensed under the Apache License, Version 2.0
*/

// RoleBadge — small pill in the top nav showing the operator's resolved
// role (admin / editor / viewer). Clicking opens a popover with the full
// resolved identity + IMS group list. Sourced from useUserRole.

import React from 'react'
import {
  DialogTrigger, ActionButton, Dialog, Heading, Content, Divider, Text, View
} from '@adobe/react-spectrum'
import { useUserRole } from './useUserRole'
import { PALETTE, RADIUS } from '@adobedjangir/commerce-admin-management/web'

function tone (role) {
  if (role === 'admin') return PALETTE.danger
  if (role === 'editor') return PALETTE.accent
  return PALETTE.neutralText
}
function bg (role) {
  if (role === 'admin') return PALETTE.dangerSoft || '#fee2e2'
  if (role === 'editor') return PALETTE.accentSoft || '#e8f1fc'
  return PALETTE.neutralSoft || '#eef2f7'
}

export default function RoleBadge ({ runtime, ims }) {
  const { loading, role, groups, profile } = useUserRole({ runtime, ims })

  return (
    <DialogTrigger type="popover">
      <ActionButton
        isQuiet
        UNSAFE_style={{
          padding: '4px 12px',
          borderRadius: RADIUS.pill,
          background: bg(role),
          color: tone(role),
          fontWeight: 700,
          fontSize: 11,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          border: 0
        }}
      >
        {loading ? '…' : role}
      </ActionButton>
      <Dialog>
        <Heading>My access</Heading>
        <Divider size="S" />
        <Content>
          <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', rowGap: 8, fontSize: 13 }}>
            <div style={{ color: PALETTE.textMuted, fontWeight: 600 }}>Role</div>
            <div><span style={{
              padding: '2px 8px',
              borderRadius: RADIUS.pill,
              background: bg(role),
              color: tone(role),
              fontWeight: 700,
              fontSize: 11,
              textTransform: 'uppercase'
            }}>{role}</span></div>

            <div style={{ color: PALETTE.textMuted, fontWeight: 600 }}>Email</div>
            <div style={{ wordBreak: 'break-all' }}>{profile?.email || '—'}</div>

            <div style={{ color: PALETTE.textMuted, fontWeight: 600 }}>User ID</div>
            <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12 }}>{profile?.userId || '—'}</div>

            <div style={{ color: PALETTE.textMuted, fontWeight: 600 }}>Display name</div>
            <div>{profile?.displayName || '—'}</div>

            <div style={{ color: PALETTE.textMuted, fontWeight: 600 }}>IMS groups</div>
            <div>
              {groups && groups.length > 0
                ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {groups.map((g) => (
                      <span key={g} style={{
                        padding: '2px 8px',
                        borderRadius: RADIUS.pill,
                        background: PALETTE.neutralSoft || '#eef2f7',
                        fontSize: 11,
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace'
                      }}>{g}</span>
                    ))}
                  </div>
                )
                : <Text UNSAFE_style={{ color: PALETTE.textMuted }}>none returned</Text>
              }
            </div>
          </div>

        </Content>
      </Dialog>
    </DialogTrigger>
  )
}
