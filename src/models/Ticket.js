import mongoose from 'mongoose';

const ticketSchema = new mongoose.Schema({
  ticketId: { type: String, required: true }, // Could be channel ID or incremental
  guildId: { type: String, required: true },
  channelId: { type: String, required: true },
  creatorId: { type: String, required: true },
  type: { type: String, enum: ['support', 'issues', 'partnership', 'other'], required: true },
  status: { type: String, enum: ['open', 'closed'], default: 'open' },
  claimedBy: { type: String, default: null }, // User ID of staff
  transcriptUrl: { type: String, default: null },
  closedAt: { type: Date, default: null },
}, { timestamps: true });

// Compound index for efficient lookup
ticketSchema.index({ guildId: 1, ticketId: 1 });

export default mongoose.model('Ticket', ticketSchema);
