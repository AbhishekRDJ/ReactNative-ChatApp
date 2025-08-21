
import { io } from 'socket.io-client';

const SERVER_URL = 'http://localhost:5000';
const TOKEN = '<ALICE_JWT_TOKEN>';
const BOB_ID = '<BOB_USER_ID>'; // you can get this from /users (protected)

const socket = io(SERVER_URL, {
    autoConnect: true,
    transports: ['websocket'],
    auth: { token: TOKEN }
});

socket.on('connect', () => {
    console.log('connected as', socket.id);

    socket.emit('message:send', { to: BOB_ID, text: 'Hello Bob 👋' });
});

socket.on('message:new', (msg) => {
    console.log('message:new', msg);
});

socket.on('typing:start', (p) => console.log('typing:start', p));
socket.on('typing:stop', (p) => console.log('typing:stop', p));
socket.on('message:read', (p) => console.log('message:read', p));
socket.on('presence:online', (p) => console.log('presence:online', p));
socket.on('presence:offline', (p) => console.log('presence:offline', p));
socket.on('connect_error', (err) => console.error('connect_error', err.message));
