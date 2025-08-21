import mongoose from "mongoose";
import { Schema } from "mongoose";


const messageSchema = new Schema(
    {
        conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
        from: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        to: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        text: { type: String, required: true },
        read: { type: Boolean, default: false }
    },
    { timestamps: true }
);

messageSchema.index({ conversation: 1, createdAt: 1 });
export const Message = mongoose.model('Message', messageSchema);
