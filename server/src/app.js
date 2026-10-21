import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import { User, Channel, Message, userDto, channelDto, messageDto } from './models.js';
import { signToken, requireAuth } from './auth.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CHANNEL_NAME = /^[a-z0-9-]{2,24}$/;
const PAGE_SIZE = 50;

export const allowedOrigins = () => process.env.CLIENT_URL?.split(',').map((s) => s.trim()) ?? true;

export function createApp() {
  const app = express();
  app.set('trust proxy', 1); // Render sits behind a proxy; needed for per-IP rate limits
  app.use(cors({ origin: allowedOrigins() }));
  app.use(express.json({ limit: '10kb' }));

  app.get('/api/health', (req, res) => res.json({ ok: true }));

  // Slow down password guessing: 20 attempts per 15 minutes per IP
  const authLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false });

  app.post('/api/auth/register', authLimit, async (req, res) => {
    const name = String(req.body?.name ?? '').trim();
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    if (name.length < 2 || name.length > 30) return res.status(422).json({ error: 'Name must be 2 to 30 characters.' });
    if (!EMAIL.test(email)) return res.status(422).json({ error: 'Enter a valid email address.' });
    if (password.length < 8) return res.status(422).json({ error: 'Password must be at least 8 characters.' });
    if (await User.exists({ email })) return res.status(409).json({ error: 'An account with this email already exists.' });

    const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 10) });
    res.status(201).json({ token: signToken(user), user: userDto(user) });
  });

  app.post('/api/auth/login', authLimit, async (req, res) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const user = await User.findOne({ email });
    const ok = user && (await bcrypt.compare(String(req.body?.password ?? ''), user.passwordHash));
    if (!ok) return res.status(401).json({ error: 'Wrong email or password.' });
    res.json({ token: signToken(user), user: userDto(user) });
  });

  app.get('/api/me', requireAuth, async (req, res) => {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).json({ error: 'Please log in again.' });
    res.json({ user: userDto(user) });
  });

  app.get('/api/channels', requireAuth, async (req, res) => {
    const channels = await Channel.find().sort({ createdAt: 1 });
    res.json({ channels: channels.map(channelDto) });
  });

  app.post('/api/channels', requireAuth, async (req, res) => {
    const name = String(req.body?.name ?? '').trim().toLowerCase();
    const description = String(req.body?.description ?? '').trim().slice(0, 100);
    if (!CHANNEL_NAME.test(name)) {
      return res.status(422).json({ error: 'Use 2 to 24 lowercase letters, numbers or dashes.' });
    }
    if (await Channel.exists({ name })) return res.status(409).json({ error: 'That channel already exists.' });

    const channel = await Channel.create({ name, description, createdBy: req.user.id });
    req.app.get('io')?.emit('channel:created', channelDto(channel));
    res.status(201).json({ channel: channelDto(channel) });
  });

  // Latest 50 messages, oldest first; pass ?before=<ISO date> to load older ones
  app.get('/api/channels/:id/messages', requireAuth, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Channel not found.' });
    const filter = { channel: req.params.id };
    const before = new Date(req.query.before);
    if (!Number.isNaN(before.getTime())) filter.createdAt = { $lt: before };

    const messages = await Message.find(filter).sort({ createdAt: -1 }).limit(PAGE_SIZE).populate('user', 'name');
    res.json({ messages: messages.reverse().map(messageDto), hasMore: messages.length === PAGE_SIZE });
  });

  app.use((req, res) => res.status(404).json({ error: 'Not found.' }));
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  });

  return app;
}
