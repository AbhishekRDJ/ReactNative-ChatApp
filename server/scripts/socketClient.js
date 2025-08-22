import { io } from "socket.io-client";

const SERVER_URL = process.env.SERVER_URL || "http://localhost:5000";
const TOKEN = process.env.TOKEN; // <-- must be Alice's JWT token
const PEER = process.env.PEER;   // <-- must be Bob's MongoDB _id
const SEND = process.env.SEND || "Hello 👋";

if (!TOKEN) {
    console.error("❌ Missing TOKEN. Run with $env:TOKEN=<jwt>");
    process.exit(1);
}

if (!PEER) {
    console.error("❌ Missing PEER (recipient userId). Run with $env:PEER=<id>");
    process.exit(1);
}

const socket = io(SERVER_URL, {
    transports: ["websocket"],
    auth: { token: TOKEN },
});

socket.on("connect", () => {
    console.log("✅ Connected as", socket.id);

    // send message to Bob
    socket.emit("message:send", { to: PEER, text: SEND });
});

socket.on("message:new", (msg) => {
    console.log("📩 message:new", msg);
});

socket.on("message:sent", (info) => {
    console.log("✅ message:sent", info);
});

socket.on("connect_error", (err) => {
    console.error("❌ connect_error", err.message);
});
