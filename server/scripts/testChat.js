// server/scripts/testChat.js
// Usage: set env vars then run:
//   $env:ALICE_TOKEN = "<alice_jwt>"; $env:BOB_TOKEN = "<bob_jwt>"; $env:ALICE_ID = "<alice_id>"; $env:BOB_ID = "<bob_id>"; node .\scripts\testChat.js
import { io } from "socket.io-client";

const SERVER = process.env.SERVER_URL || "http://localhost:5000";
const ALICE_TOKEN = process.env.ALICE_TOKEN;
const BOB_TOKEN = process.env.BOB_TOKEN;
const ALICE_ID = process.env.ALICE_ID;
const BOB_ID = process.env.BOB_ID;

if (!ALICE_TOKEN || !BOB_TOKEN || !ALICE_ID || !BOB_ID) {
    console.error("Missing env vars. Set ALICE_TOKEN, BOB_TOKEN, ALICE_ID, BOB_ID");
    process.exit(1);
}

function createClient(name, token) {
    return new Promise((resolve) => {
        const socket = io(SERVER, { transports: ["websocket"], auth: { token } });

        socket.on("connect", () => {
            console.log(`${name} connected as ${socket.id}`);
            resolve(socket);
        });

        socket.on("connect_error", (err) => {
            console.error(`${name} connect_error:`, err.message);
        });

        socket.on("message:new", (m) => console.log(`${name} event message:new ->`, m));
        socket.on("message:sent", (ack) => console.log(`${name} event message:sent ack ->`, ack));
        socket.on("typing:start", (p) => console.log(`${name} event typing:start ->`, p));
        socket.on("typing:stop", (p) => console.log(`${name} event typing:stop ->`, p));
        socket.on("message:read", (p) => console.log(`${name} event message:read ->`, p));
        socket.on("presence:online", (p) => console.log(`${name} event presence:online ->`, p));
        socket.on("presence:offline", (p) => console.log(`${name} event presence:offline ->`, p));
    });
}

(async () => {
    console.log("Starting automated test: Alice -> Bob");

    const alice = await createClient("Alice", ALICE_TOKEN);
    const bob = await createClient("Bob", BOB_TOKEN);

    // small wait to ensure server joined rooms etc
    await new Promise((r) => setTimeout(r, 500));

    console.log("Alice will send message to Bob now...");
    alice.emit("message:send", { to: BOB_ID, text: "Hello Bob — automated test!" });

    // wait for events to arrive
    await new Promise((r) => setTimeout(r, 2000));

    console.log("Now instructing Bob to send a reply...");
    bob.emit("message:send", { to: ALICE_ID, text: "Hi Alice — reply from Bob!" });

    // wait for events to arrive
    await new Promise((r) => setTimeout(r, 2000));

    console.log("Disconnecting both sockets...");
    alice.disconnect();
    bob.disconnect();

    console.log("Test done — check server console and MongoDB for saved messages.");
    process.exit(0);
})();
