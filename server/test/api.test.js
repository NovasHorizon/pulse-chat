import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import request from 'supertest';
import { io as connect } from 'socket.io-client';
import { createApp } from '../src/app.js';
import { attachSockets } from '../src/sockets.js';
import { connectDb, disconnectDb, seedChannels } from '../src/db.js';

let app, server, url;

before(async () => {
  await connectDb(); // in-memory MongoDB
  await seedChannels();
  app = createApp();
  server = createServer(app);
  app.set('io', attachSockets(server));
  await new Promise((resolve) => server.listen(0, resolve));
  url = `http://localhost:${server.address().port}`;
});

after(async () => {
  app.get('io').close();
  await disconnectDb();
});

const register = (name, email) =>
  request(app).post('/api/auth/register').send({ name, email, password: 'secret123' });

const socketFor = (token) =>
  new Promise((resolve, reject) => {
    const socket = connect(url, { auth: { token }, transports: ['websocket'] });
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
  });

const nextEvent = (socket, event) => new Promise((resolve) => socket.once(event, resolve));

test('register, reject duplicates, log in', async () => {
  const res = await register('Asha', 'asha@test.dev');
  assert.equal(res.status, 201);
  assert.ok(res.body.token);
  assert.equal(res.body.user.passwordHash, undefined);

  assert.equal((await register('Asha 2', 'ASHA@test.dev')).status, 409);
  assert.equal((await request(app).post('/api/auth/login').send({ email: 'asha@test.dev', password: 'wrong-pass' })).status, 401);
  assert.equal((await request(app).post('/api/auth/login').send({ email: 'asha@test.dev', password: 'secret123' })).status, 200);
});

test('validates input and protects routes', async () => {
  assert.equal((await register('A', 'bad-email')).status, 422);
  assert.equal((await request(app).get('/api/channels')).status, 401);
});

test('messages are delivered live to other users and saved', async () => {
  const a = (await register('Ravi', 'ravi@test.dev')).body.token;
  const b = (await register('Meera', 'meera@test.dev')).body.token;
  const { channels } = (await request(app).get('/api/channels').set('Authorization', `Bearer ${a}`)).body;
  const general = channels.find((c) => c.name === 'general');

  const [ravi, meera] = await Promise.all([socketFor(a), socketFor(b)]);
  ravi.emit('channel:join', general.id);
  meera.emit('channel:join', general.id);
  await new Promise((r) => setTimeout(r, 50)); // let both joins land

  const received = nextEvent(meera, 'message:new');
  const ack = await ravi.emitWithAck('message:send', { channelId: general.id, text: '  Hello Pune!  ' });
  assert.equal(ack.message.text, 'Hello Pune!');
  assert.equal((await received).user.name, 'Ravi');

  const empty = await ravi.emitWithAck('message:send', { channelId: general.id, text: '   ' });
  assert.ok(empty.error);

  const history = await request(app).get(`/api/channels/${general.id}/messages`).set('Authorization', `Bearer ${b}`);
  assert.deepEqual(history.body.messages.map((m) => m.text), ['Hello Pune!']);

  ravi.close();
  meera.close();
});

test('sockets without a valid token are refused', async () => {
  await assert.rejects(socketFor('forged-token'), /unauthorized/);
});

test('creating a channel is broadcast', async () => {
  const token = (await register('Dev', 'dev@test.dev')).body.token;
  const socket = await socketFor(token);
  const announced = nextEvent(socket, 'channel:created');
  const res = await request(app).post('/api/channels').set('Authorization', `Bearer ${token}`).send({ name: 'react-help' });
  assert.equal(res.status, 201);
  assert.equal((await announced).name, 'react-help');
  assert.equal((await request(app).post('/api/channels').set('Authorization', `Bearer ${token}`).send({ name: 'Bad Name!' })).status, 422);
  socket.close();
});
