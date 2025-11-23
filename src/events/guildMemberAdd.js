// src/events/guildMemberAdd.js
import { Events, AttachmentBuilder, EmbedBuilder } from 'discord.js';
import { createCanvas, loadImage } from 'canvas';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../utils/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  name: Events.GuildMemberAdd,
  once: false,
  async execute(member, client) {
    try {
      if (!config.WELCOME_ENABLED) return;

      const channel = member.guild.channels.cache.get(config.WELCOME_CHANNEL_ID);
      if (!channel) return;

      const guild = member.guild;
      const memberNumber = guild.memberCount;

      // ===== 1. Build welcome card image with canvas =====
      const width = 1000;
      const height = 400;
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');

      // Background
      const bgPath = path.join(__dirname, '..', 'assets', 'welcome-bg.png');
      const background = await loadImage(bgPath);
      ctx.drawImage(background, 0, 0, width, height);

      // Dark overlay for readability
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(0, 0, width, height);

      // Avatar (circle)
      const avatar = await loadImage(
        member.user.displayAvatarURL({ extension: 'png', size: 256 })
      );
      const avatarSize = 150;
      const avatarX = 120;
      const avatarY = height / 2 - avatarSize / 2;

      ctx.save();
      ctx.beginPath();
      ctx.arc(
        avatarX + avatarSize / 2,
        avatarY + avatarSize / 2,
        avatarSize / 2,
        0,
        Math.PI * 2,
        true
      );
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
      ctx.restore();

      // Text styles
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'left';

      // Main title
      ctx.font = 'bold 42px Sans';
      ctx.fillText('Welcome to ZeakCloud', 320, 180);

      // Username
      ctx.font = 'bold 36px Sans';
      ctx.fillText(member.user.tag, 320, 230);

      // Subtitle
      ctx.font = '24px Sans';
      ctx.fillText(`You are member #${memberNumber}`, 320, 270);

      // Convert to buffer & attachment
      const buffer = canvas.toBuffer('image/png');
      const attachment = new AttachmentBuilder(buffer, { name: 'welcome-card.png' });

      // ===== 2. Build welcome embed =====
      const embed = new EmbedBuilder()
        .setTitle('☁️ Welcome to ZeakCloud!')
        .setDescription(
          [
            `Hey ${member}, we're excited to have you here!`,
            '',
            '🚀 **Get Started:**',
            '• Open a ticket in the support channel if you need help',
            '• Read the rules to keep the community clean',
            '• Say hi in chat and meet the community!',
          ].join('\n')
        )
        .setThumbnail(guild.iconURL({ size: 256 }))
        .setColor('#00A3FF') // cloud/hosting blue
        .setFooter({ text: `You are member #${memberNumber}` });

      // ===== 3. Send embed + card =====
      await channel.send({
        embeds: [embed],
        files: [attachment],
      });
    } catch (err) {
      console.error('Error in guildMemberAdd welcome handler:', err);
    }
  },
};
