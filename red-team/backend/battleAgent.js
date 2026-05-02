const axios = require("axios");

let GoogleGenerativeAI;

function nowIso() {
  return new Date().toISOString();
}

function clampHistory(history, max) {
  if (history.length <= max) return history;
  return history.slice(0, max);
}

function safeJson(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

const SCENARIOS = {
  IDOR_READ: {
    scenarioId: "idor_profile",
    name: "IDOR — Read another user's profile",
    category: "IDOR",
    description: "Attempted to read another user's profile data",
    fallback:
      "Red allowed the request because it didn’t enforce ownership checks. Blue rejected it with object-level authorization (only the owner or an admin can access that record).",
  },
  IDOR_UPDATE: {
    scenarioId: "idor_update",
    name: "IDOR — Modify another user's profile",
    category: "IDOR",
    description: "Attempted to update another user's profile data",
    fallback:
      "Red accepted the update without verifying resource ownership. Blue enforced ownership checks and blocked the unauthorized update attempt.",
  },
  IDOR_FINANCIAL: {
    scenarioId: "idor_financial",
    name: "IDOR — Read another user's balance",
    category: "IDOR",
    description: "Attempted to read another user's financial data",
    fallback:
      "Red exposed financial data by trusting the URL ID without verifying the requester. Blue restricted balance access to the owning account (or admin), preventing the leak.",
  },
  JWT_ROLE_TAMPERING: {
    scenarioId: "jwt_forgery",
    name: "JWT — Role tampering attempt",
    category: "JWT",
    description: "Attempted to gain elevated access via JWT manipulation",
    fallback:
      "Red trusted role claims coming from the token, enabling privilege escalation. Blue validates tokens strictly and derives roles from the database, so tampering doesn’t grant extra privileges.",
  },
  MASS_ASSIGNMENT: {
    scenarioId: "mass_assignment",
    name: "Mass Assignment — Privileged field injection",
    category: "Mass Assignment",
    description: "Attempted to set privileged fields like role/balance via request body",
    fallback:
      "Red accepted privileged fields from the request body, allowing unauthorized property injection. Blue uses strict field whitelisting so privileged fields are ignored and the attack fails.",
  },
  VERTICAL_ESCALATION: {
    scenarioId: "broken_access_control",
    name: "Broken Access Control — Admin endpoint access",
    category: "Access Control",
    description: "Attempted to access admin-only functionality",
    fallback:
      "Red’s admin authorization is weak and can be bypassed in the lab. Blue verifies access on every request (role enforced server-side), blocking unauthorized admin access.",
  },
  VERTICAL_ESCALATION_DESTRUCT: {
    scenarioId: "broken_access_control_destructive",
    name: "Broken Access Control — Destructive admin action",
    category: "Access Control",
    description: "Attempted a destructive admin-only action",
    fallback:
      "Red allowed an admin-only destructive action due to broken function-level authorization. Blue enforces server-side authorization and logs/admin-audits sensitive actions.",
  },
  OVEREXPOSED_FIELDS: {
    scenarioId: "overexposed_fields",
    name: "Overexposed Data — Sensitive fields in responses",
    category: "Data Exposure",
    description: "Checked whether sensitive fields were returned in API responses",
    fallback:
      "Red returned sensitive fields (like SSN/credit cards) in a general user-list response. Blue filters sensitive fields for non-admin users to prevent accidental data exposure.",
  },
};

function mapAttackTypeToScenario(attackType) {
  if (!attackType) return null;
  if (SCENARIOS[attackType]) return SCENARIOS[attackType];

  // Composite types in red-team code
  if (String(attackType).includes("IDOR_UPDATE") && String(attackType).includes("MASS_ASSIGNMENT")) {
    return {
      scenarioId: "idor_update_mass_assignment",
      name: "IDOR + Mass Assignment — Unauthorized update",
      category: "Mass Assignment",
      description: "Attempted unauthorized update with privileged fields",
      fallback:
        "Red permitted an unauthorized update and accepted privileged fields. Blue blocks the ownership violation and ignores privileged properties via whitelisting.",
    };
  }

  return {
    scenarioId: "unknown",
    name: String(attackType),
    category: "Other",
    description: "Observed a security-relevant event",
    fallback: "Red allowed a risky behavior; Blue applies stricter validation and authorization.",
  };
}

function mapDefenseTypeToScenarioId(defenseType) {
  switch (defenseType) {
    case "IDOR_BLOCKED":
      return "idor_profile";
    case "IDOR_UPDATE_BLOCKED":
      return "idor_update";
    case "IDOR_FINANCIAL_BLOCKED":
      return "idor_financial";
    case "MASS_ASSIGNMENT_BLOCKED":
      return "mass_assignment";
    case "ADMIN_ACCESS_BLOCKED":
      return "broken_access_control";
    case "OVEREXPOSED_FIELDS_BLOCKED":
      return "overexposed_fields";
    default:
      return "unknown";
  }
}

class BattleAgent {
  constructor({
    io,
    redApiBase = "http://localhost:4000/api",
    blueApiBase = "http://localhost:5000/api",
    intervalMs = 120000,
    geminiApiKey = process.env.GEMINI_API_KEY,
  }) {
    this.io = io;
    this.redApiBase = redApiBase;
    this.blueApiBase = blueApiBase;
    this.intervalMs = intervalMs;

    this.running = false;
    this.timer = null;

    this.score = { attacker: 0, defender: 0, total: 0 };
    this.history = [];

    this.lastSeen = {
      attackId: 0,
      defenseId: 0,
    };

    this.pending = {
      red: [],
      blue: [],
    };

    this.geminiApiKey = geminiApiKey;
    this.geminiModel = "gemini-1.5-flash";
  }

  getState() {
    return {
      running: this.running,
      score: this.score,
      history: this.history,
      intervalMs: this.intervalMs,
    };
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._schedule();
  }

  stop() {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  setIntervalMs(intervalMs) {
    const parsed = Number(intervalMs);
    if (!Number.isFinite(parsed) || parsed < 5000) {
      throw new Error("intervalMs must be a number >= 5000");
    }
    this.intervalMs = parsed;
    if (this.running) {
      this.stop();
      this.start();
    }
  }

  async tick() {
    // Fetch latest logs (public endpoints in this lab)
    const [attackRes, defenseRes] = await Promise.allSettled([
      axios.get(`${this.redApiBase}/attack-log`),
      axios.get(`${this.blueApiBase}/defense-log`),
    ]);

    if (attackRes.status === "fulfilled") {
      const logs = attackRes.value?.data?.logs || [];
      this._ingestAttackLogs(logs);
    }

    if (defenseRes.status === "fulfilled") {
      const logs = defenseRes.value?.data?.logs || [];
      this._ingestDefenseLogs(logs);
    }

    // Attempt to correlate and emit events
    await this._correlateAndEmit();
  }

  _schedule() {
    const run = async () => {
      if (!this.running) return;
      try {
        await this.tick();
      } catch (err) {
        // Never crash the server because of the agent
        console.error("[BattleAgent] tick error:", err?.message || err);
      } finally {
        if (this.running) {
          this.timer = setTimeout(run, this.intervalMs);
        }
      }
    };

    this.timer = setTimeout(run, 250);
  }

  _ingestAttackLogs(logs) {
    // logs come DESC; take new ones by id
    const sortedAsc = [...logs].sort((a, b) => (a.id || 0) - (b.id || 0));
    for (const log of sortedAsc) {
      const id = Number(log.id || 0);
      if (id <= this.lastSeen.attackId) continue;
      this.lastSeen.attackId = Math.max(this.lastSeen.attackId, id);

      const scenario = mapAttackTypeToScenario(log.attack_type);
      const scenarioId = scenario?.scenarioId || "unknown";
      const httpStatus = log.payload?.http?.status;

      this.pending.red.push({
        kind: "red",
        id,
        ts: log.timestamp || nowIso(),
        scenarioId,
        scenario,
        attacker: log.attacker_user || "anonymous",
        target: log.target_user || null,
        red: {
          status: typeof httpStatus === "number" ? httpStatus : null,
          success: !!log.success,
        },
        raw: log,
      });
    }

    // Keep pending bounded
    this.pending.red = this.pending.red.slice(-200);
  }

  _ingestDefenseLogs(logs) {
    const sortedAsc = [...logs].sort((a, b) => (a.id || 0) - (b.id || 0));
    for (const log of sortedAsc) {
      const id = Number(log.id || 0);
      if (id <= this.lastSeen.defenseId) continue;
      this.lastSeen.defenseId = Math.max(this.lastSeen.defenseId, id);

      const scenarioId = mapDefenseTypeToScenarioId(log.defense_type);
      const httpStatus = log.payload?.http?.status;

      this.pending.blue.push({
        kind: "blue",
        id,
        ts: log.timestamp || nowIso(),
        scenarioId,
        defenderUser: log.user || "anonymous",
        target: log.target || null,
        blue: {
          status: typeof httpStatus === "number" ? httpStatus : null,
          // In blue logs, blocked is true when the attempt was prevented.
          // For battle events, success means the ATTACK succeeded (so invert).
          success: !log.blocked,
        },
        raw: log,
      });
    }

    this.pending.blue = this.pending.blue.slice(-200);
  }

  _withinWindow(tsA, tsB, windowMs) {
    const a = new Date(tsA).getTime();
    const b = new Date(tsB).getTime();
    if (!Number.isFinite(a) || !Number.isFinite(b)) return true;
    return Math.abs(a - b) <= windowMs;
  }

  async _correlateAndEmit() {
    // Correlate red+blue events by scenarioId + username within a window
    const windowMs = 5 * 60 * 1000; // 5 minutes

    const usedRed = new Set();
    const usedBlue = new Set();

    const eventsToEmit = [];

    for (let i = 0; i < this.pending.red.length; i++) {
      const redEvt = this.pending.red[i];
      if (usedRed.has(redEvt.id)) continue;

      const matchIndex = this.pending.blue.findIndex((b) => {
        if (usedBlue.has(b.id)) return false;
        if (b.scenarioId !== redEvt.scenarioId) return false;
        if (!this._withinWindow(b.ts, redEvt.ts, windowMs)) return false;
        // Best-effort user match
        if (b.defenderUser && redEvt.attacker && b.defenderUser !== redEvt.attacker) return false;
        return true;
      });

      if (matchIndex === -1) continue;

      const blueEvt = this.pending.blue[matchIndex];
      usedRed.add(redEvt.id);
      usedBlue.add(blueEvt.id);

      const battleEvent = await this._buildBattleEvent({ redEvt, blueEvt });
      eventsToEmit.push(battleEvent);
    }

    // Drop used entries
    this.pending.red = this.pending.red.filter((e) => !usedRed.has(e.id));
    this.pending.blue = this.pending.blue.filter((e) => !usedBlue.has(e.id));

    for (const event of eventsToEmit) {
      this._emit(event);
    }
  }

  async _buildBattleEvent({ redEvt, blueEvt }) {
    const scenario = redEvt.scenario || mapAttackTypeToScenario(redEvt.raw?.attack_type);

    const attackerPoint = redEvt.red.success ? 1 : 0;
    const defenderPoint = blueEvt.blue.success ? 0 : 1;

    // Cumulative scoring
    this.score = {
      attacker: this.score.attacker + attackerPoint,
      defender: this.score.defender + defenderPoint,
      total: this.score.total + 1,
    };

    const base = {
      id: Date.now(),
      ts: nowIso(),
      scenarioId: scenario.scenarioId,
      name: scenario.name,
      category: scenario.category,
      description: scenario.description,
      red: redEvt.red,
      blue: blueEvt.blue,
      attackerPoint,
      defenderPoint,
      narration: "",
      score: this.score,
    };

    base.narration = await this._narrate(base, scenario.fallback);
    return base;
  }

  async _narrate(event, fallbackText) {
    if (!this.geminiApiKey) return fallbackText;

    try {
      if (!GoogleGenerativeAI) {
        // Lazy-require to avoid hard dependency crashes
        // eslint-disable-next-line global-require
        ({ GoogleGenerativeAI } = require("@google/generative-ai"));
      }

      const client = new GoogleGenerativeAI(this.geminiApiKey);
      const model = client.getGenerativeModel({ model: this.geminiModel });

      const prompt = {
        task: "Explain a security lab outcome in 2-3 sentences.",
        scenario: {
          id: event.scenarioId,
          name: event.name,
          category: event.category,
          description: event.description,
        },
        results: {
          red: { status: event.red.status, success: event.red.success },
          blue: { status: event.blue.status, success: event.blue.success },
        },
        constraints: [
          "Explain what happened.",
          "Why Red was exploitable.",
          "What Blue did to prevent it.",
          "No step-by-step exploitation instructions.",
        ],
      };

      const result = await model.generateContent(safeJson(prompt));
      const text = result?.response?.text?.() || "";
      const cleaned = String(text).trim();
      return cleaned.length > 0 ? cleaned : fallbackText;
    } catch (err) {
      console.error("[BattleAgent] Gemini narration failed:", err?.message || err);
      return fallbackText;
    }
  }

  _emit(event) {
    // Persist history and broadcast
    this.history = clampHistory([event, ...this.history], 50);
    if (this.io) {
      this.io.emit("battle:event", event);
    }
  }
}

module.exports = { BattleAgent };
