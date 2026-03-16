# Defense — Privilege Escalation Fixes

This document summarizes all fixes applied to address the privilege escalation vulnerabilities demonstrated in this project.  
It covers both the **OS-level** (SUDO misconfiguration) and **web application-level** (IDOR + role bypass) vulnerabilities.

---

## Fix 1 — Remove NOPASSWD Sudo Rule (OS Level)

### Vulnerability
The user `student` was granted a dangerous sudo permission:
```
student ALL=(ALL) NOPASSWD: /usr/bin/vim
```
This allowed `student` to run `vim` as root **without a password**, which can be trivially exploited to launch a root shell using:
```bash
sudo vim -c ':!sh'
```

### Fix Applied
Remove the NOPASSWD rule in `visudo`:
```bash
sudo visudo
```
**Delete** the line:
```
student ALL=(ALL) NOPASSWD: /usr/bin/vim
```

Apply the hardened config from `purple_team/secure_sudo_config.txt`, which:
- Requires password for all sudo actions (`timestamp_timeout=0`)
- Restricts student to no sudo access at all
- Logs all sudo events to `/var/log/sudo.log`

**Result:** `sudo vim` will now either be denied or prompt for a password, removing the NOPASSWD shell escape path.

---

## Fix 2 — IDOR (Horizontal Privilege Escalation) in `/profile` Route

### Vulnerability
The profile endpoint returned **any user's data** based on a user-controlled `id` query parameter with no ownership verification:
```javascript
// ❌ Vulnerable: no check that the requester owns the profile
router.get("/", (req, res) => {
  const id = parseInt(req.query.id);
  const user = users.find(u => u.id === id);
  res.json(user);  // returns password too!
});
```

**Attack:** Alice (id=2) fetches `/profile?id=3` → receives Bob's data (and password).

### Fix Applied
Added **session-based ownership enforcement**:
```javascript
// ✅ Fixed: verify session + ownership before returning data
router.get("/", (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "Not authenticated" });
  const id = parseInt(req.query.id);
  if (req.session.user.id !== id && req.session.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }
  const user = users.find(u => u.id === id);
  res.json({ id: user.id, username: user.username, role: user.role }); // no password
});
```

**Key changes:**
- ✅ Session authentication check before any data access
- ✅ Ownership check: logged-in user `id` must match requested `id`
- ✅ Admin override: admins can view any profile
- ✅ Password field never returned in response

---

## Fix 3 — Vertical Privilege Escalation in `/admin` Route

### Vulnerability
The admin panel was completely open — **no authentication, no role check**:
```javascript
// ❌ Vulnerable: anyone can access admin
router.get("/", (req, res) => {
  res.send("Welcome to admin panel");
});
```

**Attack:** Any user (or even unauthenticated request) accessing `/admin` gets in.

### Fix Applied
Added **role-based access control (RBAC)**:
```javascript
// ✅ Fixed: require admin role
router.get("/", (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "Not authenticated" });
  if (req.session.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
  res.json({ message: "Welcome to admin panel", user: req.session.user.username });
});
```

**Key changes:**
- ✅ Authentication check (must be logged in)
- ✅ Authorization check (must have `role === "admin"`)
- ✅ Returns 401 for unauthenticated, 403 for unauthorized

---

## Fix 4 — Session Management (Broken Auth)

### Vulnerability
The original `auth.js` stored the current user in a **global variable** (`let currentUser = null`), which is shared across all requests and all users — a severe multi-user bug.

### Fix Applied
Replaced with **`express-session`** — proper per-request session cookies:
```javascript
req.session.user = { id, username, role };  // stored per session
```

---

## Fix 5 — Sensitive Data Exposure (Passwords in API Response)

### Vulnerability
The original profile and login endpoints returned the **raw user object including the password**:
```json
{ "id": 2, "username": "alice", "password": "1234", "role": "user" }
```

### Fix Applied
All API responses now **explicitly exclude the password field**:
```javascript
res.json({ id: user.id, username: user.username, role: user.role });
```

---

## Summary Table

| # | Vulnerability | Type | Fix Applied |
|---|---|---|---|
| 1 | `student NOPASSWD: /usr/bin/vim` | SUDO Misconfiguration | Remove rule, apply hardened sudoers |
| 2 | `/profile?id=N` with no ownership check | IDOR / Horizontal PE | Session + ownership validation |
| 3 | `/admin` with no auth or role check | Vertical PE / Broken Access Control | Session + role check (RBAC) |
| 4 | Global `currentUser` variable for auth | Broken Authentication | `express-session` per-request sessions |
| 5 | Password returned in API responses | Sensitive Data Exposure | Strip password from all JSON responses |

---

## Further Recommendations

1. **Hash passwords** with bcrypt (`npm install bcryptjs`) — never store plaintext
2. **Use HTTPS** in production to protect session cookies in transit
3. **Set `HttpOnly` + `Secure` cookie flags** to prevent XSS session theft
4. **Audit sudo rules regularly** — quarterly review of `/etc/sudoers` and `/etc/sudoers.d/`
5. **Check GTFOBins** before granting sudo to any command: [gtfobins.github.io](https://gtfobins.github.io/)
6. **Enable auditd** for kernel-level process monitoring on Linux
