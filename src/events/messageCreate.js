import { Events, PermissionFlagsBits } from 'discord.js';
import config from '../utils/config.js';
import Counter from '../models/Counter.js';

export default {
  name: Events.MessageCreate,
  async execute(message, client) {
    // Ignore bots
    if (message.author.bot) return;
    if (!message.guild) return; // ignore DMs

    // =========================
    // STAFF-ONLY SAY / ECHO (server-wide)
    // =========================

    // Echo enabled flag (optional, from env)
    const echoEnabled =
      config.ECHO_ENABLED === undefined ||
      config.ECHO_ENABLED === true ||
      config.ECHO_ENABLED === 'true';

    if (echoEnabled && message.content.toLowerCase().startsWith('say ')) {
      // Staff-only: must have STAFF_ROLE_ID or be admin
      const hasStaffRole =
        config.STAFF_ROLE_ID &&
        message.member?.roles.cache.has(config.STAFF_ROLE_ID);

      const isAdmin = message.member?.permissions.has(
        PermissionFlagsBits.Administrator
      );

      if (!hasStaffRole && !isAdmin) {
        // Not staff/admin → just ignore
        return;
      }

      // Text after "say "
      const text = message.content.slice(4).trim();
      if (!text.length) return;

      // Send echoed message
      await message.channel.send(text);

      // Delete original "say ..." message for clean look
      try {
        await message.delete();
      } catch (e) {
        // ignore if no permission
      }

      // Stop here so counting / commands don't also process it
      return;
    }

    // =========================
    // COUNTING SYSTEM
    // =========================
    if (message.channel.id === config.COUNTING_CHANNEL_ID) {
      const inputNumber = parseInt(message.content, 10);

      // invalid number
      if (isNaN(inputNumber) || String(inputNumber) !== message.content.trim()) {
        await handleWrongCount(message, `That doesn't look like a valid number!`);
        return;
      }

      // Fetch DB state
      let counter = await Counter.findOne({ guildId: message.guild.id });

      // Init if missing
      if (!counter) {
        counter = new Counter({
          guildId: message.guild.id,
          channelId: message.channel.id,
          currentNumber: config.COUNTING_START_NUMBER,
          lastUserId: null,
        });
        await counter.save();
      }

      // One message in a row rule
      if (counter.lastUserId === message.author.id) {
        await handleOneUserRow(message);
        return;
      }

      // Correct number
      if (inputNumber === counter.currentNumber) {
        await message.react('✅');
        counter.currentNumber += 1;
        counter.lastUserId = message.author.id;
        await counter.save();
      } else {
        // Wrong number
        await handleWrongCount(
          message,
          `Wrong number! The next correct number is ${counter.currentNumber}.`
        );
      }

      // Don’t process commands in counting channel
      return;
    }

    // =========================
    // COMMAND HANDLER
    // =========================
    if (message.content.startsWith(config.PREFIX)) {
      const args = message.content.slice(config.PREFIX.length).trim().split(/ +/);
      const commandName = args.shift()?.toLowerCase();
      if (!commandName) return;

      const command = client.commands.get(commandName);
      if (command) {
        try {
          await command.execute(message, args, client);
        } catch (error) {
          console.error(error);
          await message.reply({
            content: 'There was an error while executing this command!',
          });
        }
      }
    }
  },
};

// Helper for Wrong Count
async function handleWrongCount(message, text) {
  try {
    const reply = await message.reply({ content: text });
    await message.delete();
    setTimeout(() => {
      reply.delete().catch(() => {});
    }, 3000);
  } catch (e) {
    console.error('Failed to handle wrong count:', e);
  }
}

// Helper for One User Row
async function handleOneUserRow(message) {
  try {
    const reply = await message.reply({
      content: "You can't count twice in a row. Wait for someone else.",
    });
    await message.delete();
    setTimeout(() => {
      reply.delete().catch(() => {});
    }, 3000);
  } catch (e) {
    console.error('Failed to handle one user row:', e);
  }
}
