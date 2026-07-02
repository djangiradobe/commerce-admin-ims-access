/*
Copyright 2025 Adobe. All rights reserved.
Licensed under the Apache License, Version 2.0
*/

// MyAccess — shows the operator's resolved role + IMS groups, and which
// schema fields require which role (so it's clear what they can/can't edit).

import React, { useMemo } from 'react'
import { View, Heading, Text, ProgressCircle, Flex } from '@adobe/react-spectrum'
import { useUserRole, hasRole } from './useUserRole'
import { useSystemConfigSchema } from '@adobedjangir/commerce-admin-management/web'
import { PALETTE, RADIUS, SHADOW } from '@adobedjangir/commerce-admin-management/web'

function rolePill (role) {
  const tone = role === 'admin' ? PALETTE.danger
    : role === 'editor' ? PALETTE.accent
      : role === 'viewer' ? PALETTE.neutralText
        : PALETTE.textMuted
  const bg = role === 'admin' ? (PALETTE.dangerSoft || '#fee2e2')
    : role === 'editor' ? (PALETTE.accentSoft || '#e8f1fc')
      : (PALETTE.neutralSoft || '#eef2f7')
  return (
    <span style={{
      padding: '2px 10px',
      borderRadius: RADIUS.pill,
      background: bg,
      color: tone,
      fontWeight: 700,
      fontSize: 11,
      letterSpacing: 0.4,
      textTransform: 'uppercase'
    }}>{role || '—'}</span>
  )
}

export default function MyAccess (props) {
  const { loading, role, groups, profile } = useUserRole(props)
  const { schema, loading: schemaLoading } = useSystemConfigSchema(props)

  // Bucket every schema field by its required role so the user can see at
  // a glance what they can edit.
  const buckets = useMemo(() => {
    const out = { admin: [], editor: [], viewer: [], anyone: [] }
    if (!schema || !Array.isArray(schema.sections)) return out
    for (const s of schema.sections) {
      for (const g of (s.groups || [])) {
        for (const f of (g.fields || [])) {
          const required = f.requiredRole
          const key = required ? required : 'anyone'
          if (!out[key]) continue
          out[key].push({
            section: s.label || s.id,
            group: g.label || g.id,
            field: f.label || f.id,
            path: `${s.id}/${g.id}/${f.id}`,
            sensitive: !!f.sensitive
          })
        }
      }
    }
    return out
  }, [schema])

  const userCanEdit = (required) => hasRole(role, required)

  return (
    <View padding="size-400" UNSAFE_style={{ background: PALETTE.bg, minHeight: '100vh' }}>
      <Heading level={2} marginTop={0}>My access</Heading>
      {/* Identity card */}
      <View
        marginTop="size-200"
        padding="size-300"
        UNSAFE_style={{ background: PALETTE.surface, border: `1px solid ${PALETTE.border}`, borderRadius: RADIUS.lg, boxShadow: SHADOW.xs }}
      >
        {loading ? (
          <Flex alignItems="center" gap="size-100"><ProgressCircle size="S" isIndeterminate aria-label="Loading" /><Text>Resolving role…</Text></Flex>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', rowGap: 12, fontSize: 14 }}>
            <div style={{ color: PALETTE.textMuted, fontWeight: 600 }}>Role</div>
            <div>{rolePill(role)}</div>
            <div style={{ color: PALETTE.textMuted, fontWeight: 600 }}>Email</div>
            <div style={{ wordBreak: 'break-all' }}>{profile?.email || '—'}</div>
            <div style={{ color: PALETTE.textMuted, fontWeight: 600 }}>User ID</div>
            <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12 }}>{profile?.userId || '—'}</div>
            <div style={{ color: PALETTE.textMuted, fontWeight: 600 }}>Display name</div>
            <div>{profile?.displayName || '—'}</div>
            <div style={{ color: PALETTE.textMuted, fontWeight: 600 }}>IMS groups</div>
            <div>
              {(groups && groups.length > 0) ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {groups.map((g) => (
                    <span key={g} style={{
                      padding: '2px 8px',
                      borderRadius: RADIUS.pill,
                      background: PALETTE.neutralSoft || '#eef2f7',
                      fontSize: 12,
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace'
                    }}>{g}</span>
                  ))}
                </div>
              ) : <Text UNSAFE_style={{ color: PALETTE.textMuted }}>none returned</Text>}
            </div>
          </div>
        )}
      </View>

      {/* Per-required-role field listing */}
      <Heading level={3} marginTop="size-300">Fields by required role</Heading>
      {schemaLoading ? (
        <Flex justifyContent="center" margin="size-400"><ProgressCircle aria-label="Loading schema" isIndeterminate /></Flex>
      ) : (
        ['admin', 'editor', 'viewer', 'anyone'].map((req) => {
          const list = buckets[req] || []
          const canEdit = req === 'anyone' ? true : userCanEdit(req)
          return (
            <View
              key={req}
              marginTop="size-150"
              UNSAFE_style={{ background: PALETTE.surface, border: `1px solid ${PALETTE.border}`, borderRadius: RADIUS.lg, boxShadow: SHADOW.xs, overflow: 'hidden' }}
            >
              <div style={{
                padding: '10px 16px',
                background: PALETTE.surfaceMuted,
                borderBottom: `1px solid ${PALETTE.border}`,
                display: 'flex', alignItems: 'center', gap: 10
              }}>
                {req === 'anyone'
                  ? <span style={{ padding: '2px 10px', borderRadius: RADIUS.pill, background: PALETTE.neutralSoft || '#eef2f7', fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>anyone</span>
                  : rolePill(req)
                }
                <span style={{ fontWeight: 600 }}>{list.length} field{list.length === 1 ? '' : 's'}</span>
                <span style={{ marginLeft: 'auto', fontSize: 12, color: canEdit ? PALETTE.success : PALETTE.danger, fontWeight: 600 }}>
                  {canEdit ? '✓ you can edit these' : '✕ blocked — your role is below this threshold'}
                </span>
              </div>
              {list.length === 0 ? (
                <View padding="size-200"><Text UNSAFE_style={{ color: PALETTE.textMuted }}>None.</Text></View>
              ) : list.map((f) => (
                <div
                  key={f.path}
                  style={{
                    padding: '10px 16px',
                    borderBottom: `1px solid ${PALETTE.border}`,
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr auto',
                    gap: 12,
                    fontSize: 13
                  }}
                >
                  <div>{f.section}</div>
                  <div>{f.group}</div>
                  <div style={{ fontWeight: 600 }}>{f.field}</div>
                  <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11, color: PALETTE.textMuted, wordBreak: 'break-all' }}>
                    {f.path}{f.sensitive ? ' · 🔒' : ''}
                  </div>
                </div>
              ))}
            </View>
          )
        })
      )}
    </View>
  )
}
