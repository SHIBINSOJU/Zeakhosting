import {
  Events,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  AttachmentBuilder,
} from 'discord.js';
import config from '../utils/config.js';
import Ticket from '../models/Ticket.js';

export default {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    if (!interaction.isButton()) return;

    const { customId, guild, user, member } = interaction;

    // =========================
    // CREATE TICKET HANDLER
    // =========================
    if (customId.startsWith('create_ticket_')) {
      const categoryType = customId.replace('create_ticket_', '');
      let categoryId;

      switch (categoryType) {
        case 'support': categoryId = config.TICKET_CATEGORY_SUPPORT_ID; break;
        case 'technical': categoryId = config.TICKET_CATEGORY_TECHNICAL_ID; break;
        case 'partnership': categoryId = config.TICKET_CATEGORY_PARTNERSHIP_ID; break;
        case 'other': categoryId = config.TICKET_CATEGORY_OTHER_ID; break;
        default: return;
      }

      if (!categoryId) {
        return interaction.reply({ content: 'Configuration error: Ticket category not found.', ephemeral: true });
      }

      const ticketName = `${categoryType}-${user.username}-${user.discriminator || user.id.slice(-4)}`;

      try {
        const channel = await guild.channels.create({
          name: ticketName,
          type: ChannelType.GuildText,
          parent: categoryId,
          permissionOverwrites: [
            {
              id: guild.id,
              deny: [PermissionFlagsBits.ViewChannel],
            },
            {
              id: user.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
              ],
            },
            {
              id: config.STAFF_ROLE_ID,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
              ],
            },
            {
              id: client.user.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
              ],
            },
          ],
        });

        const newTicket = new Ticket({
          channelId: channel.id,
          guildId: guild.id,
          creatorId: user.id,
          category: categoryType,
        });

        await newTicket.save();

        const embed = new EmbedBuilder()
          .setTitle(`Ticket created - ${categoryType.charAt(0).toUpperCase() + categoryType.slice(1)}`)
          .setDescription(
            `Hello ${user}, thanks for opening a ticket.\nA staff member <@&${config.STAFF_ROLE_ID}> will be with you shortly.`
          )
          .setThumbnail(guild.iconURL())
          .setColor('#00FF00')
          .setFooter({ text: '© ShotDevs' });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('ticket_claim')
            .setLabel('Claim')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('ticket_close')
            .setLabel('Close')
            .setStyle(ButtonStyle.Danger)
        );

        await channel.send({
          content: `${user} <@&${config.STAFF_ROLE_ID}>`,
          embeds: [embed],
          components: [row],
        });

        return interaction.reply({ content: `Ticket created: ${channel}`, ephemeral: true });

      } catch (error) {
        console.error('Error while creating ticket:', error);
        return interaction.reply({
          content: 'Ticket channel was created but failed to save in database.',
          ephemeral: true,
        });
      }
    }

    // =========================
    // CLAIM TICKET HANDLER
    // =========================
    if (customId === 'ticket_claim') {
      if (!member.roles.cache.has(config.STAFF_ROLE_ID)) {
        return interaction.reply({ content: 'Only staff can claim tickets.', ephemeral: true });
      }

      const ticket = await Ticket.findOne({ channelId: interaction.channelId });

      if (!ticket) {
        return interaction.reply({ content: 'Ticket data not found in database.', ephemeral: true });
      }

      if (ticket.claimedBy) {
        return interaction.reply({ content: `Ticket already claimed by <@${ticket.claimedBy}>.`, ephemeral: true });
      }

      ticket.claimedBy = user.id;
      await ticket.save();

      const embed = new EmbedBuilder()
        .setDescription(`✅ Ticket claimed by ${user}`)
        .setColor('#FFFF00')
        .setFooter({ text: '© ShotDevs' });

      await interaction.channel.send({ embeds: [embed] });

      return interaction.reply({ content: 'You claimed this ticket.', ephemeral: true });
    }

    // =========================
    // CLOSE TICKET HANDLER (FIXED ✅)
    // =========================
    if (customId === 'ticket_close') {
      if (!member.roles.cache.has(config.STAFF_ROLE_ID)) {
        return interaction.reply({ content: 'Only staff can close tickets.', ephemeral: true });
      }

      // ✅ Acknowledge immediately so Discord doesn't show "interaction failed"
      await interaction.deferReply({ ephemeral: true });

      const ticket = await Ticket.findOne({ channelId: interaction.channelId });

      let transcriptText = `TRANSCRIPT for ${interaction.channel.name}\n`;
      transcriptText += `Category: ${ticket ? ticket.category : 'Unknown'}\n`;
      transcriptText += `Closed by: ${user.tag} (${user.id})\n`;
      transcriptText += `Date: ${new Date().toISOString()}\n\n`;

      const messages = await interaction.channel.messages.fetch({ limit: 100 });
      const sortedMessages = messages.reverse();

      sortedMessages.forEach(msg => {
        transcriptText += `[${msg.createdAt.toISOString()}] ${msg.author.tag}: ${msg.content}\n`;
        if (msg.attachments.size > 0) {
          transcriptText += `[Attachments]: ${msg.attachments.map(a => a.url).join(', ')}\n`;
        }
      });

      const attachment = new AttachmentBuilder(
        Buffer.from(transcriptText, 'utf-8'),
        { name: `transcript-${interaction.channel.name}.txt` }
      );

      const logChannel = client.channels.cache.get(config.TICKET_LOG_CHANNEL_ID);

      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setTitle('Ticket closed')
          .setDescription(
            `Ticket: ${interaction.channel.name}\nCreator: <@${ticket?.creatorId}>\nCloser: ${user}\nCategory: ${ticket?.category}`
          )
          .setColor('#FF0000')
          .setTimestamp()
          .setFooter({ text: '© ShotDevs' });

        await logChannel.send({ embeds: [logEmbed], files: [attachment] });
      }

      if (ticket?.creatorId) {
        try {
          const creator = await client.users.fetch(ticket.creatorId);
          await creator.send({
            content: `Your ticket ${interaction.channel.name} has been closed.`,
            files: [attachment],
          });
        } catch {
          console.warn('Could not DM ticket creator.');
        }
      }

      if (ticket) {
        ticket.closed = true;
        await ticket.save();
      }

      if (ticket?.creatorId) {
        await interaction.channel.permissionOverwrites.edit(ticket.creatorId, {
          SendMessages: false,
        });
      }

      await interaction.editReply({
        content: '✅ Ticket closed. Channel will be deleted in 5 seconds.',
      });

      setTimeout(() => {
        interaction.channel.delete().catch(console.error);
      }, 5000);
    }
  },
};
