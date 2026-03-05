const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res.send("Welcome to admin panel");
});

module.exports = router;
