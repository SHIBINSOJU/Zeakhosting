import { Events } from 'discord.js';
import config from '../utils/config.js';
import Counter from '../models/Counter.js';

export default {
  name: Events.MessageCreate,
  async execute(message, client) {
    if (message.author.bot) return;

    // --- ECHO SYSTEM ---
    if (config.ECHO_ENABLED) {
        const shouldEcho = !config.ECHO_CHANNEL_ID || message.channel.id === config.ECHO_CHANNEL_ID;
        const isCommand = message.content.startsWith(config.PREFIX);

        if (shouldEcho && !isCommand) {
            try {
                await message.reply({ content: message.content });
            } catch (e) {
                console.error("Failed to echo message:", e);
            }
            // If echo is handled, we might want to stop processing other logic?
            // The prompt implies echo is a separate system.
            // However, if the message is also in the counting channel, we have a conflict?
            // Usually counting channel is dedicated. Let's assume they are distinct or echo doesn't apply to numbers if logic forbids.
            // But the prompt says "Reply by sending back the exact same content... No extra text".
            // If the counting channel *is* the echo channel, that would be chaos.
            // I'll assume they are configured separately or the user accepts the chaos.
        }
    }

    // --- COUNTING SYSTEM ---
    if (message.channel.id === config.COUNTING_CHANNEL_ID) {
        const inputNumber = parseInt(message.content, 10);

        // 2) Parse parsing
        if (isNaN(inputNumber) || String(inputNumber) !== message.content.trim()) {
            // "If it is not a valid integer, treat as wrong and handle accordingly."
            // Usually strict counting bots delete non-numbers or chat.
            // "Respond... Delete their message... Do NOT update currentNumber."
            // The prompt says "If it is not a valid integer, treat as wrong".
            // I will treat it as wrong number logic but tailored for NaN.
            await handleWrongCount(message, `That doesn't look like a valid number!`);
            return;
        }

        // Fetch DB State
        let counter = await Counter.findOne({ guildId: message.guild.id });

        // INITIALIZATION if missing
        if (!counter) {
            counter = new Counter({
                guildId: message.guild.id,
                channelId: message.channel.id,
                currentNumber: config.COUNTING_START_NUMBER,
                lastUserId: null
            });
            await counter.save();
        }

        // 3) Check "one message in a row"
        if (counter.lastUserId === message.author.id) {
            await handleOneUserRow(message);
            return;
        }

        // 4) Check number correctness
        if (inputNumber === counter.currentNumber) {
            // Correct
            await message.react('✅');
            counter.currentNumber += 1;
            counter.lastUserId = message.author.id;
            await counter.save();
        } else {
            // Wrong
            await handleWrongCount(message, `Wrong number! The next correct number is ${counter.currentNumber}.`);
        }
        return; // Don't process commands in counting channel? usually safe to return.
    }

    // --- COMMAND HANDLER ---
    if (message.content.startsWith(config.PREFIX)) {
      const args = message.content.slice(config.PREFIX.length).trim().split(/ +/);
      const commandName = args.shift().toLowerCase();

      const command = client.commands.get(commandName);
      if (command) {
        try {
          await command.execute(message, args, client);
        } catch (error) {
          console.error(error);
          await message.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
      }
    }
  },
};

// Helper for Wrong Count
async function handleWrongCount(message, text) {
    try {
        const reply = await message.reply({ content: text }); // "Simulate ephemerals"
        await message.delete();
        setTimeout(() => {
            reply.delete().catch(() => {});
        }, 3000); // "short delay"
    } catch (e) {
        console.error("Failed to handle wrong count:", e);
    }
}

// Helper for One User Row
async function handleOneUserRow(message) {
    try {
        const reply = await message.reply({ content: "You can't count twice in a row. Wait for someone else." });
        await message.delete();
        setTimeout(() => {
            reply.delete().catch(() => {});
        }, 3000);
    } catch (e) {
        console.error("Failed to handle one user row:", e);
    }
}
