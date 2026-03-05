const express = require("express");
const router = express.Router();
const users = require("../database/users.json");

let currentUser = null;

router.post("/login", (req, res) => {
  const { username, password } = req.body;

  const user = users.find(
    (u) => u.username === username && u.password === password,
  );

  if (!user) {
    return res.status(401).send("Invalid login");
  }

  currentUser = user;

  res.json(user);
});

module.exports = router;
