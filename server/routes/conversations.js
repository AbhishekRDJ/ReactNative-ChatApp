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

export default router;