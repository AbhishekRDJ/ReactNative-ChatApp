import express from "express"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import { User } from "../models/User.js"

const router = express.Router();
const SALT_ROUNDS = 10;

router.post("/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) return res.status(400).json({ error: "give all input data" });
        const exisitingUser = await User.findOne({ email: email.toLowerCase() });
        if (exisitingUser) return res.status(409).json("User Already Exist");


        const hash = await bcrypt.hash(password, SALT_ROUNDS);
        const user = await User.create({ name, email: email.toLowerCase(), passwordHash: hash });
        const token = jwt.sign({ userid: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '1d' });
        res.status(201).json({ message: "User registered successfully", token, user });
    } catch (error) {
        console.log(error);
        throw new Error("error while registering in auth routes")
    }
})

router.post("/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(409).json({ error: "give all input filed data" });
    const userExist = await User.findOne({ email: email.toLowerCase() })
    if (!userExist) return res.status(401).json({ error: "Invalid Credentails" });
    const isMatch = await bcrypt.compare(password, userExist.passwordHash);
    if (!isMatch) return res.status(401).json({ error: "Invalid Credentails" });
    const token = jwt.sign({ userId: userExist._id, email: userExist.email }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.status(200).json({ message: "Login Successfull", token, user: userExist })


})



export default router;