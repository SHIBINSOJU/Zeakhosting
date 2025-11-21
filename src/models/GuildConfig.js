import mongoose from 'mongoose';

const guildConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  staffRoleIds: { type: [String], default: [] },
  ticketCategories: {
    support: { type: String, default: null }, // Category ID
    issues: { type: String, default: null },
    partnership: { type: String, default: null },
    other: { type: String, default: null },
  },
  ticketLogChannelId: { type: String, default: null },
  ticketCloseDelaySeconds: { type: Number, default: 5 },

  countingChannelIds: { type: [String], default: [] },
  countingEmoji: { type: String, default: '✅' },
  deleteWrongMessages: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model('GuildConfig', guildConfigSchema);
