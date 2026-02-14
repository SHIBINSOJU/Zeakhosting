const { Events, AttachmentBuilder } = require('discord.js');
const GuildConfig = require('../database/models/GuildConfig');
const { createWelcomeCard } = require('../utils/welcomeCard');
const { assignAutoRole } = require('../utils/autoRole');

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member) {
    try {
      // Fetch server configuration from MongoDB
      const config = await GuildConfig.findOne({ guildId: member.guild.id });
      if (!config) return;

      // Handle Auto Role
      if (config.autoRole && config.autoRole.enabled && config.autoRole.roleId) {
        await assignAutoRole(member, config.autoRole.roleId);
      }

      // Handle Welcome System
      if (config.welcome && config.welcome.enabled && config.welcome.channelId) {
        const welcomeChannel = member.guild.channels.cache.get(config.welcome.channelId);

        if (welcomeChannel) {
          const cardBuffer = await createWelcomeCard(member, config.welcome.background);
          const attachment = new AttachmentBuilder(cardBuffer, { name: 'welcome-image.png' });

          await welcomeChannel.send({
            content: `Welcome to the server, ${member}!`,
            files: [attachment]
          });
        }
      }
    } catch (err) {
      console.error('Error in guildMemberAdd event:', err);
    }
  },
};
