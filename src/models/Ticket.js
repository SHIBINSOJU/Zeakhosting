// src/models/Ticket.js
import mongoose from 'mongoose';

const ticketSchema = new mongoose.Schema({
  // This exists because your Mongo collection already has a unique index: ticketId_1
  // We mirror channelId into ticketId so that index never sees `null`.
  ticketId: {
    type: String,
    unique: true, // matches existing index ticketId_1
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

  createdAt: {
    type: Date,
    default: Date.now,
  },

  closed: {
    type: Boolean,
    default: false,
  },
});

// Before saving, ensure ticketId is set = channelId
ticketSchema.pre('save', function (next) {
  if (!this.ticketId && this.channelId) {
    this.ticketId = this.channelId;
  }
  next();
});

export default mongoose.model('Ticket', ticketSchema);
