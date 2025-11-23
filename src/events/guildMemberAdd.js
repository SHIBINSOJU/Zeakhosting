// src/events/guildMemberAdd.js
import { Events, AttachmentBuilder, EmbedBuilder } from 'discord.js';
import { createCanvas, loadImage } from 'canvas';
import config from '../utils/config.js';

export default {
  name: Events.GuildMemberAdd,
  once: false,
  async execute(member) {
    try {
      const guild = member.guild;

      // =========================
      // AUTO ROLE ON JOIN
      // =========================
      if (config.AUTO_ROLE_ID) {
        const role = guild.roles.cache.get(config.AUTO_ROLE_ID);
        if (role) {
          try {
            await member.roles.add(role, 'Auto role on join');
          } catch (e) {
            console.error('Failed to give auto role:', e);
          }
        }
      }

      // =========================
      // WELCOME MESSAGE + CARD
      // =========================
      if (!config.WELCOME_ENABLED) return;

      const channel = guild.channels.cache.get(config.WELCOME_CHANNEL_ID);
      if (!channel) return;

      const memberCount = guild.memberCount;

      // ---- Create welcome card image with canvas ----
      const width = 900;
      const height = 300;
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');

      // Background from URL (or fallback)
      const bgUrl =
        config.WELCOME_BACKGROUND_URL ||
        'https://i.imgur.com/4M7IWwP.png'; // simple fallback image

      const background = await loadImage(bgUrl);
      ctx.drawImage(background, 0, 0, width, height);

      // Dark overlay for readability
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, width, height);

      // User avatar (circle)
      const avatar = await loadImage(
        member.user.displayAvatarURL({ extension: 'png', size: 256 })
      );

      const avatarSize = 140;
      const avatarX = 80;
      const avatarY = height / 2 - avatarSize / 2;

      ctx.save();
      ctx.beginPath();
      ctx.arc(
        avatarX + avatarSize / 2,
        avatarY + avatarSize / 2,
        avatarSize / 2,
        0,
        Math.PI * 2
      );
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
      ctx.restore();

      // Text
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';

      ctx.font = 'bold 38px Sans';
      ctx.fillText('Welcome to ZeakCloud', 260, 130);

      ctx.font = '30px Sans';
      ctx.fillText(member.user.tag, 260, 175);

      ctx.font = '22px Sans';
      ctx.fillText(`You are member #${memberCount}`, 260, 215);

      const attachment = new AttachmentBuilder(canvas.toBuffer(), {
        name: 'welcome.png',
      });

      // ---- Welcome embed ----
      const embed = new EmbedBuilder()
        .setTitle('☁️ Welcome to ZeakCloud!')
        .setDescription(
          [
            `Hey ${member}, we're excited to have you here!`,
            '',
            '🚀 **Get Started:**',
            '• Open a ticket if you need help',
            '• Read the rules to keep things clean',
            '• Say hi in chat and meet the community!',
          ].join('\n')
        )
        .setColor('#00A3FF')
        .setThumbnail(guild.iconURL({ size: 256 }))
        .setImage('attachment://welcome.png')
        .setFooter({ text: `Member #${memberCount}` });

      await channel.send({ embeds: [embed], files: [attachment] });
    } catch (err) {
      console.error('Welcome system error:', err);
    }
  },
};
