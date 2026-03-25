# 🔴 RED TEAM — Privilege Escalation Lab

> **Educational use only.** This is an intentionally vulnerable application for demonstrating horizontal and vertical privilege escalation attacks in a controlled ethical hacking lab.

---

## Folder Structure

```
red-team/
├── backend/                      # Intentionally vulnerable Node.js API
│   ├── app.js                    # Express server entry point
│   ├── package.json
│   ├── database/
│   │   └── init.js               # SQLite DB init + seed data
│   ├── middleware/
│   │   ├── auth.js               # Vulnerable JWT middleware
│   │   └── attackLogger.js       # Logs all attacks to DB + WebSocket
│   └── routes/
│       ├── auth.js               # Login, register (mass assignment vuln)
│       ├── users.js              # User CRUD (IDOR vulnerabilities)
│       ├── admin.js              # Admin routes (vertical escalation)
│       └── attackLog.js          # Attack log API
│
└── frontend/                     # React attacker dashboard
    ├── package.json
    └── src/
        ├── App.jsx               # Routing
        ├── index.js
        ├── context/
        │   └── AuthContext.jsx   # Auth state + token management
        ├── utils/
        │   └── api.js            # Axios instance
        ├── components/
        │   ├── Layout.jsx        # Sidebar + main layout
        │   └── Layout.css        # Full design system CSS
        └── pages/
            ├── LoginPage.jsx     # Login with demo users
            ├── Dashboard.jsx     # Attack command center
            ├── IDORPage.jsx      # IDOR attack module
            ├── JWTForgePage.jsx  # JWT role tampering
            ├── MassAssignPage.jsx # Mass assignment attacks
            ├── AdminPanelPage.jsx # Admin escalation
            └── AttackLogPage.jsx  # Live attack feed (WebSocket)
```

---

## Vulnerabilities Demonstrated

| Attack | Type | CVE/Reference | Endpoint |
|--------|------|---------------|----------|
| IDOR Profile Read | Horizontal | OWASP API1:2023 | `GET /api/users/:id` |
| IDOR Balance Read | Horizontal | OWASP API1:2023 | `GET /api/users/:id/balance` |
| IDOR Profile Update | Horizontal | OWASP API1:2023 | `PUT /api/users/:id` |
| JWT Role Tampering | Vertical | CVE-2022-21449 | `POST /api/auth/forge-token` |
| Mass Assignment (Register) | Vertical | OWASP API3:2023 | `POST /api/auth/register` |
| Mass Assignment (Update) | Vertical | OWASP API3:2023 | `PUT /api/users/:id` |
| Admin Panel Escalation | Vertical | OWASP API5:2023 | `GET /api/admin/*` |
| Forced Browsing | Vertical | OWASP API5:2023 | `GET /api/admin/secret` |

---

## Setup & Run

### Backend

```bash
cd red-team/backend
npm install
npm run dev       # Runs on http://localhost:4000
```

### Frontend

```bash
cd red-team/frontend
npm install
npm start         # Runs on http://localhost:3000
```

---

## Demo Users (Seed Data)

| Username | Password | Role |
|----------|----------|------|
| alice | password123 | user |
| bob | password123 | user |
| charlie | password123 | moderator |
| admin | admin123 | admin |

---

## Attack Walkthrough

### Horizontal Escalation (IDOR)
1. Login as `alice` (ID: 1)
2. Go to **IDOR Attack** page
3. Set Target ID to `2` (bob) — access bob's SSN, credit card, balance
4. Switch to **Update** tab — modify bob's email/bio without permission

### Vertical Escalation (JWT + Admin)
1. Login as `alice` (regular user)
2. Go to **JWT Tampering** — forge token with `role: "admin"`
3. Click **Apply Token** — session now presents as admin
4. Go to **Admin Escalation** — execute all admin actions
5. Dump all users, exfiltrate SSN/credit cards, delete accounts

### Mass Assignment
1. Go to **Mass Assignment** page
2. Register a new user with `role: "admin"` and `balance: 99999`
3. Server creates an admin account with your chosen balance

---

## Real-time Purple Team Integration

All attacks are:
- Logged to `database/lab.db` (attack_log table)
- Broadcast via WebSocket on port 4000
- Viewable on the **Attack Log** page (live feed)
- Consumable by the Purple Team dashboard via `GET /api/attack-log`

---

## ⚠️ Disclaimer

This project is for **educational and ethical hacking demonstration only**.
All vulnerabilities are intentional. Never deploy this server on a public network.
