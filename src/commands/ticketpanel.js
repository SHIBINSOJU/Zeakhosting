import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } from 'discord.js';
import config from '../utils/config.js';

export default {
  name: 'ticketpanel',
  description: 'Sends the ticket panel',
  async execute(message, args, client) {
    try {
      // 1. Permission Check
      const hasStaffRole = message.member.roles.cache.has(config.STAFF_ROLE_ID);
      const isAdmin = message.member.permissions.has(PermissionFlagsBits.Administrator);

      if (!hasStaffRole && !isAdmin) {
        return message.reply({ content: '❌ You do not have permission to use this command.' });
      }

      // 2. Build the Embed
      const embed = new EmbedBuilder()
        .setTitle('ZeakCloud - Ticket System')
        .setDescription(
          '**Need Help?**\nClick the button that best matches your inquiry below to open a ticket.\n\n' +
          '🆘 **Support** - General help and account issues\n' +
          '🛠️ **Technical** - Server issues and downtime\n' +
          '🤝 **Partnership** - Business inquiries\n' +
          '❓ **Other** - Everything else'
        )
        // Handle servers with no icon to prevent crashes
        .setThumbnail(message.guild.iconURL() || null) 
        .setColor('#FF0000')
        .setFooter({ text: '© ZeakCloud • Powered by ShotDevs' });

      // 3. Build the Buttons (ActionRow)
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('create_ticket_support')
            .setLabel('Support')
            .setEmoji('🆘')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('create_ticket_technical')
            .setLabel('Technical')
            .setEmoji('🛠️')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('create_ticket_partnership')
            .setLabel('Partnership')
            .setEmoji('🤝')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('create_ticket_other')
            .setLabel('Other')
            .setEmoji('❓')
            .setStyle(ButtonStyle.Secondary),
        );

      // 4. Find the Channel (Use fetch for reliability)
      const channelId = config.TICKET_PANEL_CHANNEL_ID || message.channel.id;
      
      // Fetch ensures we get the channel even if not cached
      const channel = await client.channels.fetch(channelId).catch(() => null);

      if (!channel) {
        return message.reply(`❌ Could not resolve the ticket panel channel (<#${channelId}>).`);
      }

      // 5. Send the Panel
      await channel.send({ embeds: [embed], components: [row] });

      // 6. Confirmation & Cleanup
      if (channelId !== message.channel.id) {
        const confirmMsg = await message.reply(`✅ Ticket panel sent to <#${channelId}>.`);
        setTimeout(() => confirmMsg.delete().catch(() => {}), 5000);
      }
      
      // Delete the command usage message
      await message.delete().catch(() => {});

    } catch (error) {
      console.error('Error sending ticket panel:', error);
      message.reply('An error occurred while sending the panel. Check console for details.');
    }
  },
};
