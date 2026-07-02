# @adobedjangir/commerce-admin-ims-access

Role-based access control (RBAC) add-on for
[`@adobedjangir/commerce-admin-management`](https://www.npmjs.com/package/@adobedjangir/commerce-admin-management).

Adds **email-based roles** (`admin` / `editor` / `viewer`), a UI to manage them,
a role badge in the nav, a **My Access** page, and **server-side enforcement**
of writes across the whole suite.

> Without this add-on, the core app is open (everyone is effectively admin).
> Installing it turns on RBAC.

---

## What it adds

| Piece | Where |
|---|---|
| **Access Management** page | System nav — add an email, assign a role, list/remove (admin-only) |
| **My Access** page | System nav — shows your resolved role + identity |
| **Role badge** | Top-right nav chip with a details popover |
| `ims-user-profile` action | Resolves the caller's identity + effective role |
| `access-list` / `access-save` / `access-delete` actions | CRUD for email→role assignments (admin-gated) |
| RBAC hook (`./hook`) | Core & other add-ons call it to enforce roles server-side |

## How a role is resolved

For the caller's IMS email (read from their forwarded token):

1. email ∈ **`SUPER_ADMIN_EMAILS`** (`.env`) → **`admin`**  _(bootstrap; can't be locked out)_
2. email ∈ **stored assignment** (ABDB, managed in Access Management) → that role
3. otherwise → **`viewer`** _(least privilege)_

## What each role can do (enforced server-side + UI)

| Action | viewer | editor | admin |
|---|:--:|:--:|:--:|
| View config / audit / snapshots | ✅ | ✅ | ✅ |
| Save config values | ❌ | ✅ | ✅ |
| Edit schema (Schema Designer) | ❌ | ❌ | ✅ |
| Revert an audit entry | ❌ | ❌ | ✅ |
| Create / restore snapshots | ❌ | ❌ | ✅ |
| Manage access (this add-on) | ❌ | ❌ | ✅ |

Enforcement is **fail-open** only when the role genuinely can't be resolved
(transient IMS/ABDB error) so a hiccup can't lock everyone out; when the role
resolves, it is strictly enforced.

---

## Install

```bash
npm install @adobedjangir/commerce-admin-ims-access
aio app deploy
```

`npm install` auto-registers the add-on (nav + pages + action keys) via the
core package's discovery mechanism — no manual setup step. **`aio app deploy`
is required after install** so the core actions rebuild and bundle this add-on's
RBAC hook (the enforcement is compiled into the actions at deploy time).

## Configure

Add the bootstrap super-admin(s) to your project `.env` (comma-separated):

```dotenv
SUPER_ADMIN_EMAILS=you@company.com,teammate@company.com
```

Everyone else defaults to `viewer` until an admin assigns them a role in the
**Access Management** page.

## Usage in host code (optional)

```jsx
import { useUserRole, hasRole, RoleBadge } from '@adobedjangir/commerce-admin-ims-access/web'

const { role } = useUserRole(props)      // 'admin' | 'editor' | 'viewer'
if (hasRole(role, 'editor')) { /* … */ } // rank-aware check
```

Server-side, other actions gate themselves through the hook:

```js
let rbac = null
try { rbac = require('@adobedjangir/commerce-admin-ims-access/hook') } catch (_) {}
// ...
if (rbac) {
  const err = await rbac.assertMinRole(params, 'admin') // null when allowed
  if (err) return { statusCode: 403, body: { error: err } }
}
```

## Notes

- Roles map to **emails**, not IMS groups — no `ROLE_MAP_*` configuration needed.
- The `access-*` actions verify the caller is an admin server-side, so a
  viewer/editor can't grant themselves a higher role by calling the API directly.
- Super-admins (`.env`) appear in Access Management as **locked** (read-only).

## License

Apache-2.0
