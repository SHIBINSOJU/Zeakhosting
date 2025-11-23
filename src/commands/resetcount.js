import { PermissionFlagsBits } from 'discord.js';
import config from '../utils/config.js';
import Counter from '../models/Counter.js';

export default {
  name: 'resetcount',
  description: 'Resets the counting system for the guild.',
  async execute(message, args, client) {
    // Check permissions
    const hasStaffRole = message.member.roles.cache.has(config.STAFF_ROLE_ID);
    const isAdmin = message.member.permissions.has(PermissionFlagsBits.Administrator);

    if (!hasStaffRole && !isAdmin) {
      return message.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }

    try {
      let counter = await Counter.findOne({ guildId: message.guild.id });

      if (!counter) {
        counter = new Counter({
            guildId: message.guild.id,
            channelId: config.COUNTING_CHANNEL_ID, // Should match where we want it
        });
      }

      counter.currentNumber = config.COUNTING_START_NUMBER;
      counter.lastUserId = null;
      await counter.save();

      await message.reply(`The counting system has been reset to **${config.COUNTING_START_NUMBER}**.`);
    } catch (error) {
      console.error(error);
      await message.reply('Failed to reset the counter.');
    }
  },
};
