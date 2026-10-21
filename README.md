# Pulse: real-time team chat

A full-stack chat app built with the MERN stack and WebSockets. People sign up, join channels and chat live: messages appear instantly for everyone, with an online list, typing indicators and unread counts. Works on phones and desktops.

![CI](https://github.com/NovasHorizon/pulse-chat/actions/workflows/ci.yml/badge.svg)

## Features

- Sign up and log in (passwords hashed with bcrypt, JWT tokens, rate-limited login)
- Channels: three to start with, and anyone can create more; new channels appear for everyone instantly
- Real-time messages over WebSockets (Socket.io), saved in MongoDB
- Message history with "load earlier messages" (50 at a time)
- Who's online, "X is typing…" and unread badges on other channels
- Messages grouped by sender and day, auto-scroll that doesn't jump while you read older messages
- Mobile-first layout with a slide-out channel menu
- Reconnects on its own after a network drop and rejoins the channel

## Tech stack

| Layer | Tools |
| --- | --- |
| Frontend | React 18, Tailwind CSS 4, Socket.io client, Vite |
| Backend | Node.js, Express 5, Socket.io |
| Database | MongoDB with Mongoose |
| Security | bcrypt, JWT, CORS allow-list, rate limiting, input validation on every route and socket event |
| Testing | Node test runner, Supertest, real socket clients, in-memory MongoDB |
| DevOps | GitHub Actions CI, Render (API), Vercel (frontend), MongoDB Atlas |

## How it works

1. **Login:** the API checks the password with bcrypt and returns a signed JWT. The browser keeps it and sends it with every request.
2. **Live connection:** the browser opens one WebSocket and sends the JWT. The server refuses sockets without a valid token.
3. **Channels are rooms:** opening a channel joins its Socket.io room and loads the last 50 messages over REST.
4. **Sending:** the browser emits `message:send`. The server validates it, saves it to MongoDB, then broadcasts `message:new` to everyone in that room. The sender gets an acknowledgement, so failed sends can be retried.
5. **Presence:** the server counts each user's open connections (two tabs count once) and broadcasts the online list when it changes.

## Run locally

Needs Node.js 20+. No database install needed: without `MONGODB_URI` the API starts a temporary in-memory MongoDB.

```bash
cd server
npm install
npm run dev
```

```bash
cd client
npm install
npm run dev
```

Open http://localhost:5175. Run the API tests with `npm test` in `server/`.

## Project structure

```
server/src/
  index.js     starts HTTP + WebSocket server
  app.js       REST API: auth, channels, message history
  sockets.js   live events: join, send, typing, presence
  models.js    Mongoose models: User, Channel, Message
  auth.js      JWT helpers and the requireAuth middleware
  db.js        MongoDB connection and default channels
server/test/   API and WebSocket tests
client/src/
  App.jsx      session restore, login/logout
  Auth.jsx     sign-up / log-in page
  Chat.jsx     sidebar, message list, composer, live updates
```

Built by [Varadraj Khorate](https://github.com/NovasHorizon) with AI-assisted development.
