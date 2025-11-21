import mongoose from 'mongoose';

const countingSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  channelId: { type: String, required: true },
  lastNumber: { type: Number, default: 0 },
  lastUserId: { type: String, default: null },
  streak: { type: Number, default: 0 },
  topCounters: [{
    userId: String,
    count: Number
  }]
}, { timestamps: true });

// Ensure unique counting config per channel
countingSchema.index({ guildId: 1, channelId: 1 }, { unique: true });

export default mongoose.model('Counting', countingSchema);
