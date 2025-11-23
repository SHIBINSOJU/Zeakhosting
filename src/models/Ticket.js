// src/models/Ticket.js
import mongoose from 'mongoose';

const ticketSchema = new mongoose.Schema({
  // ticketId exists because your Mongo collection already has a unique index on "ticketId_1".
  // We simply mirror channelId into ticketId so the index stays happy.
  ticketId: {
    type: String,
    unique: true,      // uses existing unique index ticketId_1
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

// Before saving, if ticketId is empty, copy channelId into it.
// This makes sure the existing unique index on ticketId never sees "null".
ticketSchema.pre('save', function (next) {
  if (!this.ticketId && this.channelId) {
    this.ticketId = this.channelId;
  }
  next();
});

export default mongoose.model('Ticket', ticketSchema);
