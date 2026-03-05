const express = require("express");
const router = express.Router();
const users = require("../database/users.json");

router.get("/", (req, res) => {
  const id = parseInt(req.query.id);

  const user = users.find((u) => u.id === id);

  res.json(user);
});

module.exports = router;
