# Privilege Escalation Web Demo
---
Educational cybersecurity lab demonstrating real-world privilege escalation attacks and their secure mitigations.

## Overview

This project consists of two environments:
* **🔴 Red Team** — Intentionally vulnerable system to simulate attacks
* **🔵 Blue Team** — Secure implementation with all vulnerabilities fixed

It helps understand how attacks work + how to defend against them.

## Tech Stack

* **Backend:** Node.js, Express, SQLite
* **Frontend:** React.js
* **Auth:** JWT
* **Realtime:** WebSockets

## 🔴 Red Team (Attack Lab)

* Demonstrates IDOR, JWT tampering, mass assignment, admin escalation
* Includes attacker dashboard for hands-on exploitation
* Logs attacks in real-time

### Key Vulnerabilities
* Broken access control (IDOR)
* Weak JWT validation
* Mass assignment flaws
* Missing role verification

## 🔵 Blue Team (Defense Lab)

All Red Team vulnerabilities are fixed and hardened:
* Strict authorization checks
* Secure JWT validation (HS256, DB roles)
* Field whitelisting
* Rate limiting + secure error handling
* Full audit & defense logging

## Setup

### Red Team
```bash
cd red-team/backend && npm install && npm run dev
cd red-team/frontend && npm install && npm start
```

### Blue Team
```bash
cd blue-team/backend && npm install && npm start
cd blue-team/frontend && npm install && npm start
```
