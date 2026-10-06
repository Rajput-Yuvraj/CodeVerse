const express = require("express");
const app = express();
const http = require("http");
const { Server } = require("socket.io");
const ACTIONS = require("./Actions");
const cors = require("cors");
const axios = require("axios");
const server = http.createServer(app);
require("dotenv").config();
const { initializeDatabase } = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const workspaceRoutes = require("./routes/workspaceRoutes");
const { cleanupExpiredSessions } = require("./utils/sessionManager");

const languageConfig = {
  python3: { versionIndex: "3" },
  java: { versionIndex: "3" },
  cpp: { versionIndex: "4" },
  c: { versionIndex: "4" }
};

app.use(cors());

app.use(express.json());

app.use('/api/auth', authRoutes);

app.use('/api/workspaces', workspaceRoutes);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

const userSocketMap = {};
const getAllConnectedClients = (roomId) => {
  return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(
    (socketId) => {
      return {
        socketId,
        username: userSocketMap[socketId],
      };
    }
  );
};

io.on("connection", (socket) => {
  socket.on(ACTIONS.JOIN, ({ roomId, username }) => {
    userSocketMap[socket.id] = username;
    socket.join(roomId);
    const clients = getAllConnectedClients(roomId);
    clients.forEach(({ socketId }) => {
      io.to(socketId).emit(ACTIONS.JOINED, {
        clients,
        username,
        socketId: socket.id,
      });
    });
  });

  socket.on(ACTIONS.CODE_CHANGE, ({ roomId, code }) => {
    socket.in(roomId).emit(ACTIONS.CODE_CHANGE, { code });
  });
  socket.on(ACTIONS.SYNC_CODE, ({ socketId, code }) => {
    io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code });
  });

  socket.on("disconnecting", () => {
    const rooms = [...socket.rooms];
    rooms.forEach((roomId) => {
      socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
        socketId: socket.id,
        username: userSocketMap[socket.id],
      });
    });

    delete userSocketMap[socket.id];
    socket.leave();
  });
});

app.post("/compile", async (req, res) => {
  const { code, language } = req.body;

  try {
    const response = await axios.post("https://api.jdoodle.com/v1/execute", {
      script: code,
      language: language,
      versionIndex: languageConfig[language].versionIndex,
      clientId: process.env.jDoodle_clientId,
      clientSecret: process.env.jDoodle_clientSecret,
    });

    res.json(response.data);
  } catch (error) {
    console.error("JDoodle API Error:", error.response?.data || error.message);
    const errorMessage = error.response?.data?.error || error.message || "Failed to compile code";
    res.status(500).json({ 
      error: "Failed to compile code",
      details: errorMessage 
    });
  }
});

const PORT = process.env.PORT || 5000;

initializeDatabase()
  .then(() => {
    server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
    
    setInterval(() => {
      cleanupExpiredSessions();
    }, 60 * 60 * 1000);

    cleanupExpiredSessions();
  })
  .catch((error) => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  });