import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";

const AGENT_BASE = "http://localhost:4000";

function formatTime(ts) {
  try { return new Date(ts).toLocaleTimeString(); } catch { return String(ts); }
}

function categoryColor(cat) {
  const c = String(cat || "").toLowerCase();
  if (c.includes("idor")) return "#ff2244";
  if (c.includes("jwt")) return "#ffaa00";
  if (c.includes("mass")) return "#ff8800";
  if (c.includes("chain")) return "#cc44ff";
  if (c.includes("access")) return "#ff4466";
  if (c.includes("exposure") || c.includes("data")) return "#ffcc00";
  return "#888";
}

function blockRateColor(pct) {
  if (pct >= 70) return "var(--green)";
  if (pct >= 40) return "var(--amber)";
  return "var(--red)";
}

export default function BattleDashboard() {
  const [events, setEvents] = useState([]);
  const [score, setScore] = useState(null);
  const [stats, setStats] = useState(null);
  const [privMetrics, setPrivMetrics] = useState(null);
  const [running, setRunning] = useState(false);
  const [intervalMs, setIntervalMs] = useState(10000);
  const [loading, setLoading] = useState(true);
  const [ticker, setTicker] = useState([]);
  const [speedFlash, setSpeedFlash] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [error, setError] = useState(null);
  const [catBreakdown, setCatBreakdown] = useState({});
  const [latestPopup, setLatestPopup] = useState(null);
  const socketRef = useRef(null);

  const totalAttacks = score?.total || 0;
  const exploitsSucceeded = score?.attacker || 0;
  const attacksBlocked = score?.defender || 0;
  const blueBlockRate = totalAttacks > 0 ? Math.round((attacksBlocked / totalAttacks) * 100) : 0;

  const { attackerPct, defenderPct } = useMemo(() => {
    const denom = (score?.attacker || 0) + (score?.defender || 0);
    if (denom <= 0) return { attackerPct: 50, defenderPct: 50 };
    return {
      attackerPct: Math.round(((score.attacker || 0) / denom) * 100),
      defenderPct: Math.round(((score.defender || 0) / denom) * 100),
    };
  }, [score]);

  const fetchPrivMetrics = useCallback(async () => {
    try {
      const res = await fetch(`${AGENT_BASE}/agent/metrics`);
      const data = await res.json();
      setPrivMetrics(data);
    } catch {
      setPrivMetrics(null);
    }
  }, []);

  const hydrate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [stateRes, statsRes, metricsRes] = await Promise.all([
        fetch(`${AGENT_BASE}/agent/state`),
        fetch(`${AGENT_BASE}/agent/stats`),
        fetch(`${AGENT_BASE}/agent/metrics`),
      ]);
      const state = await stateRes.json();
      const statsData = await statsRes.json();
      const metricData = await metricsRes.json();
      setScore(state.score || { attacker: 0, defender: 0, total: 0 });
      setEvents((state.history || []).slice(0, 30));
      setRunning(!!state.running);
      setIntervalMs(state.intervalMs || 10000);
      if (state.categoryBreakdown) setCatBreakdown(state.categoryBreakdown);
      setStats(statsData);
      setPrivMetrics(metricData);
    } catch (err) {
      setError("Failed to connect to agent server");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    hydrate();
    const sock = io(AGENT_BASE);
    socketRef.current = sock;

    sock.on("battle:event", (ev) => {
      setEvents((prev) => [ev, ...prev].slice(0, 30));
      if (ev?.score) setScore(ev.score);
      if (ev?.categoryBreakdown) setCatBreakdown(ev.categoryBreakdown);
      fetchPrivMetrics();
      setLatestPopup(ev);
      setTimeout(() => {
        setLatestPopup((current) => current?.id === ev.id ? null : current);
      }, 5000);
    });

    sock.on("red:request", (req) => {
      setTicker((prev) => [req, ...prev].slice(0, 5));
    });

    return () => sock.disconnect();
  }, [hydrate, fetchPrivMetrics]);

  const setSpeed = async (ms) => {
    try {
      const res = await fetch(`${AGENT_BASE}/agent/speed`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intervalMs: ms }),
      });
      const state = await res.json();
      setIntervalMs(state.intervalMs || ms);
      setRunning(!!state.running);
      if (state.score) setScore(state.score);
      setSpeedFlash(true);
      setTimeout(() => setSpeedFlash(false), 1200);
    } catch (err) {
      setError("Failed to update speed");
    }
  };

  const toggleRunning = async () => {
    const endpoint = running ? "stop" : "start";
    try {
      const res = await fetch(`${AGENT_BASE}/agent/${endpoint}`, { method: "POST" });
      const state = await res.json();
      setRunning(!!state.running);
      if (state.intervalMs) setIntervalMs(state.intervalMs);
      if (state.score) setScore(state.score);
    } catch { hydrate(); }
  };

  const toggleExpand = (id) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  // Category chart data
  const catEntries = Object.entries(catBreakdown);
  const maxFired = Math.max(1, ...catEntries.map(([, v]) => v.fired));

  if (loading) {
    return (
      <div className="page">
        <div className="page-header">
          <div className="page-title">⚔️ AUTO <span>BATTLE</span></div>
          <div className="page-subtitle">LOADING BATTLE DATA...</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
          {[1,2,3,4].map(i => (
            <div key={i} className="stat-card" style={{ minHeight: 80 }}>
              <div style={{ background: "var(--bg-3)", height: 28, width: "60%", borderRadius: 6, marginBottom: 8, animation: "battlePulse 1.4s ease-in-out infinite" }} />
              <div style={{ background: "var(--bg-3)", height: 12, width: "80%", borderRadius: 4, animation: "battlePulse 1.4s ease-in-out infinite" }} />
            </div>
          ))}
        </div>
        <style>{`@keyframes battlePulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }`}</style>
      </div>
    );
  }

  return (
    <div className="page">
      {/* Game-like Popup Overlay */}
      {latestPopup && (
        <div key={latestPopup.id} style={{
          position: "fixed",
          top: 40,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 9999,
          background: "rgba(20, 20, 24, 0.95)",
          border: `2px solid ${categoryColor(latestPopup.category)}`,
          boxShadow: `0 0 30px ${categoryColor(latestPopup.category)}40`,
          borderRadius: 12,
          padding: "16px 24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          animation: "popupAnim 5s ease forwards",
          pointerEvents: "none"
        }}>
          <div style={{ fontFamily: "var(--display)", fontSize: 24, fontWeight: 800, color: "var(--text)", textTransform: "uppercase", letterSpacing: 1 }}>
            ⚔️ {latestPopup.name}
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <span style={{ color: latestPopup.red?.success ? "var(--red)" : "var(--green)", fontWeight: 700, fontSize: 14 }}>
              RED: {latestPopup.red?.status || "FAILED"}
            </span>
            <span style={{ color: "var(--text-faint)" }}>VS</span>
            <span style={{ color: latestPopup.blue?.success ? "var(--red)" : "var(--green)", fontWeight: 700, fontSize: 14 }}>
              BLUE: {latestPopup.blue?.status || "BLOCKED"}
            </span>
          </div>
          <div style={{ fontFamily: "var(--sans)", fontSize: 13, color: "var(--text-dim)", maxWidth: 450, textAlign: "center", marginTop: 4 }}>
            {latestPopup.narration?.summary || ""}
          </div>
        </div>
      )}

      {/* Request Ticker */}
      {ticker.length > 0 && (
        <div style={{ background: "rgba(255,34,68,0.04)", border: "1px solid rgba(255,34,68,0.12)", borderRadius: 8, padding: "6px 14px", marginBottom: 14, overflow: "hidden" }}>
          <div style={{ display: "flex", gap: 16, fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-faint)", overflowX: "auto", whiteSpace: "nowrap" }}>
            <span style={{ color: "var(--red)", fontWeight: 700, flexShrink: 0 }}>LIVE</span>
            {ticker.map((t, i) => (
              <span key={i} style={{ opacity: 1 - i * 0.15, flexShrink: 0 }}>
                <span style={{ color: "var(--red)" }}>{t.method}</span> {t.path} <span style={{ color: "var(--text-faint)", fontSize: 9 }}>{formatTime(t.ts)}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div className="page-title">⚔️ AUTO <span>BATTLE</span></div>
            <div className="page-subtitle">AGENT ALICE — RED API VS BLUE API</div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span className="badge" style={{ background: "var(--red-faint)", border: "1px solid var(--border)", color: "var(--red)", fontSize: 10 }}>
              AGENT USER: ALICE
            </span>
            <select className="form-select" value={intervalMs} onChange={(e) => setSpeed(Number(e.target.value))} style={{ fontSize: 11, padding: "6px 10px" }}>
              <option value={120000}>2 min</option>
              <option value={60000}>1 min</option>
              <option value={30000}>30 sec</option>
              <option value={10000}>10 sec</option>
            </select>
            {speedFlash && <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--green)", animation: "fadeOut 1.2s ease forwards" }}>✓ Updated</span>}
            <button className={running ? "btn btn-outline" : "btn btn-red"} onClick={toggleRunning} style={{ fontSize: 11 }}>
              {running ? "⏸ STOP AGENT" : "▶ START AGENT"}
            </button>
          </div>
        </div>
      </div>

      {error && <div style={{ background: "rgba(255,34,68,0.08)", border: "1px solid rgba(255,34,68,0.2)", borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontFamily: "var(--mono)", fontSize: 11, color: "var(--red)" }}>⚠ {error}</div>}

      {/* Score Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(140px, 1fr))", gap: 16, marginBottom: 24 }}>
        <div className="stat-card"><div className="stat-value" style={{ color: "var(--text)" }}>{totalAttacks}</div><div className="stat-label">AGENT RUNS</div></div>
        <div className="stat-card"><div className="stat-value" style={{ color: "var(--red)" }}>{exploitsSucceeded}</div><div className="stat-label">RED API ALLOWED</div></div>
        <div className="stat-card"><div className="stat-value" style={{ color: "var(--green)" }}>{attacksBlocked}</div><div className="stat-label">BLUE API BLOCKED</div></div>
        <div className="stat-card"><div className="stat-value" style={{ color: blockRateColor(blueBlockRate), fontSize: 32 }}>{blueBlockRate}%</div><div className="stat-label">BLUE BLOCK RATE</div></div>
      </div>

      {/* PrivPath Research Metrics */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">
          PRIVPATH METRICS
          <span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-faint)", fontWeight: 400 }}>
            ASR / BR / APR / TTD
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(120px, 1fr))", gap: 12, marginBottom: 16 }}>
          <div className="stat-card" style={{ padding: 14 }}>
            <div className="stat-value" style={{ color: "var(--red)", fontSize: 28 }}>{privMetrics?.metrics?.attackSuccessRatePct ?? 0}%</div>
            <div className="stat-label">ATTACK SUCCESS RATE</div>
          </div>
          <div className="stat-card" style={{ padding: 14 }}>
            <div className="stat-value" style={{ color: "var(--green)", fontSize: 28 }}>{privMetrics?.metrics?.blockRatePct ?? 0}%</div>
            <div className="stat-label">BLOCK RATE</div>
          </div>
          <div className="stat-card" style={{ padding: 14 }}>
            <div className="stat-value" style={{ color: "var(--amber)", fontSize: 28 }}>{privMetrics?.metrics?.attackPathReductionPct ?? 0}%</div>
            <div className="stat-label">ATTACK-PATH REDUCTION</div>
          </div>
          <div className="stat-card" style={{ padding: 14 }}>
            <div className="stat-value" style={{ color: "var(--text)", fontSize: 28 }}>{privMetrics?.metrics?.avgTtdMs ?? 0}<span style={{ fontSize: 12 }}>ms</span></div>
            <div className="stat-label">AVG TIME TO DETECT</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16 }}>
          <div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-faint)", letterSpacing: 1.5, marginBottom: 8 }}>
              DEFENSE CONTROL EFFECTIVENESS
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              {Object.entries(privMetrics?.byControl || {}).slice(0, 6).map(([control, data]) => (
                <div key={control} style={{ display: "grid", gridTemplateColumns: "1fr 64px 64px 64px", gap: 8, alignItems: "center", fontFamily: "var(--mono)", fontSize: 10, padding: "7px 10px", background: "var(--bg-3)", border: "1px solid var(--border-dim)", borderRadius: 6 }}>
                  <span style={{ color: "var(--text)", textTransform: "uppercase" }}>{control.replaceAll("_", " ")}</span>
                  <span style={{ color: "var(--red)" }}>ASR {data.attackSuccessRatePct}%</span>
                  <span style={{ color: "var(--green)" }}>BR {data.blockRatePct}%</span>
                  <span style={{ color: "var(--amber)" }}>APR {data.attackPathReductionPct}%</span>
                </div>
              ))}
              {Object.keys(privMetrics?.byControl || {}).length === 0 && (
                <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-faint)", padding: 12, background: "var(--bg-3)", borderRadius: 6 }}>
                  Run or fire scenarios to populate reproducible PrivPath metrics.
                </div>
              )}
            </div>
          </div>

          <div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-faint)", letterSpacing: 1.5, marginBottom: 8 }}>
              ADAPTIVE ATTACK DISTRIBUTION
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              {Object.entries(privMetrics?.attackDistribution || {}).slice(0, 6).map(([scenario, count]) => (
                <div key={scenario} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontFamily: "var(--mono)", fontSize: 10, padding: "7px 10px", background: "var(--bg-3)", border: "1px solid var(--border-dim)", borderRadius: 6 }}>
                  <span style={{ color: "var(--text)", textTransform: "uppercase" }}>{scenario.replaceAll("_", " ")}</span>
                  <span style={{ color: "var(--red)" }}>{count}</span>
                </div>
              ))}
              {Object.keys(privMetrics?.attackDistribution || {}).length === 0 && (
                <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-faint)", padding: 12, background: "var(--bg-3)", borderRadius: 6 }}>
                  No agent distribution yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Attacker vs Defender Bar */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">ATTACKER VS DEFENDER</div>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-faint)", marginBottom: 10 }}>
          <span>🔴 ATTACKER {attackerPct}%</span><span>🔵 DEFENDER {defenderPct}%</span>
        </div>
        <div style={{ height: 10, borderRadius: 6, overflow: "hidden", background: "var(--bg-3)", border: "1px solid var(--border-dim)" }}>
          <div style={{ display: "flex", height: "100%" }}>
            <div style={{ width: `${attackerPct}%`, background: "var(--red)", transition: "width 0.5s ease" }} />
            <div style={{ width: `${defenderPct}%`, background: "var(--green)", transition: "width 0.5s ease" }} />
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      {catEntries.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">CATEGORY BREAKDOWN</div>
          <div style={{ display: "grid", gap: 10 }}>
            {catEntries.map(([cat, data]) => (
              <div key={cat}>
                <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-faint)", marginBottom: 4 }}>
                  <span style={{ color: categoryColor(cat), fontWeight: 600 }}>{cat.toUpperCase()}</span>
                  <span>{data.fired} fired · {data.redSucceeded} exploited · {data.blueBlocked} blocked</span>
                </div>
                <div style={{ display: "flex", gap: 4, height: 8 }}>
                  <div style={{ width: `${(data.redSucceeded / maxFired) * 100}%`, background: "var(--red)", borderRadius: 3, transition: "width 0.4s ease", minWidth: data.redSucceeded > 0 ? 4 : 0 }} title={`Red: ${data.redSucceeded}`} />
                  <div style={{ width: `${(data.blueBlocked / maxFired) * 100}%`, background: "var(--green)", borderRadius: 3, transition: "width 0.4s ease", minWidth: data.blueBlocked > 0 ? 4 : 0 }} title={`Blue: ${data.blueBlocked}`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Event Feed */}
      <div className="card">
        <div className="card-title">
          LIVE EVENT FEED
          <span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-faint)", fontWeight: 400 }}>{events.length} SHOWN</span>
        </div>

        {events.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "var(--red)", animation: "battlePulse 1.4s ease-in-out infinite", marginRight: 8 }} />
            <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--text-faint)" }}>
              {running ? "AGENT ALICE IS RUNNING" : "AGENT STOPPED"}
            </span>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {events.map((ev) => (
              <div key={ev.id} style={{ background: "var(--bg-3)", border: "1px solid var(--border-dim)", borderRadius: 10, padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ fontFamily: "var(--display)", fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{ev.name}</div>
                    <span className="badge" style={{ background: `${categoryColor(ev.category)}15`, border: `1px solid ${categoryColor(ev.category)}40`, color: categoryColor(ev.category), fontSize: 10 }}>
                      {String(ev.category || "OTHER").toUpperCase()}
                    </span>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-faint)" }}>{formatTime(ev.ts)}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span className="badge" style={{ background: ev.red?.success ? "var(--red-faint)" : "rgba(0,255,136,0.06)", border: `1px solid ${ev.red?.success ? "var(--border)" : "rgba(0,255,136,0.2)"}`, color: ev.red?.success ? "var(--red)" : "var(--green)" }}>
                      RED {ev.red?.status ?? "—"}
                    </span>
                    <span className="badge" style={{ background: ev.blue?.success ? "var(--red-faint)" : "rgba(0,255,136,0.06)", border: `1px solid ${ev.blue?.success ? "var(--border)" : "rgba(0,255,136,0.2)"}`, color: ev.blue?.success ? "var(--red)" : "var(--green)" }}>
                      BLUE {ev.blue?.status ?? "—"}
                    </span>
                  </div>
                </div>

                {/* Chained Steps */}
                {ev.steps && ev.steps.length > 1 && (
                  <div style={{ marginBottom: 10 }}>
                    <button onClick={() => toggleExpand(ev.id)} style={{ background: "none", border: "1px solid var(--border-dim)", color: "var(--text-faint)", fontFamily: "var(--mono)", fontSize: 10, padding: "3px 10px", borderRadius: 4, cursor: "pointer" }}>
                      {expanded[ev.id] ? "▾" : "▸"} {ev.steps.length} STEPS
                    </button>
                    {expanded[ev.id] && (
                      <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                        {ev.steps.map((step, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--mono)", fontSize: 10, padding: "6px 10px", background: "var(--bg-2)", borderRadius: 6, border: "1px solid var(--border-dim)" }}>
                            <span style={{ color: "var(--text-faint)", minWidth: 16 }}>#{i+1}</span>
                            <span style={{ color: "var(--amber)", fontWeight: 600 }}>{step.method}</span>
                            <span style={{ color: "var(--text)" }}>{step.url}</span>
                            <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                              <span style={{ color: step.red?.success ? "var(--red)" : "var(--green)" }}>R:{step.red?.status}</span>
                              <span style={{ color: step.blue?.success ? "var(--red)" : "var(--green)" }}>B:{step.blue?.status}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Narration */}
                {ev.narration && typeof ev.narration === "object" ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    <div style={{ fontFamily: "var(--sans)", fontSize: 13, color: "var(--text-dim)", lineHeight: 1.6 }}>{ev.narration.summary}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div style={{ background: "rgba(255,34,68,0.04)", border: "1px solid rgba(255,34,68,0.1)", borderRadius: 6, padding: "8px 10px" }}>
                        <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--red)", marginBottom: 4, fontWeight: 700 }}>RED EXPLOITED</div>
                        <div style={{ fontFamily: "var(--sans)", fontSize: 11, color: "var(--text-dim)", lineHeight: 1.5 }}>{ev.narration.redExplanation}</div>
                      </div>
                      <div style={{ background: "rgba(0,255,136,0.03)", border: "1px solid rgba(0,255,136,0.1)", borderRadius: 6, padding: "8px 10px" }}>
                        <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--green)", marginBottom: 4, fontWeight: 700 }}>BLUE BLOCKED</div>
                        <div style={{ fontFamily: "var(--sans)", fontSize: 11, color: "var(--text-dim)", lineHeight: 1.5 }}>{ev.narration.blueExplanation}</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontFamily: "var(--sans)", fontSize: 13, color: "var(--text-dim)", lineHeight: 1.6 }}>{typeof ev.narration === "string" ? ev.narration : ""}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes battlePulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
        @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes popupAnim {
          0% { top: -100px; opacity: 0; transform: translate(-50%, -20px) scale(0.9); }
          10% { top: 40px; opacity: 1; transform: translate(-50%, 0) scale(1.05); }
          15% { transform: translate(-50%, 0) scale(1); }
          85% { top: 40px; opacity: 1; transform: translate(-50%, 0) scale(1); }
          100% { top: -100px; opacity: 0; transform: translate(-50%, -20px) scale(0.9); }
        }
      `}</style>
    </div>
  );
}
