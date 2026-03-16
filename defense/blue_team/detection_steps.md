# Blue Team — Privilege Escalation Detection Guide

## Overview

The Blue Team's role is to **detect, analyze, and respond** to privilege escalation attacks.  
This guide covers how to identify a SUDO misconfiguration exploit after it has occurred.

---

## 🔍 Step 1 — Identify Suspicious Sudo Activity

Linux logs all `sudo` usage in the auth log. Open it with:

```bash
sudo cat /var/log/auth.log
```

Or filter specifically for sudo events:

```bash
grep "sudo" /var/log/auth.log
```

### What to look for

| Log Pattern | What It Means |
|---|---|
| `COMMAND=/usr/bin/vim` | vim was run via sudo — GTFOBins risk |
| `NOPASSWD` in the rule | No password required — escalation too easy |
| `session opened for user root` | Root shell was opened |
| `authentication failure` | Failed sudo attempt — could be brute force |
| `USER=root COMMAND=` | Command ran as root via sudo |

### Example of an attack in the log

```
Mar 08 19:10:43 ubuntu sudo: student : TTY=pts/0 ; PWD=/home/student ;
  USER=root ; COMMAND=/usr/bin/vim
Mar 08 19:10:43 ubuntu sudo: pam_unix(sudo:session): session opened for user root
Mar 08 19:10:55 ubuntu sudo: pam_unix(sudo:session): session closed for user root
```

**Interpretation:** User `student` executed `vim` as root. If vim was used to spawn a shell (`vim -c '!sh'`), this represents a full privilege escalation.

---

## 🤖 Step 2 — Run the Automated Log Monitor

Use the provided Python script for automated detection:

```bash
# Scan the default auth log (requires sudo)
sudo python3 blue_team/log_monitor.py

# Scan with minimum severity HIGH only
sudo python3 blue_team/log_monitor.py --min-severity HIGH

# Scan a sample/custom log file
python3 blue_team/log_monitor.py --file /path/to/sample_auth.log
```

The script outputs color-coded alerts:

| Color | Severity | Meaning |
|---|---|---|
| 🔴 RED BOLD | CRITICAL | Immediate threat — shell spawned via sudo |
| 🔴 RED | HIGH | High risk — root session or NOPASSWD detected |
| 🟡 YELLOW | MEDIUM | Warning — failed attempts or unusual usage |
| 🔵 CYAN | INFO | General sudo usage noted |

---

## 🔎 Step 3 — Check for Active Root Sessions

If an attack is in progress or just occurred:

```bash
# See all logged-in users (look for root)
who

# See all active processes (look for suspicious root shells)
ps aux | grep -E "bash|sh" | grep root

# Check which users are currently logged in
w

# See recent logins
last | head -20
```

---

## 📋 Step 4 — Review Sudoers File for Misconfigurations

```bash
sudo cat /etc/sudoers
# Or safer:
sudo visudo -c    # Check sudoers syntax without editing
```

### Red Flags in sudoers

```
# DANGEROUS — no password, unrestricted command:
student ALL=(ALL) NOPASSWD: /usr/bin/vim

# DANGEROUS — full root access without password:
student ALL=(ALL) NOPASSWD: ALL

# DANGEROUS — allows shell:
student ALL=(ALL) NOPASSWD: /bin/bash
```

---

## 🚨 Step 5 — Incident Response

Once an attack is confirmed:

### 5.1 — Contain the Threat

```bash
# Lock the attacker's account immediately
sudo usermod -L student

# Kill any active root sessions from that user
sudo pkill -u root
```

### 5.2 — Preserve Evidence

```bash
# Copy the logs before they rotate
sudo cp /var/log/auth.log /tmp/incident_auth.log.bak

# Record current running processes
ps aux > /tmp/incident_processes.txt

# Record network connections
netstat -tulnp > /tmp/incident_network.txt
```

### 5.3 — Audit System Changes

```bash
# Find files modified in the last 60 minutes
find / -mmin -60 -type f 2>/dev/null | grep -v /proc

# Check recently modified system files
find /etc /bin /usr/bin -newer /tmp -type f 2>/dev/null
```

---

## 📊 Detection Summary Table

| Detection Method | Tool | What It Catches |
|---|---|---|
| Auth log review | `grep sudo /var/log/auth.log` | All sudo events |
| Automated monitor | `log_monitor.py` | Suspicious patterns, alerts |
| Active session check | `who`, `ps aux` | Live root sessions |
| Sudoers audit | `visudo -c` , `cat /etc/sudoers` | Misconfigurations |
| File change audit | `find -mmin -60` | Post-exploit tampering |

---

## 💡 Key Takeaways for Blue Team

1. **Log everything** — `auth.log` is your first line of evidence
2. **Alert on NOPASSWD** — any NOPASSWD rule is a red flag
3. **GTFOBins awareness** — editors (`vim`, `nano`, `less`) can spawn shells
4. **Automate detection** — manual log review doesn't scale; use scripts or SIEM
5. **Respond fast** — lock accounts and preserve logs before they rotate
