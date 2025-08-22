# Chat App (React Native + Node.js + Socket.IO)

<p align="center">
  <a href="https://drive.google.com/file/d/11v_fxL7t1D_jjhYGChM1t8ASW7OVx-a5/view?usp=sharing" target="_blank">
    <button style="padding:10px 20px; background-color:#4CAF50; color:white; border:none; border-radius:5px; cursor:pointer; font-size:16px;">
      # Watch Demo Video
    </button>
  </a>
</p>


A real-time 1:1 chat application built with React Native (Expo) frontend and Node.js (Express + Socket.IO) backend. Features include JWT authentication, real-time messaging with Socket.IO, message persistence in MongoDB, typing indicators, online status, and read receipts.

## Features

- ✅ JWT Authentication (login/register)
- ✅ Real-time messaging with Socket.IO
- ✅ Message persistence in MongoDB
- ✅ User list with online status
- ✅ Typing indicators
- ✅ Read receipts
- ✅ Cross-platform mobile app with Expo

## Project Structure

```
/mobile         # Expo React Native app (TypeScript)
  /screens
  /components
  /services
  ...
/server         # Node + Express + Socket.IO backend
  /models
  /routes
  index.js
  scripts/
README.md
```

## Prerequisites

- Node.js (v18+ recommended)
- npm or yarn
- Expo CLI (optional): `npm install -g expo-cli` or use `npx expo`
- MongoDB Atlas cluster or local MongoDB instance
- Git

## Getting Started

### 1. Server Setup

#### 1.1 Install Dependencies
```bash
cd server
npm install
```

#### 1.2 Environment Configuration

Create a `.env` file in the `/server` directory:

```env
PORT=5000
MONGO_URI=mongodb+srv://<user>:<pass>@cluster0.mongodb.net/chat_app?retryWrites=true&w=majority
JWT_SECRET=supersecret_jwt_key_here
```

> ⚠️ **Important**: Never commit `.env` to version control

Example `.env.example`:
```env
PORT=5000
MONGO_URI=<your_mongo_uri>
JWT_SECRET=<your_jwt_secret>
```

#### 1.3 Seed Sample Users (Optional)

Create `server/scripts/seed.js`:

```javascript
// server/scripts/seed.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js"; // adjust path if needed

dotenv.config();
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET;

async function main() {
  await mongoose.connect(MONGO_URI);
  const passwordHash = await bcrypt.hash("password123", 10);

  const alice = await User.create({ name: "Alice", email: "alice@example.com", passwordHash });
  const bob = await User.create({ name: "Bob", email: "bob@example.com", passwordHash });

  console.log("Alice id:", alice._id.toString());
  console.log("Bob id:", bob._id.toString());

  const aliceToken = jwt.sign({ userId: alice._id.toString(), email: alice.email }, JWT_SECRET, { expiresIn: "7d" });
  const bobToken = jwt.sign({ userId: bob._id.toString(), email: bob.email }, JWT_SECRET, { expiresIn: "7d" });

  console.log("Alice token:", aliceToken);
  console.log("Bob token:", bobToken);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

Run the seed script:
```bash
cd server
node scripts/seedUsers.js
```

#### 1.4 Start the Server
```bash
# Development mode (with nodemon)
npm run dev

# Production mode
node index.js
```

You should see:
- ✅ Connected to MongoDB
- 🚀 Server + Socket.IO running on http://localhost:5000

### 2. Mobile App Setup

#### 2.1 Install Dependencies
```bash
cd my-expo-app
npm install
```

#### 2.2 Configure API Host

**For testing on physical devices**, update the following files with your computer's LAN IP address:

`mobile/services/api.ts`:
```typescript
export const API_BASE = 'http://192.168.x.y:5000' // Replace with your PC IP
```

`mobile/services/socket.ts`:
```typescript
export const SERVER = 'http://192.168.x.y:5000' // Replace with your PC IP
```

> 💡 **Note**: For Android emulator, you might need to use `10.0.2.2` instead of `localhost`

#### 2.3 Start Expo
```bash
cd my-expo-app
npx expo start
```

- Scan the QR code with Expo Go app on your device
- Or run on emulator/simulator

## API Reference

### REST Endpoints

All endpoints are prefixed with `/api/v1`

#### Authentication

**Register User**
```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "name": "Alice",
  "email": "alice@example.com",
  "password": "password123"
}
```

Response:
```json
{
  "token": "<jwt_token>",
  "user": {
    "_id": "...",
    "name": "...",
    "email": "..."
  }
}
```

**Login User**
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "alice@example.com",
  "password": "password123"
}
```

Response:
```json
{
  "token": "<jwt_token>",
  "user": {
    "_id": "...",
    "name": "...",
    "email": "..."
  }
}
```

#### Users

**Get All Users**
```http
GET /api/v1/users
Authorization: Bearer <jwt_token>
```

Response:
```json
{
  "users": [
    {
      "_id": "...",
      "name": "...",
      "email": "...",
      "online": true
    }
  ]
}
```

#### Conversations

**Get or Create Conversation**
```http
GET /api/v1/conversations/with/:userId
Authorization: Bearer <jwt_token>
```

**Get Conversation Messages**
```http
GET /api/v1/conversations/:id/messages?limit=50&skip=0
Authorization: Bearer <jwt_token>
```

Response:
```json
{
  "conversation": { ... },
  "messages": [ ... ]
}
```

### Socket.IO API

#### Connection

```javascript
import { io } from "socket.io-client";

const socket = io("http://localhost:5000", {
  transports: ["websocket"],
  auth: { token: "<JWT_TOKEN>" }
});
```

#### Events

**Send Message**
```javascript
socket.emit("message:send", {
  to: "<recipient_user_id>",
  text: "Hello!"
});
```

**Receive Message**
```javascript
socket.on("message:new", (message) => {
  // message: { _id, conversation, from, to, text, read, createdAt }
});
```

**Typing Indicators**
```javascript
// Start typing
socket.emit("typing:start", { to: "<user_id>", conversationId: "<id>" });

// Stop typing
socket.emit("typing:stop", { to: "<user_id>", conversationId: "<id>" });
```

**Read Receipts**
```javascript
// Mark message as read
socket.emit("message:read", { conversationId: "<id>" });

// Listen for read receipts
socket.on("message:read", (data) => {
  // Handle read receipt
});
```

**Presence**
```javascript
socket.on("presence:online", (userId) => {
  // User came online
});

socket.on("presence:offline", (userId) => {
  // User went offline
});
```

## Testing

### Manual API Testing

#### Using PowerShell (Windows)

```powershell
# Login
$alice = Invoke-RestMethod -Method Post -Uri "http://localhost:5000/api/v1/auth/login" -ContentType "application/json" -Body '{"email":"alice@example.com","password":"password123"}'
$env:ALICE_TOKEN = $alice.token

# Get users
$headers = @{ Authorization = "Bearer $env:ALICE_TOKEN" }
Invoke-RestMethod -Method Get -Uri "http://localhost:5000/api/v1/users" -Headers $headers
```

#### Using cURL (Unix/WSL)

```bash
# Login
ALICE_TOKEN=$(curl -s -X POST -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"password123"}' \
  http://localhost:5000/api/v1/auth/login | jq -r '.token')

# Get users
curl -H "Authorization: Bearer $ALICE_TOKEN" http://localhost:5000/api/v1/users
```

### Socket Testing

Use the included `server/scripts/socketClient.js` for testing Socket.IO functionality:

```bash
# Set environment variables (PowerShell)
$env:SERVER_URL="http://localhost:5000"
$env:TOKEN=$env:ALICE_TOKEN
$env:PEER="<bob_user_id>"
$env:SEND="Hello Bob 👋"
$env:AUTO_READ="1"

# Run socket client
node scripts/socketClient.js
```

## Useful Commands

```bash
# Server
cd server
npm i
npm run dev                    # Run with nodemon
node index.js                  # Production mode
node scripts/seedUsers.js      # Seed sample users (optional)

# Mobile
cd my-expo-app
npm i
npx expo start                 # Start Expo development server
npm run android               # Run on Android emulator (if configured)
npm run web                   # Web preview
```

## Troubleshooting

### Common Errors

**Socket Connection Error: "connect_error Unauthorized: invalid token"**
- Ensure `TOKEN` is the complete JWT (not just user ID)
- Verify `JWT_SECRET` in `.env` matches the secret used to sign tokens

**Cannot connect from mobile device**
- Replace `localhost` with your computer's LAN IP address in API configuration
- Ensure your device and computer are on the same network
- Check if firewall is blocking the connection

**MongoDB Connection Issues**
- Verify `MONGO_URI` in `.env` is correct
- Ensure MongoDB Atlas cluster allows connections from your IP
- Check if MongoDB service is running (for local installations)

## Technologies Used

- **Frontend**: React Native, Expo, TypeScript
- **Backend**: Node.js, Express.js
- **Real-time**: Socket.IO
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT (JSON Web Tokens)
- **Password Hashing**: bcrypt

## License

This project is licensed under the MIT License.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request
