// src/models/Ticket.js
import mongoose from 'mongoose';

const ticketSchema = new mongoose.Schema({
  // Existing unique index in DB: ticketId_1
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

  // Reason provided when opening ticket
  reason: {
    type: String,
    default: null,
  },

  // 1–5 rating after close
  rating: {
    type: Number,
    min: 1,
    max: 5,
    default: null,
  },

  ratedAt: {
    type: Date,
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

// Keep ticketId in sync with channelId so the existing unique index is happy
ticketSchema.pre('save', function (next) {
  if (!this.ticketId && this.channelId) {
    this.ticketId = this.channelId;
  }
  next();
});

export default mongoose.model('Ticket', ticketSchema);
