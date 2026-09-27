import http from 'http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import { initSocket } from './socket.js';
import { sessionManager } from './services/sessionManager.js';
import { warmupService } from './services/warmup.service.js';

import accountsRoutes from './routes/accounts.routes.js';
import inboxRoutes from './routes/inbox.routes.js';
import warmupRoutes from './routes/warmup.routes.js';
import whatsappRoutes from './routes/whatsapp.routes.js';
import campaignRoutes from './routes/campaign.routes.js';
import leadRoutes from './routes/lead.routes.js';
import queueRoutes from './routes/queue.routes.js';
import statsRoutes from './routes/stats.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'WaOutreach Distributed Multi-Account WhatsApp Engine',
  });
});

// Mount API Routes
app.use('/api/accounts', accountsRoutes);
app.use('/api/inbox', inboxRoutes);
app.use('/api/warmup', warmupRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/stats', statsRoutes);

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
});

// Create HTTP and Socket.io server
const server = http.createServer(app);
const io = initSocket(server);

// Boot function
async function startServer() {
  try {
    // 1. Connect Database
    await connectDB();

    // 2. Start HTTP server
    server.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`🚀 WaOutreach Multi-Account Engine running on http://localhost:${PORT}`);
      console.log(`📡 Socket.io connected and ready for real-time streaming`);
      console.log(`🛡️  Anti-Ban Engine Guardrails Active:`);
      console.log(`   - Distributed Round-Robin Dispatcher across up to 10 Accounts`);
      console.log(`   - Peer-to-Peer Warm-up Engine (9 AM - 9 PM schedule)`);
      console.log(`   - Stochastic Jitter Delays: 45s - 90s`);
      console.log(`   - Cluster Batch Cooldown: 12m - 18m per 15 messages`);
      console.log(`   - Dynamic Quota Caps per Account (default 20 msgs/account)`);
      console.log(`   - Real-time Universal Shared Inbox with Auto-Blacklist`);
      console.log(`=======================================================`);
    });

    // 3. Initialize Multi-Account Baileys Sessions
    console.log('[SessionManager] Initializing all WhatsApp account sessions...');
    sessionManager.initAllSessions().catch((err) => {
      console.error('[SessionManager] Initial session spawning deferred:', err.message);
    });

    // 4. Initialize Automated Peer-to-Peer Warm-Up Scheduler
    warmupService.startScheduler();
  } catch (error) {
    console.error('Fatal error during startup:', error);
    process.exit(1);
  }
}

// Graceful termination
process.on('SIGINT', async () => {
  console.log('\nShutting down WaOutreach gracefully...');
  process.exit(0);
});

startServer();
