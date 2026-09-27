# WaOutreach: Anti-Ban WhatsApp Cold Outreach Engine 🚀

A production-grade, anti-ban resilient WhatsApp Cold Messaging and Lead Automation Engine built on Node.js, Express, MongoDB, Socket.io, and `@whiskeysockets/baileys`.

---

## 🛡️ Anti-Ban Engine Architecture

WaOutreach implements 5 rigorous defensive layers to protect your WhatsApp account from spam detection algorithms:

1. **Recursive Spintax & Personalization Parser**:
   Evaluates nested choices `{Hi|Hello|{Hey|Greetings}}` and hydrates variables `{{name}}`, `{{company}}` so no two messages share the same hash fingerprint.
2. **Stochastic Jitter Delay (45s - 90s)**:
   Randomized delays between every message to eliminate robotic regularity.
3. **Batch Cooldown Throttle (12m - 18m per 15 msgs)**:
   Forces a mandatory cooling period after every 15 dispatched messages to break burst patterns.
4. **Daily Guardrail Hard Cap (100 msgs/24h)**:
   Hard cap in any rolling 24-hour cycle to keep sender volumes well below risk thresholds.
5. **Real-Time Regex Opt-Out Engine**:
   Incoming messages matching `/stop|unsubscribe|don't text|remove/i` automatically flag leads as `blacklisted` and permanently block subsequent outreach.

---

## 🏗️ Tech Stack

- **Backend**: Node.js (ESM), Express.js, MongoDB (Mongoose), Socket.io
- **WhatsApp Engine**: `@whiskeysockets/baileys` with `useMultiFileAuthState`
- **Frontend**: React 19, Vite, Tailwind CSS, Lucide-React, Socket.io-client
- **Queue Worker**: In-memory / MongoDB-backed FIFO queue with non-blocking async sleep

---

## 🚀 Quick Start

### Prerequisites
- Node.js >= 18
- MongoDB (Local, Atlas URI in `.env`, or automatic fallback)

### 1. Start Backend
```bash
cd backend
npm install
npm run dev
```
Backend will start on `http://localhost:5000`.

### 2. Start Frontend
```bash
cd frontend
npm install
npm run dev
```
Frontend dashboard will be accessible at `http://localhost:5173`.

---

## 🧪 Testing Spintax Parser
```bash
cd backend
npm test
```
All unit tests will execute and validate recursive spintax permutations and variable interpolation.

---

## 📂 Project Directory Structure

```
├── backend/
│   ├── src/
│   │   ├── config/db.js          # MongoDB connection with memory-server fallback
│   │   ├── models/               # Mongoose schemas (Lead, Campaign, ActivityLog)
│   │   ├── routes/               # REST API endpoints (whatsapp, campaign, lead, queue, stats)
│   │   ├── services/
│   │   │   ├── whatsapp.service.js # Baileys socket & opt-out listener
│   │   │   └── queue.service.js    # FIFO worker with jitter & cooldowns
│   │   ├── utils/spintax.js      # Nested spintax parser & variable hydrator
│   │   ├── server.js             # HTTP & Socket.io server
│   │   └── socket.js             # Real-time event broadcaster
│   └── test/spintax.test.js      # Unit tests
└── frontend/
    └── src/
        ├── components/           # ConnectionCard, QueueControl, Stats, Composer, Importer, Table
        ├── context/              # Socket.io context provider
        ├── api.js                # Axios client
        └── App.jsx               # Dashboard application
```
