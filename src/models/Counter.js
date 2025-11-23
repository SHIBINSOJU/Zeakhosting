import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  channelId: { type: String, required: true },
  currentNumber: { type: Number, default: 1 },
  lastUserId: { type: String, default: null },
});

export default mongoose.model('Counter', counterSchema);
