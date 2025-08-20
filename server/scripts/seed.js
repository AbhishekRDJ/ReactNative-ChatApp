

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { User } from '../models/User.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
const SALT_ROUNDS = 10;


async function seed() {
    if (!MONGO_URI) {
        console.error('MONGO_URI not set in .env');
        process.exit(1);
    }
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const usersData = [
        { name: 'Alice', email: 'alice@example.com', password: 'password123' },
        { name: 'Bob', email: 'bob@example.com', password: 'password123' }
    ];

    for (const u of usersData) {
        const exists = await User.findOne({ email: u.email });
        if (exists) {
            console.log('Skipping existing:', u.email);
            continue;
        }
        const hash = await bcrypt.hash(u.password, SALT_ROUNDS);
        await User.create({ name: u.name, email: u.email, passwordHash: hash });
        console.log('Created user:', u.email);
    }

    console.log('Seeding complete');
    process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
