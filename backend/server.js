const http = require("http");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const { register, login } = require("./controllers/authController");
const { registerSocketHandlers } = require("./sockets/socket_handler");

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  // Tolerate brief network drops / laggy hosts without instant disconnect
  pingTimeout:  60000,
  pingInterval: 25000,
});

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.post("/api/auth/register", register);
app.post("/api/auth/login", login);

const { BOSS_LIST } = require("./game/bosses");
app.get("/api/bosses", (_req, res) => {
  res.json(BOSS_LIST);
});

registerSocketHandlers(io);

const PORT = process.env.PORT || 5000;

// Start listening immediately so Socket.IO and the game are always available.
// MongoDB is only required for auth routes (/api/auth/*); game logic is stateless.
server.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});

// Connect to MongoDB in the background — auth routes degrade gracefully if unavailable.
(async () => {
  if (!process.env.MONGODB_URI) {
    console.warn("MONGODB_URI not set — auth routes will be unavailable.");
    return;
  }
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");
  } catch (err) {
    console.error("MongoDB connection failed:", err.message);
    // Do NOT exit — game rooms still function without MongoDB.
  }
})();
