import { 
    Events, 
    AttachmentBuilder, 
    ContainerBuilder, 
    TextDisplayBuilder, 
    SectionBuilder, 
    ThumbnailBuilder, 
    SeparatorBuilder, 
    SeparatorSpacingSize, // Import spacing options
    MessageFlags 
} from 'discord.js';
import { createCanvas, loadImage } from 'canvas';
import config from '../utils/config.js';

export default {
  name: Events.GuildMemberAdd,
  once: false,
  async execute(member) {
    try {
      const guild = member.guild;

      // =========================
      // AUTO ROLE
      // =========================
      if (config.AUTO_ROLE_ID) {
        const role = guild.roles.cache.get(config.AUTO_ROLE_ID);
        if (role) await member.roles.add(role).catch(console.error);
      }

      if (!config.WELCOME_ENABLED) return;
      const channel = guild.channels.cache.get(config.WELCOME_CHANNEL_ID);
      if (!channel) return;

      const memberCount = guild.memberCount;

      // =========================
      // 1. GENERATE IMAGE (CANVAS)
      // =========================
      const width = 900;
      const height = 300;
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');

      // Background
      const bgUrl = config.WELCOME_BACKGROUND_URL || 'https://i.imgur.com/4M7IWwP.png';
      const background = await loadImage(bgUrl);
      ctx.drawImage(background, 0, 0, width, height);

      // Overlay
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, width, height);

      // Avatar
      const avatar = await loadImage(member.user.displayAvatarURL({ extension: 'png', size: 256 }));
      const avatarX = 80;
      const avatarY = 80; // Centered vertically approx
      const avatarSize = 140;

      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
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
      ctx.fillText(`Member #${memberCount}`, 260, 215);

      const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'welcome.png' });

      // =========================
      // 2. BUILD COMPONENT V2
      // =========================
      
      const welcomeContainer = new ContainerBuilder()
        .setAccentColor(0x00A3FF) 
        .addContent(
            // --- SECTION 1: HEADER ---
            new SectionBuilder()
                .addContent(
                    new TextDisplayBuilder().setContent(`# ☁️ Welcome, ${member.displayName}!`)
                )
                .setAccessory(
                    new ThumbnailBuilder().setURL(guild.iconURL({ size: 256 }))
                ),

            // --- THE SEPARATOR LINE ---
            // This puts a visible line after the title
            new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(SeparatorSpacingSize.Medium), 

            // --- SECTION 2: BODY TEXT ---
            // This appears after the line, but before the large image attachment
            new TextDisplayBuilder()
                .setContent(
                    `We are excited to have you here.\n` +
                    `### 🚀 Quick Start\n` + 
                    `• Check <#RULES_CHANNEL_ID> for rules\n` +
                    `• Visit <#ROLES_CHANNEL_ID> to customize access`
                ),
            
            // --- SECTION 3: FOOTER ---
            new TextDisplayBuilder()
                .setContent(`User ID: ${member.id}`)
                .setColor('subtext')
        );

      // =========================
      // 3. SEND MESSAGE
      // =========================
      await channel.send({ 
          components: [welcomeContainer], 
          files: [attachment], // The image will display just below the container
          flags: MessageFlags.IsComponentsV2 
      });

    } catch (err) {
      console.error('Welcome error:', err);
    }
  },
};
