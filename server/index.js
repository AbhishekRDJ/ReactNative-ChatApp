// index.js
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

// models (named exports)
import { User } from "./models/User.js";
import { Conversation } from "./models/Conversation.js";
import { Message } from "./models/Message.js";

dotenv.config();

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET;

if (!MONGO_URI) {
    console.error("❌ MONGO_URI not set in .env");
    process.exit(1);
}
if (!JWT_SECRET) {
    console.error("❌ JWT_SECRET not set in .env");
    process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json());

// REST
app.get("/", (_, res) => res.send({ ok: true, message: "Server running" }));
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", usersRoutes);
app.use("/api/v1/conversations", conversationsRoutes);

const server = http.createServer(app);

// Socket.IO
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
});

// socket auth middleware (JWT)
io.use((socket, next) => {
    try {
        const token = socket.handshake.auth?.token || socket.handshake.query?.token;
        if (!token) return next(new Error("Unauthorized: no token"));
        const payload = jwt.verify(token, JWT_SECRET);
        socket.user = { id: payload.userId, email: payload.email };
        return next();
    } catch (err) {
        console.error("socket auth failed:", err.message);
        return next(new Error("Unauthorized: invalid token"));
    }
});

// track sockets per userId
const userSockets = new Map(); // userId -> Set(socketId)

io.on("connection", async (socket) => {
    const userId = socket.user.id;
    console.log("🔌 socket connected:", socket.id, "userId:", userId);

    // track socket
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

    // ---------- message:send (safe find-then-create pattern) ----------
    socket.on("message:send", async (payload) => {
        try {
            console.log("📤 message:send payload:", payload, "fromSocketUser:", userId);

            if (!payload || !payload.to || !payload.text) {
                console.log("⚠️ message:send missing fields:", payload);
                return socket.emit("error", { event: "message:send", error: "Missing fields" });
            }

            const { to: toRaw, text } = payload;
            const fromRaw = userId;

            // cast to ObjectId
            let fromId, toId;
            try {
                fromId = new mongoose.Types.ObjectId(fromRaw);
                toId = new mongoose.Types.ObjectId(toRaw);
            } catch (castErr) {
                console.error("❌ Invalid ObjectId:", { fromRaw, toRaw, err: castErr.message });
                return socket.emit("error", { event: "message:send", error: "Invalid user id format" });
            }

            // 1) try to find existing conversation
            let convo = await Conversation.findOne({ participants: { $all: [fromId, toId] } });

            // 2) if not found, create; protect against duplicate-creation race
            if (!convo) {
                try {
                    convo = await Conversation.create({
                        participants: [fromId, toId],
                        lastMessage: "",
                        lastMessageAt: new Date(),
                    });
                    console.log("✅ conversation created:", convo._id.toString());
                } catch (createErr) {
                    // If duplicate-key or other race occurred, re-find
                    console.warn("⚠️ conversation create error (retrying find):", createErr.message);
                    convo = await Conversation.findOne({ participants: { $all: [fromId, toId] } });
                    if (!convo) {
                        // unexpected: rethrow to be handled by outer catch
                        throw createErr;
                    }
                }
            } else {
                console.log("🔎 conversation found:", convo._id.toString());
            }

            // 3) create message
            const msg = await Message.create({
                conversation: convo._id,
                from: fromId,
                to: toId,
                text,
                read: false,
            });

            console.log("✅ message saved:", { msgId: msg._id.toString(), conversation: convo._id.toString() });

            // 4) update convo last message/time
            convo.lastMessage = text;
            convo.lastMessageAt = msg.createdAt;
            await convo.save();

            const msgObj = {
                _id: msg._id,
                conversation: String(convo._id),
                from: String(fromId),
                to: String(toId),
                text: msg.text,
                read: msg.read,
                createdAt: msg.createdAt,
            };

            // deliver & ack
            io.to(String(toId)).emit("message:new", msgObj);
            io.to(String(fromId)).emit("message:new", msgObj);
            socket.emit("message:sent", { _id: msg._id, conversationId: String(convo._id) });
        } catch (err) {
            console.error("message:send error (catch):", err);
            socket.emit("error", { event: "message:send", error: "Server error" });
        }
    });

    // typing
    socket.on("typing:start", ({ to, conversationId }) => {
        if (!to) return;
        io.to(String(to)).emit("typing:start", { from: userId, conversationId: conversationId || null });
    });
    socket.on("typing:stop", ({ to, conversationId }) => {
        if (!to) return;
        io.to(String(to)).emit("typing:stop", { from: userId, conversationId: conversationId || null });
    });

    // read receipts
    socket.on("message:read", async ({ conversationId }) => {
        try {
            if (!conversationId) return;
            await Message.updateMany({ conversation: conversationId, to: userId, read: false }, { $set: { read: true } });

            const convo = await Conversation.findById(conversationId);
            if (!convo) return;
            const other = convo.participants.find((p) => String(p) !== String(userId));
            if (other) {
                io.to(String(other)).emit("message:read", { conversationId, reader: userId });
            }
        } catch (err) {
            console.error("message:read error:", err);
        }
    });

    // disconnect
    socket.on("disconnect", async () => {
        try {
            console.log("🔌 socket disconnect:", socket.id, "userId:", userId);
            const set = userSockets.get(userId);
            if (set) {
                set.delete(socket.id);
                if (set.size === 0) userSockets.delete(userId);
            }

            if (!userSockets.has(userId)) {
                await User.findByIdAndUpdate(userId, { online: false, lastSeen: new Date() });
                io.emit("presence:offline", { userId, lastSeen: new Date() });
            }
        } catch (e) {
            console.error("presence offline error:", e);
        }
    });
});

// Start server
async function start() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("✅ Connected to MongoDB");
        server.listen(PORT, () => console.log(`🚀 Server + Socket.IO running on http://localhost:${PORT}`));
    } catch (err) {
        console.error("❌ Failed to start server:", err);
        process.exit(1);
    }
}

start();
