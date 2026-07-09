# Authentication Setup

LWP supports three authentication methods that can be enabled individually or combined:

| Method | Use case |
|---|---|
| `oidc` | Enterprise SSO — Azure AD, Okta, Google, Auth0, Authentik |
| `local` | Username + bcrypt password stored in the LWP database |
| `ldap` | Bind against an existing OpenLDAP or Active Directory server |

Set `AUTH_METHODS` in your `.env` to a comma-separated list of the methods you want active:

```env
# Show all three options on the login page
AUTH_METHODS=oidc,local,ldap

# OIDC only (default)
AUTH_METHODS=oidc

# Local accounts only (self-contained, no external IdP)
AUTH_METHODS=local

# LDAP only
AUTH_METHODS=ldap
```

The login page adapts automatically: a username/password form appears when `local` or `ldap` is enabled; an SSO button appears when `oidc` is enabled. Both can appear at the same time.

---

## Local authentication

No external service required. Admin creates users via the admin panel (Users → Create local user) or the API:

```http
POST /api/admin/users
{
  "username": "alice",
  "email": "alice@example.com",
  "display_name": "Alice",
  "password": "CorrectHorseBattery",
  "is_admin": false
}
```

Reset a password:

```http
POST /api/admin/users/{id}/set-password
{"password": "NewPassword123"}
```

Passwords are stored as bcrypt hashes (cost 12). The plain-text password is never stored or logged.

The first user created in an empty system automatically receives admin rights, regardless of auth method.

---

## LDAP / Active Directory

```env
AUTH_METHODS=ldap        # or oidc,ldap,local

LDAP_HOST=ldap.example.com
LDAP_PORT=389            # 636 for LDAPS
LDAP_BIND_DN=cn=lwp-service,dc=example,dc=com
LDAP_BIND_PASSWORD=service-password
LDAP_BASE_DN=dc=example,dc=com
LDAP_USER_FILTER=(uid={username})
LDAP_USER_ATTR_EMAIL=mail
LDAP_USER_ATTR_DISPLAY_NAME=cn
LDAP_TLS=none            # none | ldaps | starttls
LDAP_GROUPS_ATTR=memberOf
```

### OpenLDAP

```env
LDAP_USER_FILTER=(uid={username})
LDAP_USER_ATTR_EMAIL=mail
LDAP_USER_ATTR_DISPLAY_NAME=cn
LDAP_GROUPS_ATTR=memberOf
```

### Active Directory / Entra ID (on-prem)

```env
LDAP_HOST=dc01.corp.example.com
LDAP_PORT=636
LDAP_TLS=ldaps
LDAP_BIND_DN=CN=lwp-svc,OU=Service Accounts,DC=corp,DC=example,DC=com
LDAP_BIND_PASSWORD=service-password
LDAP_BASE_DN=DC=corp,DC=example,DC=com
LDAP_USER_FILTER=(sAMAccountName={username})
LDAP_USER_ATTR_EMAIL=userPrincipalName
LDAP_USER_ATTR_DISPLAY_NAME=displayName
LDAP_GROUPS_ATTR=memberOf
```

### How LDAP auth works

1. LWP binds to the directory with the service account (`LDAP_BIND_DN`).
2. Searches `LDAP_BASE_DN` using `LDAP_USER_FILTER` (replaces `{username}` with the login input).
3. Re-binds with the found DN and the user's password to verify credentials.
4. On success, reads `LDAP_USER_ATTR_EMAIL`, `LDAP_USER_ATTR_DISPLAY_NAME`, and `LDAP_GROUPS_ATTR`.
5. Upserts the user in the LWP database (`auth_source = "ldap"`). Passwords are **never** stored locally for LDAP users.
6. Group CNs from `memberOf` are synced to LWP groups (auto-created if missing).

LDAP users must re-authenticate to LDAP on every login — LWP only stores session JWTs, not LDAP credentials.

---

## OIDC (external SSO)

Works with any standards-compliant OIDC provider. The backend is a pure OIDC client (authlib); no local Keycloak or identity server is needed.

### Required env vars

```env
OIDC_ISSUER=https://...
OIDC_CLIENT_ID=your-client-id
OIDC_CLIENT_SECRET=your-client-secret
OIDC_SCOPES=openid email profile groups
OIDC_GROUPS_CLAIM=groups
```

Configure the callback URI at your provider:

```
http(s)://your-lwp-domain/api/auth/oidc/callback
```

### Google Workspace

1. Cloud Console → APIs & Services → Credentials → Create OAuth 2.0 Client ID
2. Application type: Web
3. Authorized redirect URI: `https://lwp.example.com/api/auth/oidc/callback`

```env
OIDC_ISSUER=https://accounts.google.com
OIDC_SCOPES=openid email profile
```

Groups are not available from Google's OIDC endpoint without Admin SDK. Leave `OIDC_GROUPS_CLAIM` blank.

### Azure AD / Entra ID

1. Azure Portal → App registrations → New registration
2. Add redirect URI: `https://lwp.example.com/api/auth/oidc/callback`
3. Certificates & secrets → New client secret
4. Token configuration → Add optional claim: `groups` (access token)

```env
OIDC_ISSUER=https://login.microsoftonline.com/{tenant-id}/v2.0
OIDC_SCOPES=openid email profile
OIDC_GROUPS_CLAIM=groups
```

### Okta

1. Applications → Create App Integration → OIDC → Web Application
2. Sign-in redirect: `https://lwp.example.com/api/auth/oidc/callback`
3. Assignments: assign groups
4. API → Authorization Servers → Claims → add `groups` claim to ID token

```env
OIDC_ISSUER=https://your-org.okta.com
OIDC_SCOPES=openid email profile groups
OIDC_GROUPS_CLAIM=groups
```

### Auth0

1. Applications → Create Application → Regular Web App
2. Allowed Callback URLs: `https://lwp.example.com/api/auth/oidc/callback`
3. Actions/Rules → Add custom claim `groups` to ID token

```env
OIDC_ISSUER=https://your-tenant.auth0.com/
OIDC_SCOPES=openid email profile
OIDC_GROUPS_CLAIM=https://lwp/groups   # adjust to your namespace
```

### Authentik

1. Applications → Create → Provider: OAuth2/OpenID
2. Redirect URI: `https://lwp.example.com/api/auth/oidc/callback`
3. Scopes: include `openid email profile`; add a custom scope for groups if needed

```env
OIDC_ISSUER=https://auth.example.com/application/o/{slug}/
OIDC_SCOPES=openid email profile
OIDC_GROUPS_CLAIM=groups
```

---

## Group sync

All three auth methods sync groups to LWP:

- **OIDC**: group names come from the `OIDC_GROUPS_CLAIM` claim (a JSON array of strings).
- **LDAP**: group CNs are extracted from `LDAP_GROUPS_ATTR` (`memberOf` values like `CN=IT,OU=Groups,...` → `IT`).
- **Local**: groups are managed manually in the admin panel (local users are not auto-synced).

Groups are created in LWP if they don't exist. Membership is updated on every login. Use LWP groups to control image access via Admin → Images → Permissions.

---

## Nextcloud auto-mount via OIDC

When users sign in with OIDC and Nextcloud trusts the **same** identity provider (via NC's `user_oidc` app), LWP can provision each user's Nextcloud mount automatically — **no admin credentials and no per-user first-run setup**.

**How it works (approach B):** on first OIDC login, LWP uses the user's OIDC **access token** as a Bearer against Nextcloud to:

1. resolve the real NC user id (`GET /ocs/v2.php/cloud/user`), and
2. mint a long-lived **app password** (`GET /ocs/v2.php/core/getapppassword`).

The app password is stored encrypted (`User.nc_password_enc`) and used for the rclone WebDAV mount from then on (basic auth — durable, survives token expiry). Subsequent logins skip provisioning if a password is already stored.

### Enable it

Admin → Settings → Nextcloud → **Auto-provision via OIDC**. Set the Nextcloud **URL**; admin username/password are **not** required for this mode.

### Requirements

- Nextcloud runs the **`user_oidc`** app, pointed at the same issuer as `OIDC_ISSUER`, and configured to **accept bearer tokens** for OCS/DAV requests.
- The OIDC access token's **audience** must be accepted by Nextcloud (shared client, or NC configured to trust LWP's client id).
- Username mapping must line up: LWP derives its username from `preferred_username`; NC's `user_oidc` should map the same claim so the resolved `cloud/user` id matches.

Provisioning is **best-effort** — if the bearer call is rejected, login still succeeds and the mount is simply skipped (falls back to admin-provisioning or per-user config). Check backend logs for `OIDC Nextcloud provisioning failed`.

---

## TOTP two-factor authentication

TOTP 2FA is available for **local** and **LDAP** users (not OIDC — those users rely on the IdP for MFA). It uses the TOTP standard (RFC 6238), compatible with Google Authenticator, Authy, 1Password, Bitwarden, and any other TOTP app.

### Enabling 2FA (user self-service)

1. Log in with username + password.
2. Go to **Profile** → **Security** → **Set up two-factor authentication**.
3. Scan the QR code with your authenticator app.
4. Enter the 6-digit code to confirm — this activates 2FA.

From this point on, login requires password + TOTP code.

### Login flow with TOTP

```
POST /api/auth/login {username, password}
  → {requires_totp: true, totp_token: "<short-lived JWT>"}

POST /api/auth/2fa/verify {totp_token: "…", code: "123456"}
  → sets HttpOnly JWT cookies — user is logged in
```

The `totp_token` is a short-lived (2-minute) JWT used only to carry the pending-auth state between the two calls. It does not grant any access.

### Disabling 2FA

Profile → Security → Remove two-factor authentication (requires current valid TOTP code).

Or as admin: Admin → Users → Edit → Security → Disable 2FA (no code required).

### Implementation details

| Detail | Value |
|---|---|
| Algorithm | TOTP (RFC 6238), HMAC-SHA1, 6 digits, 30 s window |
| Secret storage | Fernet-encrypted in `users.totp_secret_enc` column |
| Setup flow | Secret stored in `users.totp_pending_enc` until confirmed |
| Clock tolerance | ±1 window (accepts codes 30 s early or late) |

TOTP secrets are Fernet-encrypted with a key derived from `SECRET_KEY`. If `SECRET_KEY` changes, existing TOTP secrets become unreadable — users will need to set up 2FA again.

---

## First-user bootstrap

The very first user to log in (regardless of auth method) is automatically granted `is_admin = true`. Use this account to configure the system. Subsequent users are regular users by default.
