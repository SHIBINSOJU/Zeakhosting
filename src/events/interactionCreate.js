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
  EmbedBuilder
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

        // --- A. OPEN TICKET MODAL ---
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

        // --- B. CLAIM TICKET ---
        if (customId === 'ticket_claim') {
          // Check staff role safely
          if (config.STAFF_ROLE_ID && !member.roles.cache.has(config.STAFF_ROLE_ID)) {
            return interaction.reply({ content: '❌ Only staff can claim tickets.', ephemeral: true });
          }

          const ticket = await Ticket.findOne({ channelId: channel.id });
          if (!ticket) return interaction.reply({ content: '❌ Ticket not found.', ephemeral: true });
          if (ticket.claimedBy) return interaction.reply({ content: `❌ Already claimed by <@${ticket.claimedBy}>.`, ephemeral: true });

          ticket.claimedBy = user.id;
          await ticket.save();

          const claimEmbed = new EmbedBuilder()
            .setColor('#FFFF00')
            .setDescription(`✅ **Ticket claimed by** ${user}`);

          await channel.send({ embeds: [claimEmbed] });
          return interaction.reply({ content: 'You claimed this ticket.', ephemeral: true });
        }

        // --- C. CLOSE TICKET ---
        if (customId === 'ticket_close') {
          if (config.STAFF_ROLE_ID && !member.roles.cache.has(config.STAFF_ROLE_ID)) {
            return interaction.reply({ content: '❌ Only staff can close tickets.', ephemeral: true });
          }

          await interaction.deferReply({ ephemeral: true });

          const ticket = await Ticket.findOne({ channelId: channel.id });

          // Generate Transcript
          let transcriptText = `TRANSCRIPT for ${channel.name}\n` +
                               `Closed by: ${user.tag}\n` +
                               `Date: ${new Date().toLocaleString()}\n\n`;

          const messages = await channel.messages.fetch({ limit: 100 });
          Array.from(messages.values()).reverse().forEach(msg => {
            transcriptText += `[${msg.createdAt.toLocaleString()}] ${msg.author.tag}: ${msg.content}\n`;
          });

          const attachment = new AttachmentBuilder(Buffer.from(transcriptText), { name: `transcript-${channel.name}.txt` });

          // Log to Log Channel
          const logChannel = client.channels.cache.get(config.TICKET_LOG_CHANNEL_ID);
          if (logChannel) {
            const logEmbed = new EmbedBuilder()
              .setTitle('📕 Ticket Closed')
              .setColor('#FF0000')
              .addFields(
                { name: 'Ticket', value: `${channel.name}`, inline: true },
                { name: 'Closer', value: `${user}`, inline: true },
                { name: 'Creator', value: `<@${ticket?.creatorId}>`, inline: true }
              );
            
            await logChannel.send({ embeds: [logEmbed], files: [attachment] }).catch(() => {});
          }

          // Mark Closed & Delete
          if (ticket) { ticket.closed = true; await ticket.save(); }
          
          await interaction.editReply({ content: '✅ Ticket closed. Deleting in 5 seconds...' });
          setTimeout(() => channel.delete().catch(() => {}), 5000);
          return;
        }
      }

      // ====================================================
      // 2. MODAL SUBMIT (CREATE TICKET)
      // ====================================================
      if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_modal_')) {
        const { customId, guild, user } = interaction;
        const categoryType = customId.replace('ticket_modal_', '');
        const reason = interaction.fields.getTextInputValue('ticket_reason');

        // 1. Resolve Category ID (with fallback)
        let categoryId = config.TICKET_CATEGORY_OTHER_ID;
        if (categoryType === 'support') categoryId = config.TICKET_CATEGORY_SUPPORT_ID;
        if (categoryType === 'technical') categoryId = config.TICKET_CATEGORY_TECHNICAL_ID;
        if (categoryType === 'partnership') categoryId = config.TICKET_CATEGORY_PARTNERSHIP_ID;
        
        if (!categoryId) categoryId = config.TICKET_CATEGORY_ID; // Ultimate fallback

        // 2. Prepare Permissions (Safety Filter)
        const rawOverwrites = [
          { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
          { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
          { id: config.STAFF_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
        ];

        // Filter out undefined IDs to prevent crash
        const safeOverwrites = rawOverwrites.filter(o => o.id && typeof o.id === 'string');

        try {
          // 3. Create Channel
          const channel = await guild.channels.create({
            name: `${categoryType}-${user.username}`.substring(0, 32),
            type: ChannelType.GuildText,
            parent: categoryId,
            permissionOverwrites: safeOverwrites,
          });

          // 4. Save to DB
          await new Ticket({
            channelId: channel.id,
            guildId: guild.id,
            creatorId: user.id,
            category: categoryType,
            reason,
          }).save();

          // 5. Send Interface (Standard Embed)
          const dashboardEmbed = new EmbedBuilder()
            .setTitle(`${categoryType.toUpperCase()} TICKET`)
            .setDescription(
              `**User:** ${user}\n` +
              `**Reason:**\n\`\`\`\n${reason}\n\`\`\`\n` +
              `**Staff Notice:**\nPlease wait for <@&${config.STAFF_ROLE_ID || 'Staff'}> to respond.`
            )
            .setThumbnail(user.displayAvatarURL())
            .setColor('#00FF99')
            .setTimestamp();

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ticket_claim').setLabel('Claim Ticket').setStyle(ButtonStyle.Success).setEmoji('🙋‍♂️'),
            new ButtonBuilder().setCustomId('ticket_close').setLabel('Close Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
          );

          await channel.send({
            content: `${user} ${config.STAFF_ROLE_ID ? `<@&${config.STAFF_ROLE_ID}>` : ''}`,
            embeds: [dashboardEmbed],
            components: [row]
          });

          return interaction.reply({ content: `✅ Ticket created: ${channel}`, ephemeral: true });

        } catch (error) {
          console.error('Ticket Create Error:', error);
          return interaction.reply({ content: '❌ Failed to create ticket. Check bot permissions.', ephemeral: true });
        }
      }

    } catch (err) {
      console.error('Global Error:', err);
      try { if (!interaction.replied) await interaction.reply({ content: 'An internal error occurred.', ephemeral: true }); } catch (e) {}
    }
  },
};
