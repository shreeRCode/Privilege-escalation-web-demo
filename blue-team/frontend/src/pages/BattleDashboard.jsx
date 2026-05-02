import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";

const AGENT_BASE = "http://localhost:4000";
const BLUE_BASE = "http://localhost:5000";

function formatTime(ts) {
  try { return new Date(ts).toLocaleTimeString(); } catch { return String(ts); }
}

function categoryColor(cat) {
  const c = String(cat || "").toLowerCase();
  if (c.includes("idor")) return "#2266ff";
  if (c.includes("jwt")) return "#00ccff";
  if (c.includes("mass")) return "#8866ff";
  if (c.includes("chain")) return "#00bbdd";
  if (c.includes("access")) return "#00aaff";
  if (c.includes("exposure") || c.includes("data")) return "#44ddaa";
  return "#888";
}

export default function BattleDashboard() {
  const [events, setEvents] = useState([]);
  const [score, setScore] = useState(null);
  const [running, setRunning] = useState(false);
  const [intervalMs, setIntervalMs] = useState(10000);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [blocked, setBlocked] = useState([]);
  const [defenseStats, setDefenseStats] = useState(null);
  const [sparkline, setSparkline] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [speedFlash, setSpeedFlash] = useState(false);
  const [latestPopup, setLatestPopup] = useState(null);
  const agentSocket = useRef(null);
  const blueSocket = useRef(null);

  const totalAttacks = score?.total || 0;
  const attacksBlocked = score?.defender || 0;
  const exploitsSucceeded = score?.attacker || 0;
  const blockRate = totalAttacks > 0 ? Math.round((attacksBlocked / totalAttacks) * 100) : 0;

  const avgLatency = useMemo(() => {
    const latencies = blocked.filter(b => b.latencyMs).map(b => b.latencyMs);
    if (latencies.length === 0) return 0;
    return Math.round(latencies.reduce((s, l) => s + l, 0) / latencies.length);
  }, [blocked]);

  const { attackerPct, defenderPct } = useMemo(() => {
    const denom = (score?.attacker || 0) + (score?.defender || 0);
    if (denom <= 0) return { attackerPct: 50, defenderPct: 50 };
    return {
      attackerPct: Math.round(((score.attacker || 0) / denom) * 100),
      defenderPct: Math.round(((score.defender || 0) / denom) * 100),
    };
  }, [score]);

  const hydrate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [agentRes, defRes] = await Promise.all([
        fetch(`${AGENT_BASE}/agent/state`),
        fetch(`${BLUE_BASE}/defense/stats`),
      ]);
      const agentState = await agentRes.json();
      const defStats = await defRes.json();
      setScore(agentState.score || { attacker: 0, defender: 0, total: 0 });
      setEvents((agentState.history || []).slice(0, 30));
      setRunning(!!agentState.running);
      setIntervalMs(agentState.intervalMs || 10000);
      setDefenseStats(defStats);
      if (defStats.timeSeries) setSparkline(defStats.timeSeries);
    } catch (err) {
      setError("Failed to connect to servers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    hydrate();

    // Socket 1: Agent (battle:event)
    const sock1 = io(AGENT_BASE);
    agentSocket.current = sock1;
    sock1.on("battle:event", (ev) => {
      setEvents((prev) => [ev, ...prev].slice(0, 30));
      if (ev?.score) setScore(ev.score);
      setLatestPopup(ev);
      setTimeout(() => {
        setLatestPopup((current) => current?.id === ev.id ? null : current);
      }, 5000);
    });

    // Socket 2: Blue backend (blue:blocked)
    const sock2 = io(BLUE_BASE);
    blueSocket.current = sock2;
    sock2.on("blue:blocked", (ev) => {
      setBlocked((prev) => [ev, ...prev].slice(0, 20));
      setSparkline((prev) => {
        const now = new Date().toISOString().slice(0, 16) + ":00";
        const last = prev[prev.length - 1];
        if (last && last.minute === now) {
          return [...prev.slice(0, -1), { minute: now, count: last.count + 1 }];
        }
        return [...prev, { minute: now, count: 1 }].slice(-30);
      });
    });

    return () => {
      sock1.disconnect();
      sock2.disconnect();
    };
  }, [hydrate]);

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
    } catch { setError("Failed to update speed"); }
  };

  const toggleRunning = async () => {
    const endpoint = running ? "stop" : "start";
    try {
      const res = await fetch(`${AGENT_BASE}/agent/${endpoint}`, { method: "POST" });
      const state = await res.json();
      setRunning(!!state.running);
      if (state.score) setScore(state.score);
    } catch { hydrate(); }
  };

  const toggleExpand = (id) => setExpanded((p) => ({ ...p, [id]: !p[id] }));
  const maxSparkCount = Math.max(1, ...sparkline.map(s => s.count));

  if (loading) {
    return (
      <div className="page">
        <div className="page-header">
          <div className="page-title">🛡️ DEFENSE <span>MONITOR</span></div>
          <div className="page-subtitle">LOADING DEFENSE DATA...</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
          {[1,2,3,4].map(i => (
            <div key={i} className="stat-card" style={{ minHeight: 80 }}>
              <div style={{ background: "var(--bg-3)", height: 28, width: "60%", borderRadius: 6, marginBottom: 8, animation: "bluePulse 1.4s ease-in-out infinite" }} />
              <div style={{ background: "var(--bg-3)", height: 12, width: "80%", borderRadius: 4, animation: "bluePulse 1.4s ease-in-out infinite" }} />
            </div>
          ))}
        </div>
        <style>{`@keyframes bluePulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }`}</style>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div className="page-title">🛡️ DEFENSE <span>MONITOR</span></div>
            <div className="page-subtitle">DUAL-SOURCE INTELLIGENCE — BATTLE + DEFENSE FEEDS</div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <select className="form-select" value={intervalMs} onChange={(e) => setSpeed(Number(e.target.value))} style={{ fontSize: 11, padding: "6px 10px" }}>
              <option value={120000}>2 min</option>
              <option value={60000}>1 min</option>
              <option value={30000}>30 sec</option>
              <option value={10000}>10 sec</option>
            </select>
            {speedFlash && <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--green)", animation: "fadeOut 1.2s ease forwards" }}>✓ Updated</span>}
            <button className={running ? "btn btn-outline" : "btn btn-blue"} onClick={toggleRunning} style={{ fontSize: 11 }}>
              {running ? "⏸ PAUSE" : "▶ RESUME"}
            </button>
          </div>
        </div>
      </div>

      {error && <div style={{ background: "rgba(34,102,255,0.08)", border: "1px solid rgba(34,102,255,0.2)", borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontFamily: "var(--mono)", fontSize: 11, color: "var(--blue)" }}>⚠ {error}</div>}

      {/* Game-like Popup Overlay */}
      {latestPopup && (
        <div key={latestPopup.id} style={{
          position: "fixed",
          top: 40,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 9999,
          background: "rgba(16, 24, 32, 0.95)",
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
            🛡️ {latestPopup.name}
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <span style={{ color: latestPopup.blue?.success ? "var(--amber)" : "var(--green)", fontWeight: 700, fontSize: 14 }}>
              BLUE: {latestPopup.blue?.status || "BLOCKED"}
            </span>
            <span style={{ color: "var(--text-faint)" }}>VS</span>
            <span style={{ color: latestPopup.red?.success ? "var(--amber)" : "var(--green)", fontWeight: 700, fontSize: 14 }}>
              RED: {latestPopup.red?.status || "FAILED"}
            </span>
          </div>
          <div style={{ fontFamily: "var(--sans)", fontSize: 13, color: "var(--text-dim)", maxWidth: 450, textAlign: "center", marginTop: 4 }}>
            {latestPopup.narration?.summary || ""}
          </div>
        </div>
      )}

      {/* Score Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(140px, 1fr))", gap: 16, marginBottom: 24 }}>
        <div className="stat-card"><div className="stat-value" style={{ color: "var(--green)" }}>{attacksBlocked}</div><div className="stat-label">ATTACKS INTERCEPTED</div></div>
        <div className="stat-card"><div className="stat-value" style={{ color: "var(--cyan)" }}>{defenseStats?.totalBlocked || attacksBlocked}</div><div className="stat-label">THREATS NEUTRALIZED</div></div>
        <div className="stat-card"><div className="stat-value" style={{ color: blockRate >= 70 ? "var(--green)" : "var(--amber)", fontSize: 32 }}>{blockRate}%</div><div className="stat-label">BLOCK RATE</div></div>
        <div className="stat-card"><div className="stat-value" style={{ color: "var(--text)" }}>{avgLatency || "—"}<span style={{ fontSize: 14 }}>ms</span></div><div className="stat-label">AVG BLOCK LATENCY</div></div>
      </div>

      {/* Defense Posture Bar */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">DEFENSE POSTURE</div>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-faint)", marginBottom: 10 }}>
          <span>🔴 ATTACKER {attackerPct}%</span><span>🔵 DEFENDER {defenderPct}%</span>
        </div>
        <div style={{ height: 10, borderRadius: 6, overflow: "hidden", background: "var(--bg-3)", border: "1px solid var(--border-dim)" }}>
          <div style={{ display: "flex", height: "100%" }}>
            <div style={{ width: `${attackerPct}%`, background: "var(--amber)", transition: "width 0.5s ease" }} />
            <div style={{ width: `${defenderPct}%`, background: "var(--green)", transition: "width 0.5s ease" }} />
          </div>
        </div>
      </div>

      {/* Two-column layout: Blocked feed + Sparkline */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* Live Blocked Feed */}
        <div className="card">
          <div className="card-title">LIVE BLOCKED REQUESTS <span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-faint)", fontWeight: 400 }}>FROM BLUE BACKEND</span></div>
          {blocked.length === 0 ? (
            <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-faint)", padding: 16, textAlign: "center" }}>Waiting for blocked requests...</div>
          ) : (
            <div style={{ display: "grid", gap: 6, maxHeight: 260, overflow: "auto" }}>
              {blocked.slice(0, 10).map((b, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "var(--bg-2)", borderRadius: 6, border: "1px solid var(--border-dim)", fontFamily: "var(--mono)", fontSize: 10 }}>
                  <span style={{ color: "var(--green)", fontWeight: 700 }}>🛡️</span>
                  <span style={{ color: "var(--text)" }}>{b.endpoint}</span>
                  <span style={{ color: "var(--text-faint)", marginLeft: "auto", fontSize: 9 }}>{formatTime(b.ts)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sparkline */}
        <div className="card">
          <div className="card-title">BLOCKS PER MINUTE <span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-faint)", fontWeight: 400 }}>LAST 30 MIN</span></div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 100, padding: "10px 0" }}>
            {sparkline.length === 0 ? (
              <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-faint)", margin: "auto" }}>No data yet</div>
            ) : sparkline.map((s, i) => (
              <div key={i} style={{
                flex: 1, minWidth: 4, maxWidth: 16,
                height: `${Math.max(4, (s.count / maxSparkCount) * 100)}%`,
                background: `linear-gradient(to top, rgba(0,255,136,0.3), rgba(0,255,136,0.7))`,
                borderRadius: "2px 2px 0 0",
                transition: "height 0.3s ease",
              }} title={`${s.minute}: ${s.count} blocks`} />
            ))}
          </div>
        </div>
      </div>

      {/* Threat Intelligence Feed */}
      <div className="card">
        <div className="card-title">
          THREAT INTELLIGENCE FEED
          <span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-faint)", fontWeight: 400 }}>{events.length} SHOWN</span>
        </div>

        {events.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "var(--blue)", animation: "bluePulse 1.4s ease-in-out infinite", marginRight: 8 }} />
            <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--text-faint)" }}>{running ? "Monitoring..." : "AGENT PAUSED"}</span>
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
                  <div style={{ display: "flex", gap: 8 }}>
                    <span className="badge" style={{ background: ev.blue?.success ? "rgba(255,170,0,0.06)" : "rgba(0,255,136,0.06)", border: `1px solid ${ev.blue?.success ? "rgba(255,170,0,0.25)" : "rgba(0,255,136,0.2)"}`, color: ev.blue?.success ? "var(--amber)" : "var(--green)" }}>
                      BLUE {ev.blue?.status ?? "—"}
                    </span>
                    <span className="badge" style={{ background: ev.red?.success ? "rgba(255,170,0,0.06)" : "rgba(0,255,136,0.06)", border: `1px solid ${ev.red?.success ? "rgba(255,170,0,0.25)" : "rgba(0,255,136,0.2)"}`, color: ev.red?.success ? "var(--amber)" : "var(--green)" }}>
                      RED {ev.red?.status ?? "—"}
                    </span>
                  </div>
                </div>
                {/* Chained steps */}
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
                            <span style={{ color: "var(--cyan)", fontWeight: 600 }}>{step.method}</span>
                            <span style={{ color: "var(--text)" }}>{step.url}</span>
                            <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                              <span style={{ color: step.blue?.success ? "var(--amber)" : "var(--green)" }}>B:{step.blue?.status}</span>
                              <span style={{ color: step.red?.success ? "var(--amber)" : "var(--green)" }}>R:{step.red?.status}</span>
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
                      <div style={{ background: "rgba(0,255,136,0.03)", border: "1px solid rgba(0,255,136,0.1)", borderRadius: 6, padding: "8px 10px" }}>
                        <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--green)", marginBottom: 4, fontWeight: 700 }}>DEFENSE APPLIED</div>
                        <div style={{ fontFamily: "var(--sans)", fontSize: 11, color: "var(--text-dim)", lineHeight: 1.5 }}>{ev.narration.blueExplanation}</div>
                      </div>
                      <div style={{ background: "rgba(255,170,0,0.03)", border: "1px solid rgba(255,170,0,0.1)", borderRadius: 6, padding: "8px 10px" }}>
                        <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--amber)", marginBottom: 4, fontWeight: 700 }}>ATTACKER RESULT</div>
                        <div style={{ fontFamily: "var(--sans)", fontSize: 11, color: "var(--text-dim)", lineHeight: 1.5 }}>{ev.narration.redExplanation}</div>
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
        @keyframes bluePulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
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
