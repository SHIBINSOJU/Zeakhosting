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
    try {
      // ====================================================
      // 1. BUTTON INTERACTIONS
      // ====================================================
      if (interaction.isButton()) {
        const { customId, guild, user, member, channel } = interaction;

        // --------------------------------------------------
        // A. OPEN TICKET MODAL (Triggered from Panel)
        // --------------------------------------------------
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

        // --------------------------------------------------
        // B. CLAIM TICKET (Staff Only)
        // --------------------------------------------------
        if (customId === 'ticket_claim') {
          // Safety check: Ensure staff role is configured before checking
          if (config.STAFF_ROLE_ID && !member?.roles.cache.has(config.STAFF_ROLE_ID)) {
            return interaction.reply({ content: '❌ Only staff can claim tickets.', ephemeral: true });
          }

          const ticket = await Ticket.findOne({ channelId: channel.id });
          if (!ticket) return interaction.reply({ content: '❌ Ticket data not found in database.', ephemeral: true });
          
          if (ticket.claimedBy) {
            return interaction.reply({ content: `❌ Already claimed by <@${ticket.claimedBy}>.`, ephemeral: true });
          }

          // Update DB
          ticket.claimedBy = user.id;
          await ticket.save();

          // V2 Container: Claim Announcement
          const claimContainer = new ContainerBuilder()
              .setAccentColor(0xFFFF00) // Yellow
              .addContent(
                  new TextDisplayBuilder().setContent(`✅ **Ticket claimed by** ${user}`)
              );

          await channel.send({ 
              components: [claimContainer], 
              flags: MessageFlags.IsComponentsV2 
          });

          return interaction.reply({ content: 'You successfully claimed this ticket.', ephemeral: true });
        }

        // --------------------------------------------------
        // C. CLOSE TICKET (Staff Only)
        // --------------------------------------------------
        if (customId === 'ticket_close') {
          if (config.STAFF_ROLE_ID && !member?.roles.cache.has(config.STAFF_ROLE_ID)) {
            return interaction.reply({ content: '❌ Only staff can close tickets.', ephemeral: true });
          }

          await interaction.deferReply({ ephemeral: true });

          const ticket = await Ticket.findOne({ channelId: channel.id });

          // 1. Generate Transcript
          let transcriptText = `TRANSCRIPT for ${channel.name}\n` +
                               `Category: ${ticket ? ticket.category : 'Unknown'}\n` +
                               `Reason: ${ticket?.reason || 'Not provided'}\n` +
                               `Creator ID: ${ticket?.creatorId}\n` +
                               `Closed by: ${user.tag} (${user.id})\n` +
                               `Date: ${new Date().toISOString()}\n\n` +
                               `---------------------------------------------------\n\n`;

          const messages = await channel.messages.fetch({ limit: 100 });
          Array.from(messages.values()).reverse().forEach(msg => {
            const time = msg.createdAt.toISOString().split('T')[1].split('.')[0];
            transcriptText += `[${time}] ${msg.author.tag}: ${msg.content}\n`;
            if (msg.attachments.size > 0) {
                transcriptText += `[Attachments]: ${msg.attachments.map(a => a.url).join(', ')}\n`;
            }
          });

          const attachment = new AttachmentBuilder(Buffer.from(transcriptText, 'utf-8'), { name: `transcript-${channel.name}.txt` });

          // 2. Log Channel Notification (V2)
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

            try {
                await logChannel.send({ 
                    components: [logContainer], 
                    files: [attachment],
                    flags: MessageFlags.IsComponentsV2 
                });
            } catch (err) {
                console.error('Failed to send log:', err);
            }
          }

          // 3. DM User with Rating Request (V2)
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
                      .setAccentColor(0x3498db) // Blue
                      .addContent(
                          new TextDisplayBuilder().setContent(`# 🎫 Ticket Experience`),
                          new SeparatorBuilder().setDivider(true),
                          new TextDisplayBuilder().setContent(
                              `Your ticket **${channel.name}** has been closed.\n` +
                              `Please rate your experience below to help us improve.`
                          )
                      );

                  await creator.send({
                      components: [rateContainer, ratingRow],
                      files: [attachment],
                      flags: MessageFlags.IsComponentsV2
                  });
              } catch (e) { 
                  console.warn(`Could not DM ticket creator (${ticket.creatorId}):`, e.message); 
              }
          }

          if (ticket) { 
              ticket.closed = true; 
              await ticket.save(); 
          }

          await interaction.editReply({ content: '✅ Ticket closed. Deleting channel in 5 seconds...' });
          setTimeout(() => channel.delete().catch(() => {}), 5000);
          return;
        }

        // --------------------------------------------------
        // D. RATE TICKET (Triggered in DM)
        // --------------------------------------------------
        if (customId.startsWith('ticket_rate_')) {
          const parts = customId.split('_');
          const score = parseInt(parts[2], 10);
          const ticketChannelId = parts[3];

          if (isNaN(score)) return interaction.reply({ content: 'Error parsing score.', ephemeral: true });

          const ticket = await Ticket.findOne({ channelId: ticketChannelId });
          
          if (!ticket) return interaction.reply({ content: '❌ Ticket data not found.', ephemeral: true });
          if (interaction.user.id !== ticket.creatorId) return interaction.reply({ content: '❌ This is not your ticket.', ephemeral: true });
          if (ticket.rating !== null) return interaction.reply({ content: `⚠️ You already rated this ticket **${ticket.rating}/5**.`, ephemeral: true });

          ticket.rating = score;
          ticket.ratedAt = new Date();
          await ticket.save();

          const logChannel = client.channels.cache.get(config.TICKET_LOG_CHANNEL_ID);
          if (logChannel) {
            const ratingContainer = new ContainerBuilder()
              .setAccentColor(0x00FF00) // Green
              .addContent(
                  new TextDisplayBuilder().setContent(`# ⭐ Ticket Reviewed`),
                  new SeparatorBuilder().setDivider(true),
                  new TextDisplayBuilder().setContent(
                      `**User:** <@${ticket.creatorId}>\n` +
                      `**Ticket:** ${ticket.category}\n` +
                      `**Rating:** ${score}/5`
                  )
              );
            
            await logChannel.send({ components: [ratingContainer], flags: MessageFlags.IsComponentsV2 });
          }

          const disabledRow = ActionRowBuilder.from(interaction.message.components[0]);
          disabledRow.components.forEach(btn => btn.setDisabled(true));
          
          await interaction.update({ components: [disabledRow] });
          await interaction.followUp({ content: `✅ Thank you! You rated us **${score}/5**.`, ephemeral: true });
          return;
        }
      }

      // ====================================================
      // 2. MODAL SUBMITS (CREATE TICKET LOGIC)
      // ====================================================
      if (interaction.isModalSubmit()) {
        const { customId, guild, user } = interaction;
        
        if (customId.startsWith('ticket_modal_')) {
            const categoryType = customId.replace('ticket_modal_', '');
            
            // 1. Resolve Category ID
            let categoryId;
            switch (categoryType) {
                case 'support': categoryId = config.TICKET_CATEGORY_SUPPORT_ID; break;
                case 'technical': categoryId = config.TICKET_CATEGORY_TECHNICAL_ID; break;
                case 'partnership': categoryId = config.TICKET_CATEGORY_PARTNERSHIP_ID; break;
                default: categoryId = config.TICKET_CATEGORY_OTHER_ID; break;
            }

            // Fallback to generic ID if specific one is missing
            if (!categoryId) categoryId = config.TICKET_CATEGORY_ID;

            if (!categoryId) {
                console.error('[Ticket System] ERROR: No valid category ID found in config!');
                return interaction.reply({ content: '❌ Configuration Error: Contact Admin (Missing Category ID).', ephemeral: true });
            }

            const reason = interaction.fields.getTextInputValue('ticket_reason');

            // Check for existing open ticket
            const existingTicket = await Ticket.findOne({ guildId: guild.id, creatorId: user.id, closed: false });
            if (existingTicket) {
                return interaction.reply({ content: `❌ You already have an open ticket: <#${existingTicket.channelId}>`, ephemeral: true });
            }

            const ticketName = `${categoryType}-${user.username}`.substring(0, 32);

            try {
                // --- ⚠️ CRITICAL FIX: SAFETY FILTER FOR PERMISSIONS ---
                const rawOverwrites = [
                    { 
                        id: guild.id, 
                        deny: [PermissionFlagsBits.ViewChannel] 
                    },
                    { 
                        id: user.id, 
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] 
                    },
                    { 
                        id: client.user.id, 
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] 
                    },
                    { 
                        // Attempt to add Staff Role
                        id: config.STAFF_ROLE_ID, 
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages] 
                    },
                ];

                // Filter out any entries where 'id' is undefined or invalid string
                const safeOverwrites = rawOverwrites.filter(o => typeof o.id === 'string' && o.id.length > 0);

                // Create Channel
                const channel = await guild.channels.create({
                    name: ticketName,
                    type: ChannelType.GuildText,
                    parent: categoryId,
                    permissionOverwrites: safeOverwrites, // Use filtered list
                });

                // Save to Database
                const newTicket = new Ticket({
                    channelId: channel.id,
                    guildId: guild.id,
                    creatorId: user.id,
                    category: categoryType,
                    reason,
                });
                await newTicket.save();

                const categoryDisplayName = categoryType.charAt(0).toUpperCase() + categoryType.slice(1);

                // --- V2 DASHBOARD CONTAINER ---
                const ticketContainer = new ContainerBuilder()
                    .setAccentColor(0x00FF99) // Mint/Teal
                    .addContent(
                        new SectionBuilder()
                            .addContent(new TextDisplayBuilder().setContent(`# 🎫 ${categoryDisplayName} Ticket`))
                            .setAccessory(new ThumbnailBuilder().setURL(guild.iconURL({ extension: 'png' }) || '')),
                        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Medium),
                        new TextDisplayBuilder().setContent(
                            `**User:** ${user}\n` +
                            `**Reason:**\n> ${reason}\n\n` +
                            `### ⚠️ Staff Notice\n` +
                            `A member of the staff team will be here shortly.`
                        ),
                        new TextDisplayBuilder()
                            .setContent('ZeakCloud Ticket System')
                            .setColor('subtext')
                    );

                const controlRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('ticket_claim').setLabel('Claim Ticket').setStyle(ButtonStyle.Success).setEmoji('🙋‍♂️'),
                    new ButtonBuilder().setCustomId('ticket_close').setLabel('Close Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
                );
                
                // Construct mention string safely
                const mentionString = config.STAFF_ROLE_ID 
                    ? `${user} <@&${config.STAFF_ROLE_ID}>` 
                    : `${user}`;

                await channel.send({
                    content: mentionString,
                    components: [ticketContainer, controlRow], 
                    flags: MessageFlags.IsComponentsV2
                });

                // Log Ticket Creation (V2)
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

                return interaction.reply({ content: `✅ Ticket created: ${channel}`, ephemeral: true });

            } catch (error) {
                console.error('Ticket creation error:', error);
                return interaction.reply({ content: '❌ Failed to create ticket channel. Please check bot permissions and category ID.', ephemeral: true });
            }
        }
      }

    } catch (err) {
      console.error('Global Interaction Error:', err);
      if (interaction.isRepliable() && !interaction.replied) {
          await interaction.reply({ content: 'An internal error occurred.', ephemeral: true }).catch(() => {});
      }
    }
  },
};
