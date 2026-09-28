import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PERSISTENT_DB_DIR = path.resolve(__dirname, '../../data/db');

let memoryServerInstance = null;

export async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/waoutreach';

  try {
    console.log(`[Database] Attempting connection to MongoDB at: ${uri}`);
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 3000,
    });
    console.log('[Database] Connected successfully to primary MongoDB.');
  } catch (err) {
    console.warn(`[Database] Primary MongoDB unreachable (${err.message}). Initializing persistent MongoMemoryServer fallback...`);
    try {
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      if (!fs.existsSync(PERSISTENT_DB_DIR)) {
        fs.mkdirSync(PERSISTENT_DB_DIR, { recursive: true });
      }

      memoryServerInstance = await MongoMemoryServer.create({
        instance: {
          dbPath: PERSISTENT_DB_DIR,
          storageEngine: 'wiredTiger',
        },
      });
      const memUri = memoryServerInstance.getUri();
      console.log(`[Database] Persistent MongoMemoryServer started at: ${memUri} (Storage: ${PERSISTENT_DB_DIR})`);
      await mongoose.connect(memUri);
      console.log('[Database] Connected to persistent fallback database.');
    } catch (memErr) {
      console.error('[Database] Failed to connect to fallback MongoMemoryServer:', memErr);
      throw memErr;
    }
  }

  mongoose.connection.on('error', (err) => {
    console.error('[Database] MongoDB connection error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[Database] MongoDB disconnected.');
  });
}

export async function disconnectDB() {
  await mongoose.disconnect();
  if (memoryServerInstance) {
    await memoryServerInstance.stop();
  }
}
