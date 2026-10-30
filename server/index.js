import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import { registerSocket, roomFile } from './rooms.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_ORIGIN || '*' },
  pingInterval: 10000,
  pingTimeout: 8000,
  maxHttpBufferSize: 6e6, // תמונות של צור ריל
});

app.get('/health', (req, res) => res.json({ ok: true }));

app.get('/img/:code/:token', (req, res) => {
  const f = roomFile(req.params.code, req.params.token);
  if (!f) return res.sendStatus(404);
  res.set('Cache-Control', 'private, max-age=3600').type(f.type).send(f.buf);
});

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
