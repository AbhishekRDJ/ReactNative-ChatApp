// import express from "express"

// import { auth } from "../middleware/auth.js"
// import { Conversation } from "../models/Conversation.js"
// import { Message } from "../models/Message.js"

// const router = express.Router();

// router.get('/:id/messages', auth, async (req, res) => {
//     try {
//         const { id } = req.params;
//         const convo = await Conversation.findById(id);
//         if (!convo) return res.status(404).json({ error: 'Conversation not found' });
//         const isParticipant = convo.participants.some(p => String(p) === String(req.user.id));
//         if (!isParticipant) return res.status(403).json({ error: 'Not a participant of this conversation' });

//         const messages = await Message
//             .find({ conversation: id })
//             .sort({ createdAt: 1 });

//         res.json({ conversation: convo, messages });
//     } catch (err) {
//         console.error('GET /conversations/:id/messages error:', err);
//         res.status(500).json({ error: 'Server error' });
//     }
// });

// router.get('/with/:userId', auth, async (req, res) => {
//     try {
//         const otherIdRaw = req.params.userId;
//         const myIdRaw = req.user.id;

//         if (!otherIdRaw) return res.status(400).json({ error: 'other user id required' });
//         if (otherIdRaw === myIdRaw) return res.status(400).json({ error: 'cannot create conversation with self' });

//         // cast to ObjectId
//         let myId, otherId;
//         try {
//             myId = new mongoose.Types.ObjectId(myIdRaw);
//             otherId = new mongoose.Types.ObjectId(otherIdRaw);
//         } catch (err) {
//             return res.status(400).json({ error: 'invalid user id format' });
//         }

//         // 1) try find
//         let convo = await Conversation.findOne({ participants: { $all: [myId, otherId] } });

//         // 2) if missing, create and handle race
//         if (!convo) {
//             try {
//                 convo = await Conversation.create({
//                     participants: [myId, otherId],
//                     lastMessage: '',
//                     lastMessageAt: new Date()
//                 });
//             } catch (createErr) {
//                 // if race or duplicate, try to find again
//                 convo = await Conversation.findOne({ participants: { $all: [myId, otherId] } });
//                 if (!convo) throw createErr; // propagate unexpected error
//             }
//         }

//         return res.json({ conversation: convo });
//     } catch (err) {
//         console.error('GET /conversations/with/:userId error:', err);
//         return res.status(500).json({ error: 'Server error' });
//     }
// });


// export default router;

// /server/routes/conversations.js
import express from "express";
import mongoose from "mongoose";
import { auth } from "../middleware/auth.js";
import { Conversation } from "../models/Conversation.js";
import { Message } from "../models/Message.js";

const router = express.Router();

/**
 * GET /api/v1/conversations
 * List conversations for the logged-in user (useful for Home list).
 * Returns conversation docs (with lastMessage fields).
 */
router.get("/", auth, async (req, res) => {
    try {
        const userId = req.user.id;
        // find conversations where the user participates; sort by lastMessageAt desc
        const convos = await Conversation.find({ participants: userId })
            .sort({ lastMessageAt: -1 })
            .lean();
        return res.json({ conversations: convos });
    } catch (err) {
        console.error("GET /conversations error:", err);
        return res.status(500).json({ error: "Server error" });
    }
});

/**
 * GET /api/v1/conversations/:id/messages
 * Fetch messages for a conversation with pagination
 * Query params:
 *   ?limit=50&skip=0  (defaults: limit=50, skip=0)
 */
router.get("/:id/messages", auth, async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: "invalid conversation id" });

        const convo = await Conversation.findById(id);
        if (!convo) return res.status(404).json({ error: "Conversation not found" });

        const isParticipant = convo.participants.some((p) => String(p) === String(req.user.id));
        if (!isParticipant) return res.status(403).json({ error: "Not a participant of this conversation" });

        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        const skip = parseInt(req.query.skip) || 0;

        const messages = await Message.find({ conversation: id })
            .sort({ createdAt: 1 })
            .skip(skip)
            .limit(limit)
            .lean();

        return res.json({ conversation: convo, messages });
    } catch (err) {
        console.error("GET /conversations/:id/messages error:", err);
        return res.status(500).json({ error: "Server error" });
    }
});

/**
 * GET /api/v1/conversations/with/:userId
 * Find-or-create a conversation between the authenticated user and :userId
 */
router.get("/with/:userId", auth, async (req, res) => {
    try {
        const otherIdRaw = req.params.userId;
        const myIdRaw = req.user.id;

        if (!otherIdRaw) return res.status(400).json({ error: "other user id required" });
        if (otherIdRaw === myIdRaw) return res.status(400).json({ error: "cannot create conversation with self" });

        if (!mongoose.Types.ObjectId.isValid(otherIdRaw) || !mongoose.Types.ObjectId.isValid(myIdRaw)) {
            return res.status(400).json({ error: "invalid user id format" });
        }

        const myId = new mongoose.Types.ObjectId(myIdRaw);
        const otherId = new mongoose.Types.ObjectId(otherIdRaw);

        // 1) try find
        let convo = await Conversation.findOne({ participants: { $all: [myId, otherId] } });

        // 2) if missing, create; protect against duplicate-creation race
        if (!convo) {
            try {
                convo = await Conversation.create({
                    participants: [myId, otherId],
                    lastMessage: "",
                    lastMessageAt: new Date(),
                });
                console.log("✅ conversation created:", convo._id.toString());
            } catch (createErr) {
                console.warn("⚠️ conversation create error (retrying find):", createErr.message);
                convo = await Conversation.findOne({ participants: { $all: [myId, otherId] } });
                if (!convo) throw createErr;
            }
        }

        return res.json({ conversation: convo });
    } catch (err) {
        console.error("GET /conversations/with/:userId error:", err);
        return res.status(500).json({ error: "Server error" });
    }
});

export default router;
