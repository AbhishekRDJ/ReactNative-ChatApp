import { User } from "../models/User";
import jwt from "jsonwebtoken"
import { auth } from "../middleware/auth";
import express from "express"
const router = express.Router();



router.get('/', auth, async (req, res) => {
    try {
        // exclude requester from list (optional) and remove passwordHash via toJSON
        const users = await User.find({ _id: { $ne: req.user.id } }).select('-passwordHash').sort({ name: 1 });
        res.json({ users });
    } catch (err) {
        console.error('Get users error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
