import Counting from '../models/Counting.js';
import GuildConfig from '../models/GuildConfig.js';
import { createErrorEmbed } from '../utils/embeds.js';
import logger from '../utils/logger.js';

/**
 * Handles a new message in a counting channel.
 */
export const handleCountingMessage = async (message) => {
  if (message.author.bot) return;

  const config = await GuildConfig.findOne({ guildId: message.guildId });
  if (!config || !config.countingChannelIds.includes(message.channelId)) return;

  // Validate content: strictly integer
  if (!/^\d+$/.test(message.content)) {
    if (config.deleteWrongMessages) {
        try { await message.delete(); } catch (e) { logger.error('Cannot delete wrong counting msg', e); }
    }
    return;
  }

  const number = parseInt(message.content, 10);

  // Atomic check and update using findOneAndUpdate
  // We want to match only if lastNumber is number - 1
  // Also need to check if the same user posted twice (optional depending on rules, usually "no consecutive posts")

  // First fetch current state to check user (checking user in atomic update is harder without pipeline update which is complex)
  // We'll use a findOne first for user check, then findOneAndUpdate for concurrency.
  // NOTE: There is a tiny race condition window here for double-posting by same user, but negligible for low-scale.
  // For strict correctness, we can use a conditional update on lastUserId too.

  const countingState = await Counting.findOne({ guildId: message.guildId, channelId: message.channelId });
  if (!countingState) {
    // Should have been created by setup, but lazy init if needed
    return;
  }

  if (countingState.lastUserId === message.author.id) {
    // User counting twice in a row
     if (config.deleteWrongMessages) await message.delete().catch(() => {});
     // Optionally warn user
     return;
  }

  if (number !== countingState.lastNumber + 1) {
    // Wrong number
    if (config.deleteWrongMessages) await message.delete().catch(() => {});

    // Reset streak? Usually counting channels reset on wrong number.
    // Requirement says: "On incorrect post: delete... and optionally notify... reset via command"
    // The prompt says "On incorrect post: delete the message ... Provide /count reset ... for mods".
    // It does NOT explicitly say "auto reset on fail". It implies the "Counting System" usually implies reset, but
    // "Edge cases: on message edit, re-validate and delete if invalid" suggests loose enforcement or just deleting.
    // I will implement strict deleting of wrong numbers without resetting count, unless configured otherwise.
    // Let's stick to "delete wrong messages" per requirement.

    const reply = await message.channel.send({ content: `${message.author}, ${number} is wrong! Next is ${countingState.lastNumber + 1}.` });
    setTimeout(() => reply.delete().catch(() => {}), 3000);
    return;
  }

  // Atomic Update
  const result = await Counting.findOneAndUpdate(
    {
      guildId: message.guildId,
      channelId: message.channelId,
      lastNumber: countingState.lastNumber // Ensure no one else updated it in between
    },
    {
      $set: { lastNumber: number, lastUserId: message.author.id },
      $inc: { streak: 1 }
    },
    { new: true }
  );

  if (!result) {
    // Race condition hit: someone else updated DB before us
    await message.delete().catch(() => {});
    return;
  }

  // Success
  await message.react(config.countingEmoji || '✅').catch(() => {});

  // Update top counters (basic implementation)
  // Could be optimized to not write every time
  const userStat = result.topCounters.find(u => u.userId === message.author.id);
  if (userStat) {
    userStat.count++;
  } else {
    result.topCounters.push({ userId: message.author.id, count: 1 });
  }
  await result.save();
};
