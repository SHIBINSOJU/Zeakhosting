const { PermissionsBitField } = require('discord.js');

module.exports = {
  name: 'say',
  async execute(message, args) {
    // Check for Administrator permission
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return; // Silently fail or send a message. Requirements say "Admin-only".
    }

    // Join args to form the message
    const sayMessage = args.join(' ');

    // Block empty messages
    if (!sayMessage) {
      return;
    }

    // Prevent @everyone and @here abuse
    const cleanMessage = sayMessage.replace(/@(everyone|here)/g, '@\u200b$1');

    try {
      // Delete the original command message
      await message.delete();

      // Send the message
      await message.channel.send(cleanMessage);
    } catch (err) {
      console.error('Error in say command:', err);
    }
  },
};
