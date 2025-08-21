// server.js
import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";
import http from "http";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";

// routes
import authRoutes from "./routes/auth.js";
import usersRoutes from "./routes/users.js";
import conversationsRoutes from "./routes/conversations.js";

// models
import { User } from "./models/User.js";
import { Conversation } from "./models/Conversation.js";
import { Message } from "./models/Message.js";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// REST routes
app.get("/", (_, res) => res.send({ ok: true, message: "Server running" }));
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", usersRoutes);
app.use("/api/v1/conversations", conversationsRoutes);

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

const server = http.createServer(app);

// --- Socket.IO ---
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
});

// --- Socket auth middleware ---
io.use((socket, next) => {
    try {
        const token = socket.handshake.auth?.token || socket.handshake.query?.token;
        if (!token) return next(new Error("Unauthorized: no token"));

        const payload = jwt.verify(token, process.env.JWT_SECRET);
        socket.user = { id: payload.userId, email: payload.email };
        return next();
    } catch (err) {
        return next(new Error("Unauthorized: invalid token"));
    }
});

// Track multiple sockets per user
const userSockets = new Map(); // userId -> Set(socketId)

io.on("connection", async (socket) => {
    const userId = socket.user.id;

    // track sockets
    if (!userSockets.has(userId)) userSockets.set(userId, new Set());
    userSockets.get(userId).add(socket.id);
    socket.join(userId);

    // mark online
    try {
        await User.findByIdAndUpdate(userId, { online: true, lastSeen: new Date() });
        io.emit("presence:online", { userId });
    } catch (e) {
        console.error("presence online error:", e);
    }

    // ---- message:send ----
    socket.on("message:send", async ({ to, text }) => {
        try {
            if (!to || !text) return;
            const from = userId;

            let convo = await Conversation.findOne({
                participants: { $all: [from, to] },
            });
            if (!convo) {
                convo = await Conversation.create({
                    participants: [from, to],
                    lastMessage: "",
                    lastMessageAt: new Date(),
                });
            }

            const msg = await Message.create({
                conversation: convo._id,
                from,
                to,
                text,
                read: false,
            });

            convo.lastMessage = text;
            convo.lastMessageAt = msg.createdAt;
            await convo.save();

            const msgObj = {
                _id: msg._id,
                conversation: String(convo._id),
                from: String(from),
                to: String(to),
                text: msg.text,
                read: msg.read,
                createdAt: msg.createdAt,
            };

            io.to(String(to)).emit("message:new", msgObj);
            io.to(String(from)).emit("message:new", msgObj);
            socket.emit("message:sent", { _id: msg._id });
        } catch (err) {
            console.error("message:send error:", err);
            socket.emit("error", { event: "message:send", error: "Server error" });
        }
    });

    // ---- typing events ----
    socket.on("typing:start", ({ to, conversationId }) => {
        if (!to) return;
        io.to(String(to)).emit("typing:start", {
            from: userId,
            conversationId: conversationId || null,
        });
    });

    socket.on("typing:stop", ({ to, conversationId }) => {
        if (!to) return;
        io.to(String(to)).emit("typing:stop", {
            from: userId,
            conversationId: conversationId || null,
        });
    });

    // ---- message:read ----
    socket.on("message:read", async ({ conversationId }) => {
        try {
            if (!conversationId) return;
            await Message.updateMany(
                { conversation: conversationId, to: userId, read: false },
                { $set: { read: true } }
            );

            const convo = await Conversation.findById(conversationId);
            if (!convo) return;
            const other = convo.participants.find(
                (p) => String(p) !== String(userId)
            );
            if (other) {
                io.to(String(other)).emit("message:read", {
                    conversationId,
                    reader: userId,
                });
            }
        } catch (err) {
            console.error("message:read error:", err);
        }
    });

    // ---- disconnect ----
    socket.on("disconnect", async () => {
        try {
            const set = userSockets.get(userId);
            if (set) {
                set.delete(socket.id);
                if (set.size === 0) userSockets.delete(userId);
            }

            if (!userSockets.has(userId)) {
                await User.findByIdAndUpdate(userId, {
                    online: false,
                    lastSeen: new Date(),
                });
                io.emit("presence:offline", { userId, lastSeen: new Date() });
            }
        } catch (e) {
            console.error("presence offline error:", e);
        }
    });
});

// --- Start server ---
async function start() {
    try {
        if (!MONGO_URI) throw new Error("MONGO_URI not set in .env");
        await mongoose.connect(MONGO_URI);
        console.log("✅ Connected to MongoDB");
        server.listen(PORT, () =>
            console.log(`🚀 Server + Socket.IO running on http://localhost:${PORT}`)
        );
    } catch (err) {
        console.error("❌ Failed to start server:", err);
        process.exit(1);
    }
}

start();
