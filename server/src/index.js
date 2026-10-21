import { createServer } from 'node:http';
import { createApp } from './app.js';
import { attachSockets } from './sockets.js';
import { connectDb, seedChannels } from './db.js';

await connectDb();
await seedChannels();

const app = createApp();
const server = createServer(app);
app.set('io', attachSockets(server));

const port = Number(process.env.PORT) || 4000;
server.listen(port, () => console.log(`Pulse API listening on http://localhost:${port}`));
