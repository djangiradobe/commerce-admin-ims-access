/*
Copyright 2025 Adobe. All rights reserved.
Licensed under the Apache License, Version 2.0
*/

// Access Management — admin-only UI to assign roles (admin/editor/viewer) to
// user emails. Backed by the access-list / access-save / access-delete
// actions. Super-admins (from .env SUPER_ADMIN_EMAILS) are shown read-only.

import React, { useCallback, useEffect, useState } from 'react'
import {
  View, Flex, Heading, Text, TextField, Picker, Item, Button,
  ProgressCircle, StatusLight, Well
} from '@adobe/react-spectrum'
import { callAction, getActionKey } from '@adobedjangir/commerce-admin-management/web'
import { PALETTE, RADIUS, SHADOW } from '@adobedjangir/commerce-admin-management/web'
import { useUserRole } from './useUserRole'

const ROLE_OPTIONS = [
  { id: 'admin', label: 'Admin' },
  { id: 'editor', label: 'Editor' },
  { id: 'viewer', label: 'Viewer' }
]

function roleTone (role) {
  if (role === 'admin') return PALETTE.danger
  if (role === 'editor') return PALETTE.accent
  return PALETTE.neutralText || PALETTE.textMuted
}

function Pill ({ role }) {
  return (
    <span style={{
      padding: '2px 10px', borderRadius: RADIUS.pill, fontSize: 11, fontWeight: 700,
      letterSpacing: 0.4, textTransform: 'uppercase',
      color: roleTone(role), background: PALETTE.neutralSoft || '#eef2f7'
    }}>{role}</span>
  )
}

export default function AccessManagement (props) {
  const { role: myRole, loading: roleLoading } = useUserRole(props)
  const [items, setItems] = useState([])
  const [superAdmins, setSuperAdmins] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [status, setStatus] = useState({ tone: 'neutral', message: '' })

  const [email, setEmail] = useState('')
  const [role, setRole] = useState('viewer')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await callAction(props, getActionKey('accessList'), '', {})
      const body = res?.body || res
      if (body && body.ok) {
        setItems(Array.isArray(body.items) ? body.items : [])
        setSuperAdmins(Array.isArray(body.superAdmins) ? body.superAdmins : [])
      } else {
        setError((body && body.error) || 'Failed to load access list')
      }
    } catch (e) {
      setError(e.message || 'Failed to load access list')
    } finally {
      setLoading(false)
    }
  }, [props])

  useEffect(() => {
    // Only admins can read the list; wait for role to resolve.
    if (!roleLoading && myRole === 'admin') load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleLoading, myRole])

  const addOrUpdate = async () => {
    const e = String(email).trim().toLowerCase()
    if (!e || !e.includes('@')) { setStatus({ tone: 'negative', message: 'Enter a valid email.' }); return }
    setSaving(true); setStatus({ tone: 'notice', message: 'Saving…' })
    try {
      const res = await callAction(props, getActionKey('accessSave'), '', { email: e, role })
      const body = res?.body || res
      if (body && body.ok) {
        setStatus({ tone: 'positive', message: `${e} → ${role}` })
        setEmail('')
        await load()
      } else {
        setStatus({ tone: 'negative', message: (body && body.error) || 'Save failed' })
      }
    } catch (err) {
      setStatus({ tone: 'negative', message: err.message || 'Save failed' })
    } finally {
      setSaving(false)
    }
  }

  const remove = async (targetEmail) => {
    setStatus({ tone: 'notice', message: `Removing ${targetEmail}…` })
    try {
      const res = await callAction(props, getActionKey('accessDelete'), '', { email: targetEmail })
      const body = res?.body || res
      if (body && body.ok) {
        setStatus({ tone: 'positive', message: `Removed ${targetEmail} (now defaults to viewer)` })
        await load()
      } else {
        setStatus({ tone: 'negative', message: (body && body.error) || 'Remove failed' })
      }
    } catch (err) {
      setStatus({ tone: 'negative', message: err.message || 'Remove failed' })
    }
  }

  const card = { background: PALETTE.surface, border: `1px solid ${PALETTE.border}`, borderRadius: RADIUS.lg, boxShadow: SHADOW.xs }

  if (roleLoading) {
    return (
      <View padding="size-400" UNSAFE_style={{ background: PALETTE.bg, minHeight: '100vh' }}>
        <Flex alignItems="center" gap="size-100"><ProgressCircle size="S" isIndeterminate aria-label="Loading" /><Text>Resolving your role…</Text></Flex>
      </View>
    )
  }

  if (myRole !== 'admin') {
    return (
      <View padding="size-400" UNSAFE_style={{ background: PALETTE.bg, minHeight: '100vh' }}>
        <Heading level={2} marginTop={0}>Access Management</Heading>
        <Well UNSAFE_style={{ borderColor: PALETTE.warningBorder || PALETTE.border }}>
          <Text>Only administrators can manage access. Your role is <strong>{myRole}</strong>.</Text>
        </Well>
      </View>
    )
  }

  return (
    <View padding="size-400" UNSAFE_style={{ background: PALETTE.bg, minHeight: '100vh' }}>
      <Heading level={2} marginTop={0}>Access Management</Heading>
      <Text UNSAFE_style={{ color: PALETTE.textMuted }}>
        Assign roles to user emails. Precedence: super-admins (from <code>.env</code>) →
        assignments below → everyone else defaults to <strong>viewer</strong>.
      </Text>

      {status.message && (
        <View marginTop="size-150"><StatusLight variant={status.tone}>{status.message}</StatusLight></View>
      )}

      {/* Add / update */}
      <View marginTop="size-200" padding="size-300" UNSAFE_style={card}>
        <Flex gap="size-200" alignItems="end" wrap>
          <TextField label="User email" value={email} onChange={setEmail} width="size-3600" placeholder="user@company.com" onSubmit={addOrUpdate} />
          <Picker label="Role" selectedKey={role} onSelectionChange={(k) => setRole(String(k))} width="size-1700">
            {ROLE_OPTIONS.map((r) => <Item key={r.id}>{r.label}</Item>)}
          </Picker>
          <Button variant="cta" onPress={addOrUpdate} isDisabled={saving}>{saving ? 'Saving…' : 'Add / Update'}</Button>
        </Flex>
      </View>

      {error && (
        <Well marginTop="size-200" UNSAFE_style={{ borderColor: PALETTE.danger }}>
          <Text UNSAFE_style={{ color: PALETTE.danger }}>{error}</Text>
        </Well>
      )}

      {/* Assignments table */}
      <View marginTop="size-200" UNSAFE_style={{ ...card, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 120px', padding: '12px 16px', gap: 12, background: PALETTE.surfaceMuted, fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: PALETTE.textMuted, borderBottom: `1px solid ${PALETTE.border}` }}>
          <div>Email</div><div>Role</div><div>Action</div>
        </div>

        {/* Super-admins (read-only, from .env) */}
        {superAdmins.map((sa) => (
          <div key={'sa-' + sa} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 120px', padding: '12px 16px', gap: 12, borderBottom: `1px solid ${PALETTE.border}`, fontSize: 13, alignItems: 'center', background: PALETTE.surfaceSubtle || 'transparent' }}>
            <div>{sa} <span style={{ color: PALETTE.textMuted, fontSize: 11 }}>(super-admin · .env)</span></div>
            <div><Pill role="admin" /></div>
            <div><Text UNSAFE_style={{ color: PALETTE.textMuted, fontSize: 12 }}>locked</Text></div>
          </div>
        ))}

        {loading ? (
          <Flex justifyContent="center" margin="size-400"><ProgressCircle aria-label="Loading" isIndeterminate /></Flex>
        ) : items.length === 0 ? (
          <View padding="size-400"><Text UNSAFE_style={{ color: PALETTE.textMuted }}>No email assignments yet. Add one above.</Text></View>
        ) : items.map((it) => (
          <div key={it.email} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 120px', padding: '12px 16px', gap: 12, borderBottom: `1px solid ${PALETTE.border}`, fontSize: 13, alignItems: 'center' }}>
            <div>{it.email}</div>
            <div><Pill role={it.role} /></div>
            <div><Button variant="secondary" isQuiet onPress={() => remove(it.email)}>Remove</Button></div>
          </div>
        ))}
      </View>
    </View>
  )
}
