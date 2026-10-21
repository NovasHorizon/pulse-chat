import mongoose from 'mongoose';
import { Server } from 'socket.io';
import { verifyToken } from './auth.js';
import { allowedOrigins } from './app.js';
import { Channel, Message, messageDto } from './models.js';

export function attachSockets(httpServer) {
  const io = new Server(httpServer, { cors: { origin: allowedOrigins() } });

  // Every connection must carry a valid login token
  io.use((socket, next) => {
    try {
      socket.data.user = verifyToken(socket.handshake.auth?.token);
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  // userId -> { name, connections }. A user with two tabs open counts once.
  // ponytail: presence lives in this process's memory, so it only works with one server instance;
  // add the Socket.io Redis adapter to run several.
  const online = new Map();
  const broadcastPresence = () =>
    io.emit('presence', [...online].map(([id, { name }]) => ({ id, name })));

  io.on('connection', (socket) => {
    const { id, name } = socket.data.user;
    online.set(id, { name, connections: (online.get(id)?.connections ?? 0) + 1 });
    broadcastPresence();

    socket.on('channel:join', (channelId) => {
      if (!mongoose.isValidObjectId(channelId)) return;
      for (const room of socket.rooms) if (room !== socket.id) socket.leave(room);
      socket.join(String(channelId));
    });

    socket.on('message:send', async ({ channelId, text } = {}, ack = () => {}) => {
      const body = String(text ?? '').trim();
      if (!body || body.length > 1000) return ack({ error: 'Messages must be 1 to 1000 characters.' });
      if (!mongoose.isValidObjectId(channelId) || !(await Channel.exists({ _id: channelId }))) {
        return ack({ error: 'Channel not found.' });
      }
      const message = await Message.create({ channel: channelId, user: id, text: body });
      await message.populate('user', 'name');
      const dto = messageDto(message);
      io.to(String(channelId)).emit('message:new', dto);
      ack({ message: dto });
    });

    socket.on('typing', (channelId) => {
      if (socket.rooms.has(String(channelId))) socket.to(String(channelId)).emit('typing', { channelId, user: { id, name } });
    });

    socket.on('disconnect', () => {
      const entry = online.get(id);
      if (entry && --entry.connections <= 0) online.delete(id);
      broadcastPresence();
    });
  });

  return io;
}
