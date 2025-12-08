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
      // 1. BUTTON CLICKS
      // ====================================================
      if (interaction.isButton()) {
        const { customId, guild, user, member, channel } = interaction;

        // --- A. OPEN MODAL (Do NOT defer here!) ---
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

          // DIRECTLY show modal. No deferReply allowed here.
          return interaction.showModal(modal);
        }

        // --- B. CLAIM TICKET ---
        if (customId === 'ticket_claim') {
            // Safety: Check if Staff Role is valid before checking
            const hasRole = config.STAFF_ROLE_ID && member.roles.cache.has(config.STAFF_ROLE_ID);
            
            // If checking role fails or user doesn't have it
            if (config.STAFF_ROLE_ID && !hasRole) {
                return interaction.reply({ content: '❌ Only staff can claim tickets.', ephemeral: true });
            }

            const ticket = await Ticket.findOne({ channelId: channel.id });
            if (!ticket) return interaction.reply({ content: '❌ Ticket not found in DB.', ephemeral: true });
            if (ticket.claimedBy) return interaction.reply({ content: `❌ Already claimed by <@${ticket.claimedBy}>.`, ephemeral: true });

            ticket.claimedBy = user.id;
            await ticket.save();

            const claimContainer = new ContainerBuilder()
                .setAccentColor(0xFFFF00)
                .addContent(new TextDisplayBuilder().setContent(`✅ **Ticket claimed by** ${user}`));

            await channel.send({ components: [claimContainer], flags: MessageFlags.IsComponentsV2 });
            return interaction.reply({ content: 'Claimed successfully.', ephemeral: true });
        }

        // --- C. CLOSE TICKET ---
        if (customId === 'ticket_close') {
            const hasRole = config.STAFF_ROLE_ID && member.roles.cache.has(config.STAFF_ROLE_ID);
            if (config.STAFF_ROLE_ID && !hasRole) {
                return interaction.reply({ content: '❌ Only staff can close tickets.', ephemeral: true });
            }

            // We CAN defer here because we are not showing a modal
            await interaction.deferReply({ ephemeral: true });

            const ticket = await Ticket.findOne({ channelId: channel.id });
            
            // Generate Transcript
            let transcriptText = `TRANSCRIPT: ${channel.name}\nClosed by: ${user.tag}\n\n`;
            const messages = await channel.messages.fetch({ limit: 100 });
            Array.from(messages.values()).reverse().forEach(msg => {
                transcriptText += `[${msg.createdAt.toLocaleString()}] ${msg.author.tag}: ${msg.content}\n`;
            });

            const attachment = new AttachmentBuilder(Buffer.from(transcriptText), { name: `transcript-${channel.name}.txt` });

            // Log to Channel
            const logChannel = client.channels.cache.get(config.TICKET_LOG_CHANNEL_ID);
            if (logChannel) {
                try {
                    await logChannel.send({ 
                        content: `Ticket Closed: ${channel.name}`,
                        files: [attachment] 
                    });
                } catch (e) { console.error('Log error:', e); }
            }

            // Delete Channel
            if (ticket) { ticket.closed = true; await ticket.save(); }
            await interaction.editReply({ content: '✅ Ticket closed. Deleting...' });
            setTimeout(() => channel.delete().catch(() => {}), 5000);
            return;
        }
      }

      // ====================================================
      // 2. MODAL SUBMIT (Create the actual channel)
      // ====================================================
      if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_modal_')) {
        const categoryType = interaction.customId.replace('ticket_modal_', '');
        const reason = interaction.fields.getTextInputValue('ticket_reason');

        // RESOLVE CATEGORY ID
        let categoryId = config.TICKET_CATEGORY_OTHER_ID;
        if (categoryType === 'support') categoryId = config.TICKET_CATEGORY_SUPPORT_ID;
        if (categoryType === 'technical') categoryId = config.TICKET_CATEGORY_TECHNICAL_ID;
        if (categoryType === 'partnership') categoryId = config.TICKET_CATEGORY_PARTNERSHIP_ID;
        
        // Fallback
        if (!categoryId) categoryId = config.TICKET_CATEGORY_ID;

        try {
            // --- THE CRASH FIX IS HERE ---
            // We create a list of permissions, then FILTER out the broken ones.
            const rawOverwrites = [
                { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                // Only tries to add staff if the ID exists
                { id: config.STAFF_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
            ];

            // This line removes any "undefined" IDs so the bot won't crash
            const safeOverwrites = rawOverwrites.filter(o => o.id && typeof o.id === 'string');

            const channel = await guild.channels.create({
                name: `${categoryType}-${user.username}`.substring(0, 32),
                type: ChannelType.GuildText,
                parent: categoryId,
                permissionOverwrites: safeOverwrites, 
            });

            // Save DB
            await new Ticket({
                channelId: channel.id,
                guildId: guild.id,
                creatorId: user.id,
                category: categoryType,
                reason,
            }).save();

            // Send Dashboard
            const ticketContainer = new ContainerBuilder()
                .setAccentColor(0x00FF99)
                .addContent(
                    new TextDisplayBuilder().setContent(`**Ticket Created**\nUser: ${user}\nReason: ${reason}`)
                );

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('ticket_claim').setLabel('Claim').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('ticket_close').setLabel('Close').setStyle(ButtonStyle.Danger)
            );

            await channel.send({ 
                content: `${user} ${config.STAFF_ROLE_ID ? `<@&${config.STAFF_ROLE_ID}>` : ''}`, 
                components: [ticketContainer, row], 
                flags: MessageFlags.IsComponentsV2 
            });

            return interaction.reply({ content: `✅ Ticket created: ${channel}`, ephemeral: true });

        } catch (error) {
            console.error('Ticket Create Error:', error);
            return interaction.reply({ content: '❌ Failed to create channel. Check Bot Permissions.', ephemeral: true });
        }
      }

    } catch (err) {
      console.error('Global Error:', err);
      // Prevent crash if reply fails
      try { 
          if (!interaction.replied) await interaction.reply({ content: 'Error.', ephemeral: true });
      } catch (e) {}
    }
  },
};
