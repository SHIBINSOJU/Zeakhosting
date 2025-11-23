import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } from 'discord.js';
import config from '../utils/config.js';

export default {
  name: 'ticketpanel',
  description: 'Sends the ticket panel',
  async execute(message, args, client) {
    // Check permissions
    const hasStaffRole = message.member.roles.cache.has(config.STAFF_ROLE_ID);
    const isAdmin = message.member.permissions.has(PermissionFlagsBits.Administrator);

    if (!hasStaffRole && !isAdmin) {
      return message.reply({ content: 'You do not have permission to use this command.' });
    }

    const embed = new EmbedBuilder()
      .setTitle('ZeakCloud - TicketSystem')
      .setDescription(
        'Need Help? Open a ticket by Selecting Categories below!\n' +
        'We are ready to help you.'
      )
      .setThumbnail(message.guild.iconURL())
      .setColor('#FF0000')
      .setFooter({ text: '© ShotDevs' });

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

    const channelId = config.TICKET_PANEL_CHANNEL_ID || message.channel.id;
    const channel = client.channels.cache.get(channelId);

    if (!channel) {
      return message.reply(`Could not find the ticket panel channel (${channelId}).`);
    }

    await channel.send({ embeds: [embed], components: [row] });

    if (channelId !== message.channel.id) {
      await message.reply(`Ticket panel sent to <#${channelId}>.`);
    } else {
      try { await message.delete(); } catch (e) {}
    }
  },
};
