const express = require("express");
const bodyParser = require("body-parser");

const authRoutes = require("./routes/auth");
const profileRoutes = require("./routes/profile");
const adminRoutes = require("./routes/admin");

const app = express();

app.use(bodyParser.json());

app.use("/auth", authRoutes);
app.use("/profile", profileRoutes);
app.use("/admin", adminRoutes);

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
