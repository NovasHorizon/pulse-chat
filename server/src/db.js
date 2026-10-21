import mongoose from 'mongoose';
import { Channel } from './models.js';

let memoryServer;

export async function connectDb(uri = process.env.MONGODB_URI) {
  if (!uri) {
    if (process.env.NODE_ENV === 'production') throw new Error('MONGODB_URI is required in production');
    // No database configured: start a throwaway in-memory MongoDB (local development and tests)
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri();
  }
  await mongoose.connect(uri);
}

export async function disconnectDb() {
  await mongoose.disconnect();
  await memoryServer?.stop();
}

const DEFAULT_CHANNELS = [
  { name: 'general', description: 'Say hi to everyone' },
  { name: 'random', description: 'Anything goes' },
  { name: 'help', description: 'Ask questions, get answers' },
];

export async function seedChannels() {
  for (const channel of DEFAULT_CHANNELS) {
    await Channel.updateOne({ name: channel.name }, { $setOnInsert: channel }, { upsert: true });
  }
}
