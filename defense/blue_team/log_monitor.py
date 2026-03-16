#!/usr/bin/env python3
"""
=============================================================
  Blue Team — Privilege Escalation Log Monitor
  Project: SUDO Misconfiguration Demo
  Team:    Blue Team (Detection & Response)
=============================================================

What this script does:
  - Reads /var/log/auth.log (Linux) or a custom log file
  - Detects suspicious sudo usage patterns
  - Flags NOPASSWD escalations, root shell spawning, vim exploits
  - Prints color-coded alerts to the terminal

Run:
  sudo python3 log_monitor.py
  python3 log_monitor.py --file sample_auth.log
"""

import re
import sys
import argparse
from datetime import datetime

# ── ANSI color codes ──────────────────────────────────────────────
RED     = "\033[91m"
YELLOW  = "\033[93m"
GREEN   = "\033[92m"
CYAN    = "\033[96m"
BOLD    = "\033[1m"
RESET   = "\033[0m"

# ── Default log path (Linux) ──────────────────────────────────────
DEFAULT_LOG = "/var/log/auth.log"

# ── Detection Rules ───────────────────────────────────────────────
# Each rule is a (pattern, severity, description) tuple.
# severity: "CRITICAL" | "HIGH" | "MEDIUM" | "INFO"
RULES = [
    (
        re.compile(r"sudo.*COMMAND=.*\/usr\/bin\/vim", re.IGNORECASE),
        "CRITICAL",
        "vim executed via sudo — possible GTFOBins shell escape"
    ),
    (
        re.compile(r"sudo.*NOPASSWD", re.IGNORECASE),
        "HIGH",
        "NOPASSWD sudo rule triggered — no password required for privilege escalation"
    ),
    (
        re.compile(r"sudo.*COMMAND=.*\/bin\/bash|\/bin\/sh|\/usr\/bin\/bash", re.IGNORECASE),
        "CRITICAL",
        "Shell spawned via sudo — direct root shell access gained"
    ),
    (
        re.compile(r"sudo.*authentication failure", re.IGNORECASE),
        "MEDIUM",
        "Failed sudo attempt — possible brute force or unauthorized escalation attempt"
    ),
    (
        re.compile(r"session opened for user root", re.IGNORECASE),
        "HIGH",
        "Root session opened — verify this is authorized"
    ),
    (
        re.compile(r"sudo.*USER=root.*COMMAND", re.IGNORECASE),
        "HIGH",
        "Command executed as root via sudo"
    ),
    (
        re.compile(r"sudo.*3\+ incorrect password attempts", re.IGNORECASE),
        "HIGH",
        "Multiple failed sudo password attempts — possible brute force"
    ),
    (
        re.compile(r"sudo", re.IGNORECASE),
        "INFO",
        "sudo usage detected"
    ),
]

# ── Severity → color mapping ──────────────────────────────────────
SEVERITY_COLOR = {
    "CRITICAL": RED + BOLD,
    "HIGH":     RED,
    "MEDIUM":   YELLOW,
    "INFO":     CYAN,
}

SEVERITY_RANK = {"CRITICAL": 4, "HIGH": 3, "MEDIUM": 2, "INFO": 1}


def parse_args():
    parser = argparse.ArgumentParser(
        description="Blue Team — SUDO Privilege Escalation Log Monitor"
    )
    parser.add_argument(
        "--file", "-f",
        default=DEFAULT_LOG,
        help=f"Path to the auth log file (default: {DEFAULT_LOG})"
    )
    parser.add_argument(
        "--min-severity", "-s",
        choices=["INFO", "MEDIUM", "HIGH", "CRITICAL"],
        default="INFO",
        help="Minimum severity level to display (default: INFO)"
    )
    parser.add_argument(
        "--summary", action="store_true",
        help="Print a summary report at the end"
    )
    return parser.parse_args()


def banner():
    print(f"""
{CYAN}{BOLD}╔══════════════════════════════════════════════════════════╗
║        Blue Team — SUDO Privilege Escalation Monitor       ║
║        Ethical Hacking Project — Detection Module          ║
╚══════════════════════════════════════════════════════════╝{RESET}
""")


def analyze_log(filepath: str, min_severity: str) -> list[dict]:
    """Read a log file and return all matching alert entries."""
    alerts = []
    min_rank = SEVERITY_RANK[min_severity]

    try:
        with open(filepath, "r", errors="replace") as f:
            lines = f.readlines()
    except FileNotFoundError:
        print(f"{RED}[ERROR]{RESET} Log file not found: {filepath}")
        print(f"       Tip: Run as root, or specify a custom file with --file")
        sys.exit(1)
    except PermissionError:
        print(f"{RED}[ERROR]{RESET} Permission denied: {filepath}")
        print(f"       Tip: Run with: sudo python3 log_monitor.py")
        sys.exit(1)

    print(f"{GREEN}[INFO]{RESET}  Scanning {len(lines)} log lines from: {filepath}\n")

    for line_num, line in enumerate(lines, start=1):
        line = line.strip()
        if not line:
            continue

        for pattern, severity, description in RULES:
            if pattern.search(line):
                rank = SEVERITY_RANK[severity]
                if rank < min_rank:
                    # Still record info-level but don't print if below threshold
                    # Only skip if INFO is below threshold
                    if severity == "INFO" and min_severity != "INFO":
                        break  # stop at first rule match for this line

                alerts.append({
                    "line_num":    line_num,
                    "severity":    severity,
                    "description": description,
                    "log_line":    line,
                })

                color = SEVERITY_COLOR.get(severity, RESET)
                print(f"{color}[{severity}]{RESET} Line {line_num}: {description}")
                print(f"         {BOLD}Log:{RESET} {line}\n")
                break  # only match the first (highest-priority) rule per line

    return alerts


def print_summary(alerts: list[dict]):
    print(f"\n{CYAN}{BOLD}{'─'*60}")
    print("  DETECTION SUMMARY")
    print(f"{'─'*60}{RESET}")

    counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "INFO": 0}
    for a in alerts:
        counts[a["severity"]] += 1

    for sev in ["CRITICAL", "HIGH", "MEDIUM", "INFO"]:
        color = SEVERITY_COLOR.get(sev, RESET)
        print(f"  {color}{sev:<10}{RESET}  {counts[sev]} event(s)")

    total = sum(counts.values())
    print(f"\n  Total alerts: {BOLD}{total}{RESET}")

    if counts["CRITICAL"] > 0 or counts["HIGH"] > 0:
        print(f"\n  {RED}{BOLD}⚠  HIGH-RISK ACTIVITY DETECTED — Immediate investigation required!{RESET}")
        print(f"  Recommended actions:")
        print(f"    1. Identify the user who triggered the alert")
        print(f"    2. Check if a root shell is still active: ps aux | grep bash")
        print(f"    3. Lock the account: sudo usermod -L <username>")
        print(f"    4. Review and fix /etc/sudoers with: sudo visudo")
        print(f"    5. Rotate credentials and audit system for changes")
    elif counts["MEDIUM"] > 0:
        print(f"\n  {YELLOW}⚠  Suspicious activity detected — Review recommended.{RESET}")
    else:
        print(f"\n  {GREEN}✓  No critical alerts. System appears normal.{RESET}")

    print(f"{CYAN}{BOLD}{'─'*60}{RESET}\n")


def main():
    args = parse_args()
    banner()

    print(f"{BOLD}Timestamp:{RESET}    {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{BOLD}Log File:{RESET}     {args.file}")
    print(f"{BOLD}Min Severity:{RESET} {args.min_severity}\n")

    alerts = analyze_log(args.file, args.min_severity)

    if not alerts:
        print(f"{GREEN}[OK]{RESET} No suspicious sudo activity found matching severity >= {args.min_severity}")
    else:
        if args.summary or True:  # always show summary
            print_summary(alerts)


if __name__ == "__main__":
    main()
