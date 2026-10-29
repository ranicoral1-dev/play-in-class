import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import { registerSocket } from './rooms.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_ORIGIN || '*' },
  pingInterval: 10000,
  pingTimeout: 8000,
});

app.get('/health', (req, res) => res.json({ ok: true }));

// בפרודקשן השרת מגיש גם את הלקוח הבנוי
const dist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

io.on('connection', (socket) => registerSocket(io, socket));

server.listen(PORT, () => {
  console.log(`🎮 השרת רץ על http://localhost:${PORT}`);
});
