# 🔵 BLUE TEAM — Secure Defense Lab

> **Secure implementation** — All privilege escalation vulnerabilities from the Red Team lab are FIXED. Attacks are blocked and logged.

---

## Folder Structure

```
blue-team/
├── backend/                      # Secure Node.js API
│   ├── app.js                    # Express server (restricted CORS, generic errors)
│   ├── package.json
│   ├── database/
│   │   └── init.js               # SQLite DB init + seed data + defense_log table
│   ├── middleware/
│   │   ├── auth.js               # Secure JWT (HS256-only, DB-verified roles)
│   │   └── securityLogger.js     # Logs blocked attempts to DB + WebSocket
│   └── routes/
│       ├── auth.js               # Login, register (field whitelist, rate limiting)
│       ├── users.js              # User CRUD (ownership checks, field filtering)
│       ├── admin.js              # Admin routes (DB-verified roles, no secret endpoint)
│       └── defenseLog.js         # Defense log API
│
└── frontend/                     # React defense dashboard (blue theme)
    ├── package.json
    └── src/
        ├── App.jsx               # Routing
        ├── index.js
        ├── context/
        │   └── AuthContext.jsx   # Auth state (no forged token support)
        ├── utils/
        │   └── api.js            # Axios instance (port 5000)
        ├── components/
        │   ├── Layout.jsx        # Sidebar + main layout (blue theme)
        │   └── Layout.css        # Blue design system CSS
        └── pages/
            ├── LoginPage.jsx     # Login with demo users
            ├── LoginPage.css     # Blue login styles
            ├── Dashboard.jsx     # Defense command center
            ├── IDORDefensePage.jsx      # IDOR defense module
            ├── JWTDefensePage.jsx       # JWT defense module
            ├── MassAssignDefensePage.jsx # Mass assignment defense
            ├── AdminDefensePage.jsx     # Admin access defense
            └── DefenseLogPage.jsx       # Live defense feed (WebSocket)
```

---

## Vulnerabilities Fixed (vs Red Team)

| # | Vulnerability | Red Team (Broken) | Blue Team (Fixed) |
|---|--------------|-------------------|-------------------|
| 1 | IDOR Read | No ownership check | `req.user.id === targetId` enforced |
| 2 | IDOR Update | Any user can update any profile | Ownership check on update |
| 3 | IDOR Balance | Can view any user's balance | Own balance only |
| 4 | JWT Algorithm | Accepts 'none' algorithm | HS256 only |
| 5 | JWT Role | Role from token (forgeable) | Role fetched from DB every request |
| 6 | JWT Secret | "secret123" | Strong cryptographic secret |
| 7 | JWT Expiry | 7 days | 1 hour |
| 8 | JWT Forge | /forge-token endpoint exists | Endpoint removed |
| 9 | Mass Assignment (Register) | role, balance from request | Field whitelist — ignored |
| 10 | Mass Assignment (Update) | All fields updatable | Only email, profile_data allowed |
| 11 | Admin Auth | JWT role only | DB-verified role |
| 12 | Forced Browsing | /admin/secret exposed | Endpoint removed |
| 13 | CORS | `origin: "*"` | `origin: "http://localhost:3001"` |
| 14 | Error Messages | Stack traces + hints | Generic error messages |
| 15 | Login Errors | "User not found" vs "Wrong password" | Generic "Invalid credentials" |
| 16 | Rate Limiting | None | 5 requests/minute on login |
| 17 | Password Policy | No enforcement | Minimum 8 characters |
| 18 | PII Exposure | SSN, credit card in responses | Hidden from non-admin |
| 19 | Audit Trail | Attack log only | Defense + audit log |

---

## Setup & Run

### Backend

```bash
cd blue-team/backend
npm install
npm start       # Runs on http://localhost:5000
```

### Frontend

```bash
cd blue-team/frontend
npm install
npm start       # Runs on http://localhost:3001
```

---

## Demo Users (Same as Red Team)

| Username | Password | Role |
|----------|----------|------|
| alice | password123 | user |
| bob | password123 | user |
| charlie | password123 | moderator |
| admin | admin123 | admin |

---

## Defense Walkthrough

### IDOR Defense
1. Login as `alice` (ID: 1)
2. Go to **IDOR Defense** page
3. Try targeting user ID 2 (bob) → **403 Access Denied**
4. Try accessing your own ID 1 → **Success** (own data only)

### JWT Defense
1. Login as `alice` (regular user)
2. Go to **JWT Defense** → try forge endpoint → **404 Not Found**
3. Try admin dashboard → **403 Insufficient Privileges**
4. Check `/auth/me` → role comes from DB, not token

### Mass Assignment Defense
1. Go to **Mass Assignment Defense**
2. Register with role:"admin" and balance:99999
3. Server creates user as **role: user, balance: 1000** — fields ignored

### Admin Defense
1. Login as non-admin user
2. Go to **Admin Defense** → all admin endpoints blocked
3. Login as `admin` → admin endpoints work with DB-verified role

---

## ⚠️ Disclaimer

This project is for **educational and ethical hacking demonstration only**.
The blue team shows how to properly fix privilege escalation vulnerabilities.
