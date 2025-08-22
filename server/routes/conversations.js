import express from "express"

import { auth } from "../middleware/auth.js"
import { Conversation } from "../models/Conversation.js"
import { Message } from "../models/Message.js"

const router = express.Router();

router.get('/:id/messages', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const convo = await Conversation.findById(id);
        if (!convo) return res.status(404).json({ error: 'Conversation not found' });
        const isParticipant = convo.participants.some(p => String(p) === String(req.user.id));
        if (!isParticipant) return res.status(403).json({ error: 'Not a participant of this conversation' });

        const messages = await Message
            .find({ conversation: id })
            .sort({ createdAt: 1 });

        res.json({ conversation: convo, messages });
    } catch (err) {
        console.error('GET /conversations/:id/messages error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/with/:userId', auth, async (req, res) => {
    try {
        const otherIdRaw = req.params.userId;
        const myIdRaw = req.user.id;

        if (!otherIdRaw) return res.status(400).json({ error: 'other user id required' });
        if (otherIdRaw === myIdRaw) return res.status(400).json({ error: 'cannot create conversation with self' });

        // cast to ObjectId
        let myId, otherId;
        try {
            myId = new mongoose.Types.ObjectId(myIdRaw);
            otherId = new mongoose.Types.ObjectId(otherIdRaw);
        } catch (err) {
            return res.status(400).json({ error: 'invalid user id format' });
        }

        // 1) try find
        let convo = await Conversation.findOne({ participants: { $all: [myId, otherId] } });

        // 2) if missing, create and handle race
        if (!convo) {
            try {
                convo = await Conversation.create({
                    participants: [myId, otherId],
                    lastMessage: '',
                    lastMessageAt: new Date()
                });
            } catch (createErr) {
                // if race or duplicate, try to find again
                convo = await Conversation.findOne({ participants: { $all: [myId, otherId] } });
                if (!convo) throw createErr; // propagate unexpected error
            }
        }

        return res.json({ conversation: convo });
    } catch (err) {
        console.error('GET /conversations/with/:userId error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
});


export default router;