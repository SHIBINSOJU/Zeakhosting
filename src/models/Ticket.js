import mongoose from 'mongoose';

const ticketSchema = new mongoose.Schema({
  channelId: { type: String, required: true, unique: true },
  guildId: { type: String, required: true },
  creatorId: { type: String, required: true },
  claimedBy: { type: String, default: null },
  category: { type: String, required: true }, // 'support', 'technical', 'partnership', 'other'
  createdAt: { type: Date, default: Date.now },
  closed: { type: Boolean, default: false },
});

export default mongoose.model('Ticket', ticketSchema);
