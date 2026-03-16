# Purple Team — Mitigation & Remediation Guide

## Overview

The Purple Team combines Red Team knowledge (how attacks work) with Blue Team detection to **permanently fix** the vulnerability. This guide covers step-by-step remediation for the SUDO misconfiguration and web application privilege escalation.

---

## 🔧 Part 1 — Fix the SUDO Misconfiguration (OS Level)

### Step 1 — Identify the Vulnerable Rule

Open the sudoers file safely:

```bash
sudo visudo
```

Look for and **remove** any of these dangerous patterns:

```bash
# ❌ REMOVE THESE — dangerous NOPASSWD rules:
student ALL=(ALL) NOPASSWD: /usr/bin/vim
student ALL=(ALL) NOPASSWD: ALL
student ALL=(ALL) NOPASSWD: /bin/bash
student ALL=(ALL) NOPASSWD: /usr/bin/python3
```

### Step 2 — Apply the Secure Configuration

Replace with a minimal, safe rule or remove entirely:

```bash
# ✅ Option A — Remove the rule entirely (recommended)
# Delete the line for 'student' in visudo

# ✅ Option B — Restrict to safe specific commands only
student ALL=(ALL) /usr/bin/apt update, /usr/bin/apt upgrade

# ✅ Option C — Require password for every sudo action (default behavior)
# Simply do not add any NOPASSWD lines
```

Refer to `purple_team/secure_sudo_config.txt` for the full hardened configuration template.

### Step 3 — Validate the Fix

```bash
# Verify sudoers has no syntax errors
sudo visudo -c

# Switch to student user and test
su - student
sudo -l     # Should NOT show NOPASSWD: /usr/bin/vim

# Confirm vim can no longer be run as root without password
sudo vim    # Should prompt for password — or be denied entirely
```

---

## 🔧 Part 2 — Principle of Least Privilege

The root cause of this attack is **over-permissioned accounts**. Apply these principles:

### 2.1 — Audit All Sudo Rules

```bash
# List all sudoers rules
sudo cat /etc/sudoers
sudo ls /etc/sudoers.d/
sudo cat /etc/sudoers.d/*
```

**Questions to ask for each rule:**
- Does this user really need this command?
- Can they do their job without NOPASSWD?
- Is this command on the GTFOBins list? (vim, nano, less, python, perl, etc.)

### 2.2 — Use Groups Instead of Individual Rules

```bash
# Create a limited admin group
sudo groupadd limited-admins

# Add user to group
sudo usermod -aG limited-admins student

# Grant only specific, safe commands to the group
# In visudo:
%limited-admins ALL=(ALL) /usr/bin/systemctl status *, /usr/bin/journalctl
```

### 2.3 — Check GTFOBins-Risky Commands

Always cross-reference commands against [GTFOBins](https://gtfobins.github.io/).  
**Never** grant NOPASSWD to:

| Command | Risk |
|---|---|
| `vim`, `vi`, `nano`, `emacs` | Shell escape via `:!sh` |
| `python`, `python3`, `perl`, `ruby` | `os.system('/bin/sh')` |
| `less`, `more`, `man` | `!sh` while paging |
| `find` | `find . -exec /bin/sh \;` |
| `awk`, `sed` | Command injection |
| `bash`, `sh`, `zsh` | Direct shell |
| `cp`, `mv` | Replace system files |
| `chmod` | Make files world-writable |

---

## 🔧 Part 3 — Fix the Web Application (Application Level)

### Problem 1 — Horizontal Privilege Escalation (IDOR)

**Vulnerable code** (`server/routes/profile.js`):
```javascript
// ❌ NO ownership check — anyone can fetch any user's profile
router.get("/", (req, res) => {
  const id = parseInt(req.query.id);
  const user = users.find(u => u.id === id);
  res.json(user);
});
```

**Fixed code**:
```javascript
// ✅ Verify the requester owns this profile
router.get("/", (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "Not authenticated" });

  const id = parseInt(req.query.id);

  // Enforce ownership — users can only see their own profile
  if (req.session.user.id !== id && req.session.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden — you cannot access another user's profile" });
  }

  const user = users.find(u => u.id === id);
  if (!user) return res.status(404).json({ error: "User not found" });

  res.json({ id: user.id, username: user.username, role: user.role }); // never return password
});
```

### Problem 2 — Vertical Privilege Escalation (Missing Role Check)

**Vulnerable code** (`server/routes/admin.js`):
```javascript
// ❌ Anyone can access admin — no authentication or role check
router.get("/", (req, res) => {
  res.send("Welcome to admin panel");
});
```

**Fixed code**:
```javascript
// ✅ Require authentication AND admin role
router.get("/", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  if (req.session.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden — admin access only" });
  }
  res.json({ message: "Welcome to admin panel", user: req.session.user.username });
});
```

### Problem 3 — Passwords Stored in Plaintext

**Fix**: Hash passwords using bcrypt.

```bash
npm install bcryptjs
```

```javascript
const bcrypt = require("bcryptjs");

// When creating users (hashing):
const hash = await bcrypt.hash("plaintextPassword", 12);

// When verifying login:
const match = await bcrypt.compare(req.body.password, user.hashedPassword);
```

---

## 🔧 Part 4 — Ongoing Monitoring Improvements

### 4.1 — Set Up Real-Time Alerting

```bash
# Install auditd for kernel-level monitoring
sudo apt install auditd

# Watch all sudo usage
sudo auditctl -a always,exit -F arch=b64 -S execve -F euid=0 -k sudo_monitor

# View audit logs
sudo ausearch -k sudo_monitor
```

### 4.2 — Restrict sudo to Specific Terminals

In `visudo`, restrict sudo to specific terminals:

```bash
# Only allow sudo from the physical console (tty1)
Defaults  requiretty
```

### 4.3 — Set sudo Timeout

Reduce the sudo credential cache timeout (default is 15 min):

```bash
# Set to 0 — require password every time
Defaults  timestamp_timeout=0

# Or set to 2 minutes
Defaults  timestamp_timeout=2
```

### 4.4 — Log Everything with Timestamps

```bash
# In visudo, enable verbose logging:
Defaults  logfile=/var/log/sudo.log
Defaults  log_input, log_output
```

---

## ✅ Verification Checklist

After applying all fixes:

- [ ] `sudo visudo -c` shows no errors
- [ ] `student` cannot run `vim` as root without a password (or at all)
- [ ] `/profile?id=3` returns 403 when logged in as alice (id=2) in fixed mode
- [ ] `/admin` returns 403 when logged in as a non-admin user in fixed mode
- [ ] Passwords are hashed in the user database
- [ ] `log_monitor.py` runs clean with no CRITICAL/HIGH alerts on normal usage

---

## Summary: Defense in Depth

```
Layer 1 (OS)   → Remove NOPASSWD sudo rules → Principle of Least Privilege
Layer 2 (App)  → Add session-based auth + role checks to all routes
Layer 3 (Data) → Hash passwords, never expose password fields in API responses
Layer 4 (Logs) → auditd + auth.log monitoring + automated alerts
Layer 5 (Policy) → Regular audits, GTFOBins awareness, sudo timeout enforcement
```
