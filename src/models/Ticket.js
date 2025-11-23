// src/models/Ticket.js
import mongoose from 'mongoose';

const ticketSchema = new mongoose.Schema({
  // existing unique index in DB: ticketId_1
  ticketId: {
    type: String,
    unique: true,
  },

  channelId: {
    type: String,
    required: true,
    unique: true,
  },

  guildId: {
    type: String,
    required: true,
  },

  creatorId: {
    type: String,
    required: true,
  },

  claimedBy: {
    type: String,
    default: null,
  },

  // 'support', 'technical', 'partnership', 'other'
  category: {
    type: String,
    required: true,
  },

  // ✅ NEW: store reason typed in modal
  reason: {
    type: String,
    default: null,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },

  closed: {
    type: Boolean,
    default: false,
  },
});

// before saving, mirror channelId -> ticketId if missing
ticketSchema.pre('save', function (next) {
  if (!this.ticketId && this.channelId) {
    this.ticketId = this.channelId;
  }
  next();
});

export default mongoose.model('Ticket', ticketSchema);
