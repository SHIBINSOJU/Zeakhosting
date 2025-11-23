import mongoose from 'mongoose';
import config from './config.js';

export async function connectDB() {
  if (!config.MONGODB_URI) {
    console.error('[DB] MONGODB_URI is not set. Database connection skipped.');
    return;
  }

  try {
    await mongoose.connect(config.MONGODB_URI);
    console.log('[DB] Connected to MongoDB.');
  } catch (err) {
    console.error('[DB] Error connecting to MongoDB:', err);
  }
}
