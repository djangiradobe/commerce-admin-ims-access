// web/src/index.js
import { configureWeb } from "@adobedjangir/commerce-admin-management/web";

// web/src/MyAccess.js
import React, { useMemo } from "react";
import { View, Heading, Text, ProgressCircle, Flex } from "@adobe/react-spectrum";

// web/src/useUserRole.js
import { useEffect, useRef, useState } from "react";
import { callAction } from "@adobedjangir/commerce-admin-management/web";
import { getActionKey } from "@adobedjangir/commerce-admin-management/web";
var CACHED = null;
function useUserRole(props) {
  const [state, setState] = useState(() => CACHED || { loading: true, role: "admin", groups: [], profile: null });
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    if (CACHED) {
      setState(CACHED);
      return () => {
        mounted.current = false;
      };
    }
    ;
    (async () => {
      try {
        const res = await callAction(props, getActionKey("imsUserProfile"), "", {});
        const body = (res == null ? void 0 : res.body) || res;
        if (body && body.ok && body.role) {
          CACHED = { loading: false, role: body.role, groups: body.groups || [], profile: body.profile || null };
          if (mounted.current) setState(CACHED);
          return;
        }
      } catch (_) {
      }
      if (mounted.current) setState({ loading: false, role: "admin", groups: [], profile: null });
    })();
    return () => {
      mounted.current = false;
    };
  }, []);
  return state;
}
var ROLE_RANK = { viewer: 0, editor: 1, admin: 2 };
function hasRole(userRole, required) {
  var _a, _b;
  if (!required) return true;
  return ((_a = ROLE_RANK[userRole]) != null ? _a : -1) >= ((_b = ROLE_RANK[required]) != null ? _b : 99);
}

// web/src/MyAccess.js
import { useSystemConfigSchema } from "@adobedjangir/commerce-admin-management/web";
import { PALETTE, RADIUS, SHADOW } from "@adobedjangir/commerce-admin-management/web";
import { jsx, jsxs } from "react/jsx-runtime";
function rolePill(role) {
  const tone2 = role === "admin" ? PALETTE.danger : role === "editor" ? PALETTE.accent : role === "viewer" ? PALETTE.neutralText : PALETTE.textMuted;
  const bg2 = role === "admin" ? PALETTE.dangerSoft || "#fee2e2" : role === "editor" ? PALETTE.accentSoft || "#e8f1fc" : PALETTE.neutralSoft || "#eef2f7";
  return /* @__PURE__ */ jsx("span", { style: {
    padding: "2px 10px",
    borderRadius: RADIUS.pill,
    background: bg2,
    color: tone2,
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: "uppercase"
  }, children: role || "\u2014" });
}
function MyAccess(props) {
  const { loading, role, groups, profile } = useUserRole(props);
  const { schema, loading: schemaLoading } = useSystemConfigSchema(props);
  const buckets = useMemo(() => {
    const out = { admin: [], editor: [], viewer: [], anyone: [] };
    if (!schema || !Array.isArray(schema.sections)) return out;
    for (const s of schema.sections) {
      for (const g of s.groups || []) {
        for (const f of g.fields || []) {
          const required = f.requiredRole;
          const key = required ? required : "anyone";
          if (!out[key]) continue;
          out[key].push({
            section: s.label || s.id,
            group: g.label || g.id,
            field: f.label || f.id,
            path: `${s.id}/${g.id}/${f.id}`,
            sensitive: !!f.sensitive
          });
        }
      }
    }
    return out;
  }, [schema]);
  const userCanEdit = (required) => hasRole(role, required);
  return /* @__PURE__ */ jsxs(View, { padding: "size-400", UNSAFE_style: { background: PALETTE.bg, minHeight: "100vh" }, children: [
    /* @__PURE__ */ jsx(Heading, { level: 2, marginTop: 0, children: "My access" }),
    /* @__PURE__ */ jsx(
      View,
      {
        marginTop: "size-200",
        padding: "size-300",
        UNSAFE_style: { background: PALETTE.surface, border: `1px solid ${PALETTE.border}`, borderRadius: RADIUS.lg, boxShadow: SHADOW.xs },
        children: loading ? /* @__PURE__ */ jsxs(Flex, { alignItems: "center", gap: "size-100", children: [
          /* @__PURE__ */ jsx(ProgressCircle, { size: "S", isIndeterminate: true, "aria-label": "Loading" }),
          /* @__PURE__ */ jsx(Text, { children: "Resolving role\u2026" })
        ] }) : /* @__PURE__ */ jsxs("div", { style: { display: "grid", gridTemplateColumns: "160px 1fr", rowGap: 12, fontSize: 14 }, children: [
          /* @__PURE__ */ jsx("div", { style: { color: PALETTE.textMuted, fontWeight: 600 }, children: "Role" }),
          /* @__PURE__ */ jsx("div", { children: rolePill(role) }),
          /* @__PURE__ */ jsx("div", { style: { color: PALETTE.textMuted, fontWeight: 600 }, children: "Email" }),
          /* @__PURE__ */ jsx("div", { style: { wordBreak: "break-all" }, children: (profile == null ? void 0 : profile.email) || "\u2014" }),
          /* @__PURE__ */ jsx("div", { style: { color: PALETTE.textMuted, fontWeight: 600 }, children: "User ID" }),
          /* @__PURE__ */ jsx("div", { style: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 }, children: (profile == null ? void 0 : profile.userId) || "\u2014" }),
          /* @__PURE__ */ jsx("div", { style: { color: PALETTE.textMuted, fontWeight: 600 }, children: "Display name" }),
          /* @__PURE__ */ jsx("div", { children: (profile == null ? void 0 : profile.displayName) || "\u2014" }),
          /* @__PURE__ */ jsx("div", { style: { color: PALETTE.textMuted, fontWeight: 600 }, children: "IMS groups" }),
          /* @__PURE__ */ jsx("div", { children: groups && groups.length > 0 ? /* @__PURE__ */ jsx("div", { style: { display: "flex", flexWrap: "wrap", gap: 4 }, children: groups.map((g) => /* @__PURE__ */ jsx("span", { style: {
            padding: "2px 8px",
            borderRadius: RADIUS.pill,
            background: PALETTE.neutralSoft || "#eef2f7",
            fontSize: 12,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
          }, children: g }, g)) }) : /* @__PURE__ */ jsx(Text, { UNSAFE_style: { color: PALETTE.textMuted }, children: "none returned" }) })
        ] })
      }
    ),
    /* @__PURE__ */ jsx(Heading, { level: 3, marginTop: "size-300", children: "Fields by required role" }),
    schemaLoading ? /* @__PURE__ */ jsx(Flex, { justifyContent: "center", margin: "size-400", children: /* @__PURE__ */ jsx(ProgressCircle, { "aria-label": "Loading schema", isIndeterminate: true }) }) : ["admin", "editor", "viewer", "anyone"].map((req) => {
      const list = buckets[req] || [];
      const canEdit = req === "anyone" ? true : userCanEdit(req);
      return /* @__PURE__ */ jsxs(
        View,
        {
          marginTop: "size-150",
          UNSAFE_style: { background: PALETTE.surface, border: `1px solid ${PALETTE.border}`, borderRadius: RADIUS.lg, boxShadow: SHADOW.xs, overflow: "hidden" },
          children: [
            /* @__PURE__ */ jsxs("div", { style: {
              padding: "10px 16px",
              background: PALETTE.surfaceMuted,
              borderBottom: `1px solid ${PALETTE.border}`,
              display: "flex",
              alignItems: "center",
              gap: 10
            }, children: [
              req === "anyone" ? /* @__PURE__ */ jsx("span", { style: { padding: "2px 10px", borderRadius: RADIUS.pill, background: PALETTE.neutralSoft || "#eef2f7", fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" }, children: "anyone" }) : rolePill(req),
              /* @__PURE__ */ jsxs("span", { style: { fontWeight: 600 }, children: [
                list.length,
                " field",
                list.length === 1 ? "" : "s"
              ] }),
              /* @__PURE__ */ jsx("span", { style: { marginLeft: "auto", fontSize: 12, color: canEdit ? PALETTE.success : PALETTE.danger, fontWeight: 600 }, children: canEdit ? "\u2713 you can edit these" : "\u2715 blocked \u2014 your role is below this threshold" })
            ] }),
            list.length === 0 ? /* @__PURE__ */ jsx(View, { padding: "size-200", children: /* @__PURE__ */ jsx(Text, { UNSAFE_style: { color: PALETTE.textMuted }, children: "None." }) }) : list.map((f) => /* @__PURE__ */ jsxs(
              "div",
              {
                style: {
                  padding: "10px 16px",
                  borderBottom: `1px solid ${PALETTE.border}`,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr auto",
                  gap: 12,
                  fontSize: 13
                },
                children: [
                  /* @__PURE__ */ jsx("div", { children: f.section }),
                  /* @__PURE__ */ jsx("div", { children: f.group }),
                  /* @__PURE__ */ jsx("div", { style: { fontWeight: 600 }, children: f.field }),
                  /* @__PURE__ */ jsxs("div", { style: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 11, color: PALETTE.textMuted, wordBreak: "break-all" }, children: [
                    f.path,
                    f.sensitive ? " \xB7 \u{1F512}" : ""
                  ] })
                ]
              },
              f.path
            ))
          ]
        },
        req
      );
    })
  ] });
}

// web/src/AccessManagement.js
import React2, { useCallback, useEffect as useEffect2, useState as useState2 } from "react";
import {
  View as View2,
  Flex as Flex2,
  Heading as Heading2,
  Text as Text2,
  TextField,
  Picker,
  Item,
  Button,
  ProgressCircle as ProgressCircle2,
  StatusLight,
  Well
} from "@adobe/react-spectrum";
import { callAction as callAction2, getActionKey as getActionKey2 } from "@adobedjangir/commerce-admin-management/web";
import { PALETTE as PALETTE2, RADIUS as RADIUS2, SHADOW as SHADOW2 } from "@adobedjangir/commerce-admin-management/web";
import { jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
var ROLE_OPTIONS = [
  { id: "admin", label: "Admin" },
  { id: "editor", label: "Editor" },
  { id: "viewer", label: "Viewer" }
];
function roleTone(role) {
  if (role === "admin") return PALETTE2.danger;
  if (role === "editor") return PALETTE2.accent;
  return PALETTE2.neutralText || PALETTE2.textMuted;
}
function Pill({ role }) {
  return /* @__PURE__ */ jsx2("span", { style: {
    padding: "2px 10px",
    borderRadius: RADIUS2.pill,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: roleTone(role),
    background: PALETTE2.neutralSoft || "#eef2f7"
  }, children: role });
}
function AccessManagement(props) {
  const { role: myRole, loading: roleLoading } = useUserRole(props);
  const [items, setItems] = useState2([]);
  const [superAdmins, setSuperAdmins] = useState2([]);
  const [loading, setLoading] = useState2(false);
  const [error, setError] = useState2(null);
  const [status, setStatus] = useState2({ tone: "neutral", message: "" });
  const [email, setEmail] = useState2("");
  const [role, setRole] = useState2("viewer");
  const [saving, setSaving] = useState2(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await callAction2(props, getActionKey2("accessList"), "", {});
      const body = (res == null ? void 0 : res.body) || res;
      if (body && body.ok) {
        setItems(Array.isArray(body.items) ? body.items : []);
        setSuperAdmins(Array.isArray(body.superAdmins) ? body.superAdmins : []);
      } else {
        setError(body && body.error || "Failed to load access list");
      }
    } catch (e) {
      setError(e.message || "Failed to load access list");
    } finally {
      setLoading(false);
    }
  }, [props]);
  useEffect2(() => {
    if (!roleLoading && myRole === "admin") load();
  }, [roleLoading, myRole]);
  const addOrUpdate = async () => {
    const e = String(email).trim().toLowerCase();
    if (!e || !e.includes("@")) {
      setStatus({ tone: "negative", message: "Enter a valid email." });
      return;
    }
    setSaving(true);
    setStatus({ tone: "notice", message: "Saving\u2026" });
    try {
      const res = await callAction2(props, getActionKey2("accessSave"), "", { email: e, role });
      const body = (res == null ? void 0 : res.body) || res;
      if (body && body.ok) {
        setStatus({ tone: "positive", message: `${e} \u2192 ${role}` });
        setEmail("");
        await load();
      } else {
        setStatus({ tone: "negative", message: body && body.error || "Save failed" });
      }
    } catch (err) {
      setStatus({ tone: "negative", message: err.message || "Save failed" });
    } finally {
      setSaving(false);
    }
  };
  const remove = async (targetEmail) => {
    setStatus({ tone: "notice", message: `Removing ${targetEmail}\u2026` });
    try {
      const res = await callAction2(props, getActionKey2("accessDelete"), "", { email: targetEmail });
      const body = (res == null ? void 0 : res.body) || res;
      if (body && body.ok) {
        setStatus({ tone: "positive", message: `Removed ${targetEmail} (now defaults to viewer)` });
        await load();
      } else {
        setStatus({ tone: "negative", message: body && body.error || "Remove failed" });
      }
    } catch (err) {
      setStatus({ tone: "negative", message: err.message || "Remove failed" });
    }
  };
  const card = { background: PALETTE2.surface, border: `1px solid ${PALETTE2.border}`, borderRadius: RADIUS2.lg, boxShadow: SHADOW2.xs };
  if (roleLoading) {
    return /* @__PURE__ */ jsx2(View2, { padding: "size-400", UNSAFE_style: { background: PALETTE2.bg, minHeight: "100vh" }, children: /* @__PURE__ */ jsxs2(Flex2, { alignItems: "center", gap: "size-100", children: [
      /* @__PURE__ */ jsx2(ProgressCircle2, { size: "S", isIndeterminate: true, "aria-label": "Loading" }),
      /* @__PURE__ */ jsx2(Text2, { children: "Resolving your role\u2026" })
    ] }) });
  }
  if (myRole !== "admin") {
    return /* @__PURE__ */ jsxs2(View2, { padding: "size-400", UNSAFE_style: { background: PALETTE2.bg, minHeight: "100vh" }, children: [
      /* @__PURE__ */ jsx2(Heading2, { level: 2, marginTop: 0, children: "Access Management" }),
      /* @__PURE__ */ jsx2(Well, { UNSAFE_style: { borderColor: PALETTE2.warningBorder || PALETTE2.border }, children: /* @__PURE__ */ jsxs2(Text2, { children: [
        "Only administrators can manage access. Your role is ",
        /* @__PURE__ */ jsx2("strong", { children: myRole }),
        "."
      ] }) })
    ] });
  }
  return /* @__PURE__ */ jsxs2(View2, { padding: "size-400", UNSAFE_style: { background: PALETTE2.bg, minHeight: "100vh" }, children: [
    /* @__PURE__ */ jsx2(Heading2, { level: 2, marginTop: 0, children: "Access Management" }),
    /* @__PURE__ */ jsxs2(Text2, { UNSAFE_style: { color: PALETTE2.textMuted }, children: [
      "Assign roles to user emails. Precedence: super-admins (from ",
      /* @__PURE__ */ jsx2("code", { children: ".env" }),
      ") \u2192 assignments below \u2192 everyone else defaults to ",
      /* @__PURE__ */ jsx2("strong", { children: "viewer" }),
      "."
    ] }),
    status.message && /* @__PURE__ */ jsx2(View2, { marginTop: "size-150", children: /* @__PURE__ */ jsx2(StatusLight, { variant: status.tone, children: status.message }) }),
    /* @__PURE__ */ jsx2(View2, { marginTop: "size-200", padding: "size-300", UNSAFE_style: card, children: /* @__PURE__ */ jsxs2(Flex2, { gap: "size-200", alignItems: "end", wrap: true, children: [
      /* @__PURE__ */ jsx2(TextField, { label: "User email", value: email, onChange: setEmail, width: "size-3600", placeholder: "user@company.com", onSubmit: addOrUpdate }),
      /* @__PURE__ */ jsx2(Picker, { label: "Role", selectedKey: role, onSelectionChange: (k) => setRole(String(k)), width: "size-1700", children: ROLE_OPTIONS.map((r) => /* @__PURE__ */ jsx2(Item, { children: r.label }, r.id)) }),
      /* @__PURE__ */ jsx2(Button, { variant: "cta", onPress: addOrUpdate, isDisabled: saving, children: saving ? "Saving\u2026" : "Add / Update" })
    ] }) }),
    error && /* @__PURE__ */ jsx2(Well, { marginTop: "size-200", UNSAFE_style: { borderColor: PALETTE2.danger }, children: /* @__PURE__ */ jsx2(Text2, { UNSAFE_style: { color: PALETTE2.danger }, children: error }) }),
    /* @__PURE__ */ jsxs2(View2, { marginTop: "size-200", UNSAFE_style: { ...card, overflow: "hidden" }, children: [
      /* @__PURE__ */ jsxs2("div", { style: { display: "grid", gridTemplateColumns: "1fr 140px 120px", padding: "12px 16px", gap: 12, background: PALETTE2.surfaceMuted, fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: PALETTE2.textMuted, borderBottom: `1px solid ${PALETTE2.border}` }, children: [
        /* @__PURE__ */ jsx2("div", { children: "Email" }),
        /* @__PURE__ */ jsx2("div", { children: "Role" }),
        /* @__PURE__ */ jsx2("div", { children: "Action" })
      ] }),
      superAdmins.map((sa) => /* @__PURE__ */ jsxs2("div", { style: { display: "grid", gridTemplateColumns: "1fr 140px 120px", padding: "12px 16px", gap: 12, borderBottom: `1px solid ${PALETTE2.border}`, fontSize: 13, alignItems: "center", background: PALETTE2.surfaceSubtle || "transparent" }, children: [
        /* @__PURE__ */ jsxs2("div", { children: [
          sa,
          " ",
          /* @__PURE__ */ jsx2("span", { style: { color: PALETTE2.textMuted, fontSize: 11 }, children: "(super-admin \xB7 .env)" })
        ] }),
        /* @__PURE__ */ jsx2("div", { children: /* @__PURE__ */ jsx2(Pill, { role: "admin" }) }),
        /* @__PURE__ */ jsx2("div", { children: /* @__PURE__ */ jsx2(Text2, { UNSAFE_style: { color: PALETTE2.textMuted, fontSize: 12 }, children: "locked" }) })
      ] }, "sa-" + sa)),
      loading ? /* @__PURE__ */ jsx2(Flex2, { justifyContent: "center", margin: "size-400", children: /* @__PURE__ */ jsx2(ProgressCircle2, { "aria-label": "Loading", isIndeterminate: true }) }) : items.length === 0 ? /* @__PURE__ */ jsx2(View2, { padding: "size-400", children: /* @__PURE__ */ jsx2(Text2, { UNSAFE_style: { color: PALETTE2.textMuted }, children: "No email assignments yet. Add one above." }) }) : items.map((it) => /* @__PURE__ */ jsxs2("div", { style: { display: "grid", gridTemplateColumns: "1fr 140px 120px", padding: "12px 16px", gap: 12, borderBottom: `1px solid ${PALETTE2.border}`, fontSize: 13, alignItems: "center" }, children: [
        /* @__PURE__ */ jsx2("div", { children: it.email }),
        /* @__PURE__ */ jsx2("div", { children: /* @__PURE__ */ jsx2(Pill, { role: it.role }) }),
        /* @__PURE__ */ jsx2("div", { children: /* @__PURE__ */ jsx2(Button, { variant: "secondary", isQuiet: true, onPress: () => remove(it.email), children: "Remove" }) })
      ] }, it.email))
    ] })
  ] });
}

// web/src/RoleBadge.js
import React3 from "react";
import {
  DialogTrigger,
  ActionButton,
  Dialog,
  Heading as Heading3,
  Content,
  Divider,
  Text as Text3,
  View as View3
} from "@adobe/react-spectrum";
import { PALETTE as PALETTE3, RADIUS as RADIUS3 } from "@adobedjangir/commerce-admin-management/web";
import { jsx as jsx3, jsxs as jsxs3 } from "react/jsx-runtime";
function tone(role) {
  if (role === "admin") return PALETTE3.danger;
  if (role === "editor") return PALETTE3.accent;
  return PALETTE3.neutralText;
}
function bg(role) {
  if (role === "admin") return PALETTE3.dangerSoft || "#fee2e2";
  if (role === "editor") return PALETTE3.accentSoft || "#e8f1fc";
  return PALETTE3.neutralSoft || "#eef2f7";
}
function RoleBadge({ runtime, ims }) {
  const { loading, role, groups, profile } = useUserRole({ runtime, ims });
  return /* @__PURE__ */ jsxs3(DialogTrigger, { type: "popover", children: [
    /* @__PURE__ */ jsx3(
      ActionButton,
      {
        isQuiet: true,
        UNSAFE_style: {
          padding: "4px 12px",
          borderRadius: RADIUS3.pill,
          background: bg(role),
          color: tone(role),
          fontWeight: 700,
          fontSize: 11,
          letterSpacing: 0.4,
          textTransform: "uppercase",
          border: 0
        },
        children: loading ? "\u2026" : role
      }
    ),
    /* @__PURE__ */ jsxs3(Dialog, { children: [
      /* @__PURE__ */ jsx3(Heading3, { children: "My access" }),
      /* @__PURE__ */ jsx3(Divider, { size: "S" }),
      /* @__PURE__ */ jsx3(Content, { children: /* @__PURE__ */ jsxs3("div", { style: { display: "grid", gridTemplateColumns: "110px 1fr", rowGap: 8, fontSize: 13 }, children: [
        /* @__PURE__ */ jsx3("div", { style: { color: PALETTE3.textMuted, fontWeight: 600 }, children: "Role" }),
        /* @__PURE__ */ jsx3("div", { children: /* @__PURE__ */ jsx3("span", { style: {
          padding: "2px 8px",
          borderRadius: RADIUS3.pill,
          background: bg(role),
          color: tone(role),
          fontWeight: 700,
          fontSize: 11,
          textTransform: "uppercase"
        }, children: role }) }),
        /* @__PURE__ */ jsx3("div", { style: { color: PALETTE3.textMuted, fontWeight: 600 }, children: "Email" }),
        /* @__PURE__ */ jsx3("div", { style: { wordBreak: "break-all" }, children: (profile == null ? void 0 : profile.email) || "\u2014" }),
        /* @__PURE__ */ jsx3("div", { style: { color: PALETTE3.textMuted, fontWeight: 600 }, children: "User ID" }),
        /* @__PURE__ */ jsx3("div", { style: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 }, children: (profile == null ? void 0 : profile.userId) || "\u2014" }),
        /* @__PURE__ */ jsx3("div", { style: { color: PALETTE3.textMuted, fontWeight: 600 }, children: "Display name" }),
        /* @__PURE__ */ jsx3("div", { children: (profile == null ? void 0 : profile.displayName) || "\u2014" }),
        /* @__PURE__ */ jsx3("div", { style: { color: PALETTE3.textMuted, fontWeight: 600 }, children: "IMS groups" }),
        /* @__PURE__ */ jsx3("div", { children: groups && groups.length > 0 ? /* @__PURE__ */ jsx3("div", { style: { display: "flex", flexWrap: "wrap", gap: 4 }, children: groups.map((g) => /* @__PURE__ */ jsx3("span", { style: {
          padding: "2px 8px",
          borderRadius: RADIUS3.pill,
          background: PALETTE3.neutralSoft || "#eef2f7",
          fontSize: 11,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
        }, children: g }, g)) }) : /* @__PURE__ */ jsx3(Text3, { UNSAFE_style: { color: PALETTE3.textMuted }, children: "none returned" }) })
      ] }) })
    ] })
  ] });
}

// web/src/index.js
function registerImsAccess() {
  configureWeb({
    actionKeys: {
      imsUserProfile: "ImsAccess/ims-user-profile",
      accessList: "ImsAccess/access-list",
      accessSave: "ImsAccess/access-save",
      accessDelete: "ImsAccess/access-delete"
    },
    extraNav: [
      {
        id: "my-access",
        path: "/my-access",
        label: "My Access",
        icon: "User",
        parentId: "system"
      },
      {
        id: "access-management",
        path: "/access-management",
        label: "Access Management",
        icon: "UsersLock",
        parentId: "system"
      }
    ],
    extraPages: {
      "my-access": MyAccess,
      "access-management": AccessManagement
    },
    // Core's SystemConfig + MainPage read these from the registry. Without
    // the ims-access add-on they default to "everyone is admin" / no badge.
    userRoleProvider: useUserRole,
    roleBadge: RoleBadge
  });
}
export {
  AccessManagement,
  MyAccess,
  ROLE_RANK,
  RoleBadge,
  registerImsAccess as default,
  hasRole,
  useUserRole
};
