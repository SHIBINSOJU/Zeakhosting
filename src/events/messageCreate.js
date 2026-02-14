const { Events, PermissionsBitField } = require('discord.js');
require('dotenv').config();

const prefix = process.env.PREFIX || '!';

module.exports = {
  name: Events.MessageCreate,
  async execute(message, client) {
    // Ignore bots, DMs, and messages without prefix
    if (message.author.bot || !message.guild || !message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    // Check if command exists
    const command = client.commands.get(commandName);
    if (!command) return;

    try {
      await command.execute(message, args);
    } catch (error) {
      console.error(error);
      // In production, you might not want to reply with the error
    }
  },
};
