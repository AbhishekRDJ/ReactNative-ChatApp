import express from "express"
import dotenv from "dotenv"
import cors from "cors"
import { connectDB } from "./config/db.js"
import authRoutes from "./routes/auth.js"
import usersRoutes from "./routes/users.js"
dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());


const startServer = () => {
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
};

connectDB().then(() => {
    startServer();
});

// routes
app.get('/', (req, res) => res.send({ ok: true, message: 'Server running' }));
app.use('/auth', authRoutes);
app.use('/users', usersRoutes);


