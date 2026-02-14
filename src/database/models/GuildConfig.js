const mongoose = require('mongoose');

const GuildConfigSchema = new mongoose.Schema({
  guildId: {
    type: String,
    required: true,
    unique: true,
  },
  welcome: {
    enabled: {
      type: Boolean,
      default: false,
    },
    channelId: {
      type: String,
      default: null,
    },
    background: {
      type: String,
      default: 'src/assets/welcome-bg.png',
    },
  },
  autoRole: {
    enabled: {
      type: Boolean,
      default: false,
    },
    roleId: {
      type: String,
      default: null,
    },
  },
});

module.exports = mongoose.model('GuildConfig', GuildConfigSchema);
