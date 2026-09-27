import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

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
    console.warn(`[Database] Primary MongoDB unreachable (${err.message}). Initializing MongoMemoryServer fallback...`);
    try {
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      memoryServerInstance = await MongoMemoryServer.create();
      const memUri = memoryServerInstance.getUri();
      console.log(`[Database] MongoMemoryServer started at: ${memUri}`);
      await mongoose.connect(memUri);
      console.log('[Database] Connected to in-memory fallback database.');
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
