// src/events/interactionCreate.js
import {
  Events,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  AttachmentBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import config from '../utils/config.js';
import Ticket from '../models/Ticket.js';

export default {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    // =========================
    // BUTTON INTERACTIONS
    // =========================
    if (interaction.isButton()) {
      const { customId, guild, user, member, channel } = interaction;

      // ---------- CREATE TICKET BUTTONS (open modal) ----------
      if (customId.startsWith('create_ticket_')) {
        const categoryType = customId.replace('create_ticket_', '');

        const modal = new ModalBuilder()
          .setCustomId(`ticket_modal_${categoryType}`)
          .setTitle('Create a ticket');

        const reasonInput = new TextInputBuilder()
          .setCustomId('ticket_reason')
          .setLabel('Describe your issue')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1000)
          .setPlaceholder('Example: My server is offline / I need help with billing / etc.');

        const row = new ActionRowBuilder().addComponents(reasonInput);
        modal.addComponents(row);

        return interaction.showModal(modal);
      }

      // ---------- CLAIM TICKET BUTTON ----------
      if (customId === 'ticket_claim') {
        if (!member?.roles.cache.has(config.STAFF_ROLE_ID)) {
          return interaction.reply({ content: 'Only staff can claim tickets.', ephemeral: true });
        }

        const ticket = await Ticket.findOne({ channelId: channel.id });

        if (!ticket) {
          return interaction.reply({ content: 'Ticket data not found in database.', ephemeral: true });
        }

        if (ticket.claimedBy) {
          return interaction.reply({
            content: `Ticket already claimed by <@${ticket.claimedBy}>.`,
            ephemeral: true,
          });
        }

        ticket.claimedBy = user.id;
        await ticket.save();

        const embed = new EmbedBuilder()
          .setDescription(`✅ Ticket claimed by ${user}`)
          .setColor('#FFFF00')
          .setFooter({ text: '© ShotDevs' });

        await channel.send({ embeds: [embed] });

        return interaction.reply({ content: 'You claimed this ticket.', ephemeral: true });
      }

      // ---------- CLOSE TICKET BUTTON ----------
      if (customId === 'ticket_close') {
        if (!member?.roles.cache.has(config.STAFF_ROLE_ID)) {
          return interaction.reply({ content: 'Only staff can close tickets.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        const ticket = await Ticket.findOne({ channelId: channel.id });

        let transcriptText = `TRANSCRIPT for ${channel.name}\n`;
        transcriptText += `Category: ${ticket ? ticket.category : 'Unknown'}\n`;
        transcriptText += `Reason: ${ticket?.reason || 'Not provided'}\n`;
        transcriptText += `Closed by: ${user.tag} (${user.id})\n`;
        transcriptText += `Date: ${new Date().toISOString()}\n\n`;

        const messages = await channel.messages.fetch({ limit: 100 });
        const sortedMessages = messages.reverse();

        sortedMessages.forEach(msg => {
          transcriptText += `[${msg.createdAt.toISOString()}] ${msg.author.tag}: ${msg.content}\n`;
          if (msg.attachments.size > 0) {
            transcriptText += `[Attachments]: ${msg.attachments.map(a => a.url).join(', ')}\n`;
          }
        });

        const attachment = new AttachmentBuilder(
          Buffer.from(transcriptText, 'utf-8'),
          { name: `transcript-${channel.name}.txt` }
        );

        // Log to log channel
        const logChannel = client.channels.cache.get(config.TICKET_LOG_CHANNEL_ID);

        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setTitle('Ticket closed')
            .setDescription(
              `Ticket: ${channel.name}\n` +
              `Creator: <@${ticket?.creatorId}>\n` +
              `Closer: ${user}\n` +
              `Category: ${ticket?.category}\n` +
              `Reason: ${ticket?.reason || 'Not provided'}`
            )
            .setColor('#FF0000')
            .setTimestamp()
            .setFooter({ text: '© ShotDevs' });

          await logChannel.send({ embeds: [logEmbed], files: [attachment] });
        }

        // DM user with transcript + rating UI
        if (ticket?.creatorId) {
          try {
            const creator = await client.users.fetch(ticket.creatorId);

            const ratingRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`ticket_rate_1_${channel.id}`)
                .setLabel('1 ⭐')
                .setStyle(ButtonStyle.Danger),
              new ButtonBuilder()
                .setCustomId(`ticket_rate_2_${channel.id}`)
                .setLabel('2 ⭐')
                .setStyle(ButtonStyle.Danger),
              new ButtonBuilder()
                .setCustomId(`ticket_rate_3_${channel.id}`)
                .setLabel('3 ⭐')
                .setStyle(ButtonStyle.Secondary),
              new ButtonBuilder()
                .setCustomId(`ticket_rate_4_${channel.id}`)
                .setLabel('4 ⭐')
                .setStyle(ButtonStyle.Success),
              new ButtonBuilder()
                .setCustomId(`ticket_rate_5_${channel.id}`)
                .setLabel('5 ⭐')
                .setStyle(ButtonStyle.Success),
            );

            const rateEmbed = new EmbedBuilder()
              .setTitle('🎫 Ticket Experience')
              .setDescription(
                `Your ticket **${channel.name}** has been closed.\n` +
                'Please rate your experience for this ticket.\n' +
                'Choose a rating from **1 (Poor)** to **5 (Excellent)** below.'
              )
              .setColor('#FF0000')
              .setFooter({ text: 'ZeakCloud Support System' });

            await creator.send({
              embeds: [rateEmbed],
              files: [attachment],
              components: [ratingRow],
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
          await channel.permissionOverwrites.edit(ticket.creatorId, {
            SendMessages: false,
          });
        }

        await interaction.editReply({
          content: '✅ Ticket closed. Channel will be deleted in 5 seconds.',
        });

        setTimeout(() => {
          channel.delete().catch(console.error);
        }, 5000);

        return;
      }

      // ---------- TICKET RATING BUTTONS ----------
      if (customId.startsWith('ticket_rate_')) {
        // customId format: ticket_rate_<score>_<channelId>
        const parts = customId.split('_'); // ['ticket', 'rate', '<score>', '<channelId>']
        const score = parseInt(parts[2], 10);
        const ticketChannelId = parts[3];

        if (isNaN(score) || score < 1 || score > 5) {
          return interaction.reply({
            content: 'Invalid rating.',
            ephemeral: true,
          });
        }

        const ticket = await Ticket.findOne({ channelId: ticketChannelId });

        if (!ticket) {
          return interaction.reply({
            content: 'Could not find ticket data for this rating.',
            ephemeral: true,
          });
        }

        // Only ticket creator can rate
        if (interaction.user.id !== ticket.creatorId) {
          return interaction.reply({
            content: 'Only the ticket creator can rate this ticket.',
            ephemeral: true,
          });
        }

        // Prevent multiple ratings
        if (ticket.rating !== null) {
          return interaction.reply({
            content: `You already rated this ticket **${ticket.rating}/5**. Thanks!`,
            ephemeral: true,
          });
        }

        ticket.rating = score;
        ticket.ratedAt = new Date();
        await ticket.save();

        const logChannel = client.channels.cache.get(config.TICKET_LOG_CHANNEL_ID);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setTitle('Ticket reviewed')
            .setDescription(
              `Ticket channel ID: \`${ticket.channelId}\`\n` +
              `User: <@${ticket.creatorId}> (${ticket.creatorId})\n` +
              `Rating: **${score}/5**`
            )
            .setColor('#00FF00')
            .setTimestamp()
            .setFooter({ text: '© ShotDevs' });

          await logChannel.send({ embeds: [logEmbed] });
        }

        return interaction.reply({
          content: `Thanks for your feedback! You rated this ticket **${score}/5** ✅`,
          ephemeral: true,
        });
      }

      return;
    }

    // =========================
    // MODAL SUBMITS (REASON)
    // =========================
    if (interaction.isModalSubmit()) {
      const { customId, guild, user } = interaction;

      if (!customId.startsWith('ticket_modal_')) return;

      const categoryType = customId.replace('ticket_modal_', '');

      let categoryId;
      switch (categoryType) {
        case 'support': categoryId = config.TICKET_CATEGORY_SUPPORT_ID; break;
        case 'technical': categoryId = config.TICKET_CATEGORY_TECHNICAL_ID; break;
        case 'partnership': categoryId = config.TICKET_CATEGORY_PARTNERSHIP_ID; break;
        case 'other': categoryId = config.TICKET_CATEGORY_OTHER_ID; break;
        default: return;
      }

      if (!categoryId) {
        return interaction.reply({
          content: 'Configuration error: Ticket category not found.',
          ephemeral: true,
        });
      }

      const reason = interaction.fields.getTextInputValue('ticket_reason');

      // Limit: one open ticket per user per guild
      const existingTicket = await Ticket.findOne({
        guildId: guild.id,
        creatorId: user.id,
        closed: false,
      });

      if (existingTicket) {
        const existingChannel = guild.channels.cache.get(existingTicket.channelId);
        if (existingChannel) {
          return interaction.reply({
            content: `You already have an open ticket: ${existingChannel}`,
            ephemeral: true,
          });
        } else {
          existingTicket.closed = true;
          await existingTicket.save();
        }
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
          reason,
        });

        await newTicket.save();

        const categoryName =
          categoryType.charAt(0).toUpperCase() + categoryType.slice(1);

        const embed = new EmbedBuilder()
          .setTitle(`Ticket created - ${categoryName}`)
          .setDescription(
            `**Reason:** ${reason}\n\n` +
            `Hello ${user}, thanks for opening a ticket.\n` +
            `A staff member <@&${config.STAFF_ROLE_ID}> will be with you shortly.`
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
            .setStyle(ButtonStyle.Danger),
        );

        await channel.send({
          content: `${user} <@&${config.STAFF_ROLE_ID}>`,
          embeds: [embed],
          components: [row],
        });

        // Log creation
        const logChannel = client.channels.cache.get(config.TICKET_LOG_CHANNEL_ID);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setTitle('Ticket created')
            .setDescription(
              `Ticket: ${channel}\n` +
              `User: ${user} (${user.id})\n` +
              `Category: ${categoryType}\n` +
              `Reason: ${reason}`
            )
            .setColor('#00FF00')
            .setTimestamp()
            .setFooter({ text: '© ShotDevs' });

          await logChannel.send({ embeds: [logEmbed] });
        }

        return interaction.reply({
          content: `Ticket created: ${channel}`,
          ephemeral: true,
        });

      } catch (error) {
        console.error('Error while creating ticket with modal:', error);
        return interaction.reply({
          content: 'Failed to create ticket. Please contact staff.',
          ephemeral: true,
        });
      }
    }
  },
};
