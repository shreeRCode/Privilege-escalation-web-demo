const express = require("express");

function createAgentRouter(agent) {
  const router = express.Router();

  router.get("/state", (req, res) => {
    res.json(agent.getState());
  });

  router.post("/start", (req, res) => {
    agent.start();
    res.json(agent.getState());
  });

  router.post("/stop", (req, res) => {
    agent.stop();
    res.json(agent.getState());
  });

  router.post("/speed", (req, res) => {
    try {
      const { intervalMs } = req.body || {};
      agent.setIntervalMs(intervalMs);
      res.json(agent.getState());
    } catch (err) {
      res.status(400).json({ error: err.message || "Invalid interval" });
    }
  });

  router.post("/fire", async (req, res) => {
    try {
      const { scenarioId } = req.body;
      if (!scenarioId) return res.status(400).json({ error: "Missing scenarioId" });
      const event = await agent.fireScenarioId(scenarioId);
      if (event && event.error) return res.status(400).json({ error: event.error });
      res.json({ success: true, event });
    } catch (err) {
      res.status(500).json({ error: err.message || "Failed to fire scenario" });
    }
  });

  // GET /agent/history?limit=100&category=IDOR — real SQL filtering
  router.get("/history", async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 100, 500);
      const category = req.query.category || null;
      const events = await agent.getHistory(limit, category);
      res.json({ events, total: events.length });
    } catch (err) {
      res.status(500).json({ error: err.message || "Failed to fetch history" });
    }
  });

  // GET /agent/stats — aggregated stats from real DB queries
  router.get("/stats", async (req, res) => {
    try {
      const stats = await agent.getStats();
      res.json(stats);
    } catch (err) {
      res.status(500).json({ error: err.message || "Failed to fetch stats" });
    }
  });

  return router;
}

module.exports = { createAgentRouter };
