import {
  Events,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  AttachmentBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  // V2 Imports
  ContainerBuilder,
  TextDisplayBuilder,
  SectionBuilder,
  ThumbnailBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags 
} from 'discord.js';
import config from '../utils/config.js';
import Ticket from '../models/Ticket.js';

export default {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    
    // ====================================================
    // 1. BUTTON INTERACTIONS
    // ====================================================
    if (interaction.isButton()) {
      const { customId, guild, user, member, channel } = interaction;

      // ---------- A. SHOW CREATE TICKET MODAL ----------
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
          .setPlaceholder('Example: Server is offline / billing / partnership...');

        const row = new ActionRowBuilder().addComponents(reasonInput);
        modal.addComponents(row);

        return interaction.showModal(modal);
      }

      // ---------- B. CLAIM TICKET ----------
      if (customId === 'ticket_claim') {
        if (!member?.roles.cache.has(config.STAFF_ROLE_ID)) {
          return interaction.reply({ content: 'Only staff can claim tickets.', ephemeral: true });
        }

        const ticket = await Ticket.findOne({ channelId: channel.id });
        if (!ticket) return interaction.reply({ content: 'Ticket data not found.', ephemeral: true });
        
        if (ticket.claimedBy) {
          return interaction.reply({ content: `Already claimed by <@${ticket.claimedBy}>.`, ephemeral: true });
        }

        ticket.claimedBy = user.id;
        await ticket.save();

        // V2 Container for Claim
        const claimContainer = new ContainerBuilder()
            .setAccentColor(0xFFFF00) // Yellow
            .addContent(
                new TextDisplayBuilder().setContent(`✅ **Ticket claimed by** ${user}`)
            );

        await channel.send({ 
            components: [claimContainer], 
            flags: MessageFlags.IsComponentsV2 
        });

        return interaction.reply({ content: 'You claimed this ticket.', ephemeral: true });
      }

      // ---------- C. CLOSE TICKET ----------
      if (customId === 'ticket_close') {
        if (!member?.roles.cache.has(config.STAFF_ROLE_ID)) {
          return interaction.reply({ content: 'Only staff can close tickets.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        const ticket = await Ticket.findOne({ channelId: channel.id });

        // Generate Transcript Text
        let transcriptText = `TRANSCRIPT for ${channel.name}\n` +
                             `Category: ${ticket ? ticket.category : 'Unknown'}\n` +
                             `Reason: ${ticket?.reason || 'Not provided'}\n` +
                             `Closed by: ${user.tag} (${user.id})\n` +
                             `Date: ${new Date().toISOString()}\n\n`;

        const messages = await channel.messages.fetch({ limit: 100 });
        messages.reverse().forEach(msg => {
          transcriptText += `[${msg.createdAt.toISOString()}] ${msg.author.tag}: ${msg.content}\n`;
          if (msg.attachments.size > 0) transcriptText += `[Attachments]: ${msg.attachments.map(a => a.url).join(', ')}\n`;
        });

        const attachment = new AttachmentBuilder(Buffer.from(transcriptText, 'utf-8'), { name: `transcript-${channel.name}.txt` });

        // Log Channel Notification (V2)
        const logChannel = client.channels.cache.get(config.TICKET_LOG_CHANNEL_ID);
        if (logChannel) {
          const logContainer = new ContainerBuilder()
            .setAccentColor(0xFF0000) // Red
            .addContent(
                new TextDisplayBuilder().setContent(`# 📕 Ticket Closed`),
                new SeparatorBuilder().setDivider(true),
                new TextDisplayBuilder().setContent(
                    `**Ticket:** ${channel.name}\n` +
                    `**Creator:** <@${ticket?.creatorId}>\n` +
                    `**Closer:** ${user}\n` +
                    `**Reason:** ${ticket?.reason || 'None'}`
                )
            );

          await logChannel.send({ 
              components: [logContainer], 
              files: [attachment],
              flags: MessageFlags.IsComponentsV2 
          });
        }

        // DM User with Rating (V2)
        if (ticket?.creatorId) {
            try {
                const creator = await client.users.fetch(ticket.creatorId);
                const ratingRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`ticket_rate_1_${channel.id}`).setLabel('1 ⭐').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId(`ticket_rate_2_${channel.id}`).setLabel('2 ⭐').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId(`ticket_rate_3_${channel.id}`).setLabel('3 ⭐').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId(`ticket_rate_4_${channel.id}`).setLabel('4 ⭐').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`ticket_rate_5_${channel.id}`).setLabel('5 ⭐').setStyle(ButtonStyle.Success)
                );

                const rateContainer = new ContainerBuilder()
                    .setAccentColor(0xFF0000)
                    .addContent(
                        new TextDisplayBuilder().setContent(`# 🎫 Ticket Experience`),
                        new SeparatorBuilder().setDivider(true),
                        new TextDisplayBuilder().setContent(
                            `Your ticket **${channel.name}** has been closed.\n` +
                            `Please rate your experience below.`
                        )
                    );

                await creator.send({
                    components: [rateContainer, ratingRow], // Send container AND buttons
                    files: [attachment],
                    flags: MessageFlags.IsComponentsV2
                });
            } catch (e) { console.warn('Could not DM ticket creator.'); }
        }

        if (ticket) { ticket.closed = true; await ticket.save(); }

        await interaction.editReply({ content: '✅ Ticket closed. Deleting in 5 seconds...' });
        setTimeout(() => channel.delete().catch(() => {}), 5000);
        return;
      }

      // ---------- D. RATE TICKET ----------
      if (customId.startsWith('ticket_rate_')) {
        const parts = customId.split('_');
        const score = parseInt(parts[2], 10);
        const ticketChannelId = parts[3];

        if (isNaN(score)) return interaction.reply({ content: 'Error.', ephemeral: true });

        const ticket = await Ticket.findOne({ channelId: ticketChannelId });
        if (!ticket) return interaction.reply({ content: 'Ticket not found.', ephemeral: true });
        if (interaction.user.id !== ticket.creatorId) return interaction.reply({ content: 'Not your ticket.', ephemeral: true });
        if (ticket.rating !== null) return interaction.reply({ content: `Already rated ${ticket.rating}/5.`, ephemeral: true });

        ticket.rating = score;
        ticket.ratedAt = new Date();
        await ticket.save();

        // Log Rating (V2)
        const logChannel = client.channels.cache.get(config.TICKET_LOG_CHANNEL_ID);
        if (logChannel) {
          const ratingContainer = new ContainerBuilder()
            .setAccentColor(0x00FF00) // Green
            .addContent(
                new TextDisplayBuilder().setContent(`# ⭐ Ticket Reviewed`),
                new SeparatorBuilder().setDivider(true),
                new TextDisplayBuilder().setContent(
                    `**User:** <@${ticket.creatorId}>\n` +
                    `**Rating:** ${score}/5`
                )
            );
          
          await logChannel.send({ components: [ratingContainer], flags: MessageFlags.IsComponentsV2 });
        }

        return interaction.reply({ content: `Rated **${score}/5** ✅`, ephemeral: true });
      }
    }

    // ====================================================
    // 2. MODAL SUBMITS (CREATE TICKET)
    // ====================================================
    if (interaction.isModalSubmit()) {
      const { customId, guild, user } = interaction;
      if (!customId.startsWith('ticket_modal_')) return;

      const categoryType = customId.replace('ticket_modal_', '');
      
      // Map category ID
      let categoryId;
      if (categoryType === 'support') categoryId = config.TICKET_CATEGORY_SUPPORT_ID;
      else if (categoryType === 'technical') categoryId = config.TICKET_CATEGORY_TECHNICAL_ID;
      else if (categoryType === 'partnership') categoryId = config.TICKET_CATEGORY_PARTNERSHIP_ID;
      else categoryId = config.TICKET_CATEGORY_OTHER_ID;

      if (!categoryId) return interaction.reply({ content: 'Category config error.', ephemeral: true });

      const reason = interaction.fields.getTextInputValue('ticket_reason');

      // Check existing ticket
      const existingTicket = await Ticket.findOne({ guildId: guild.id, creatorId: user.id, closed: false });
      if (existingTicket) {
        return interaction.reply({ content: `You already have an open ticket <#${existingTicket.channelId}>`, ephemeral: true });
      }

      const ticketName = `${categoryType}-${user.username}`.substring(0, 32);

      try {
        const channel = await guild.channels.create({
          name: ticketName,
          type: ChannelType.GuildText,
          parent: categoryId,
          permissionOverwrites: [
            { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
            { id: config.STAFF_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
            { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
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

        const categoryName = categoryType.charAt(0).toUpperCase() + categoryType.slice(1);

        // --- NEW V2 TICKET DASHBOARD ---
        const ticketContainer = new ContainerBuilder()
            .setAccentColor(0x00FF99) // Mint/Teal
            .addContent(
                // 1. Header with Icon
                new SectionBuilder()
                    .addContent(new TextDisplayBuilder().setContent(`# 🎫 ${categoryName} Ticket`))
                    .setAccessory(new ThumbnailBuilder().setURL(guild.iconURL())),

                // 2. Separator Line
                new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Medium),

                // 3. Ticket Details
                new TextDisplayBuilder().setContent(
                    `**User:** ${user}\n` +
                    `**Reason:**\n> ${reason}\n\n` +
                    `### ⚠️ Staff Notice\n` +
                    `A member of the <@&${config.STAFF_ROLE_ID}> team will be here shortly.`
                ),

                // 4. Footer
                new TextDisplayBuilder()
                    .setContent('ShotDevs Ticket System')
                    .setColor('subtext')
            );

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('ticket_claim').setLabel('Claim Ticket').setStyle(ButtonStyle.Success).setEmoji('🙋‍♂️'),
          new ButtonBuilder().setCustomId('ticket_close').setLabel('Close Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
        );

        await channel.send({
          content: `${user} <@&${config.STAFF_ROLE_ID}>`,
          components: [ticketContainer, row], // Container + Button Row
          flags: MessageFlags.IsComponentsV2
        });

        // Log Creation (V2)
        const logChannel = client.channels.cache.get(config.TICKET_LOG_CHANNEL_ID);
        if (logChannel) {
             const creationLog = new ContainerBuilder()
                .setAccentColor(0x00FF00)
                .addContent(
                    new TextDisplayBuilder().setContent(`# 🆕 Ticket Created`),
                    new SeparatorBuilder().setDivider(true),
                    new TextDisplayBuilder().setContent(
                        `**Ticket:** ${channel}\n` +
                        `**User:** ${user.tag}\n` +
                        `**Category:** ${categoryType}`
                    )
                );
             await logChannel.send({ components: [creationLog], flags: MessageFlags.IsComponentsV2 });
        }

        return interaction.reply({ content: `Ticket created: ${channel}`, ephemeral: true });

      } catch (error) {
        console.error('Ticket creation error:', error);
        return interaction.reply({ content: 'Failed to create ticket.', ephemeral: true });
      }
    }
  },
};
            
