import mongoose from "mongoose";
import { Schema } from "mongoose";

const conversationSchema = new Schema(
    {
        participants: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }], // [userA, userB]
        lastMessage: { type: String, default: '' },
        lastMessageAt: { type: Date, default: Date.now }
    },
    { timestamps: true }
);

// optional index to speed up participant lookups
conversationSchema.index({ participants: 1 });
export const Conversation = mongoose.model('Conversation', conversationSchema);
