import {
  ChannelType,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder
} from 'discord.js';
import GuildConfig from '../models/GuildConfig.js';
import Ticket from '../models/Ticket.js';
import { createEmbed, createErrorEmbed, createSuccessEmbed, createInfoEmbed } from '../utils/embeds.js';
import logger from '../utils/logger.js';

/**
 * Creates a new ticket channel.
 */
export const createTicket = async (interaction, type) => {
  const guildConfig = await GuildConfig.findOne({ guildId: interaction.guildId });
  if (!guildConfig) {
    return interaction.reply({ embeds: [createErrorEmbed('Guild configuration not found. Admin must run /ticket-setup.')], ephemeral: true });
  }

  const categoryId = guildConfig.ticketCategories[type];
  if (!categoryId) {
    return interaction.reply({ embeds: [createErrorEmbed(`Category for ${type} tickets is not configured.`)], ephemeral: true });
  }

  // Verify category exists
  const category = interaction.guild.channels.cache.get(categoryId);
  if (!category) {
     return interaction.reply({ embeds: [createErrorEmbed(`Configured category for ${type} not found (ID: ${categoryId}).`)], ephemeral: true });
  }

  // Check for existing open ticket for this user? (Optional, but good practice to prevent spam)
  // const existing = await Ticket.findOne({ guildId: interaction.guildId, creatorId: interaction.user.id, status: 'open' });
  // if (existing) {
  //   return interaction.reply({ embeds: [createErrorEmbed(`You already have an open ticket: <#${existing.channelId}>`)], ephemeral: true });
  // }

  const ticketId = Date.now().toString().slice(-6); // Simple ID
  const channelName = `${type}-${interaction.user.username}-${ticketId}`.toLowerCase().replace(/[^a-z0-9-]/g, '');

  // Permissions
  const staffRoles = guildConfig.staffRoleIds.map(id => ({
    id,
    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
  }));

  try {
    const channel = await interaction.guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: categoryId,
      permissionOverwrites: [
        {
          id: interaction.guild.id,
          deny: [PermissionsBitField.Flags.ViewChannel],
        },
        {
          id: interaction.user.id,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
        },
        {
          id: interaction.client.user.id,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.ManageChannels],
        },
        ...staffRoles
      ],
    });

    // Save to DB
    await Ticket.create({
      ticketId,
      guildId: interaction.guildId,
      channelId: channel.id,
      creatorId: interaction.user.id,
      type,
      status: 'open'
    });

    // Send initial message
    const embed = createInfoEmbed('Ticket Created', `Welcome ${interaction.user}! Please describe your issue. Staff will be with you shortly.`)
      .addFields(
        { name: 'Ticket ID', value: ticketId, inline: true },
        { name: 'Type', value: type, inline: true },
        { name: 'Creator', value: interaction.user.toString(), inline: true }
      );

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder().setCustomId(`ticket_claim_${ticketId}`).setLabel('Claim').setStyle(ButtonStyle.Success).setEmoji('🙋‍♂️'),
        new ButtonBuilder().setCustomId(`ticket_close_${ticketId}`).setLabel('Close').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
        new ButtonBuilder().setCustomId(`ticket_transcript_${ticketId}`).setLabel('Transcript').setStyle(ButtonStyle.Secondary).setEmoji('📄'),
        new ButtonBuilder().setCustomId(`ticket_lock_${ticketId}`).setLabel('Lock/Unlock').setStyle(ButtonStyle.Primary).setEmoji('🔐')
      );

    await channel.send({ content: `${interaction.user} <@&${guildConfig.staffRoleIds[0] || interaction.guild.id}>`, embeds: [embed], components: [row] });
    await channel.pin();

    return interaction.reply({ content: `Ticket created: ${channel}`, ephemeral: true });

  } catch (err) {
    logger.error('Error creating ticket channel', err);
    return interaction.reply({ embeds: [createErrorEmbed('Failed to create ticket channel. Check permissions.')], ephemeral: true });
  }
};

/**
 * Claims a ticket.
 */
export const claimTicket = async (interaction, ticketId) => {
  const ticket = await Ticket.findOne({ ticketId, guildId: interaction.guildId });
  if (!ticket) return interaction.reply({ embeds: [createErrorEmbed('Ticket not found in DB.')], ephemeral: true });

  if (ticket.claimedBy) {
    return interaction.reply({ embeds: [createErrorEmbed(`Ticket already claimed by <@${ticket.claimedBy}>`)], ephemeral: true });
  }

  // Check staff permission
  const guildConfig = await GuildConfig.findOne({ guildId: interaction.guildId });
  const isStaff = interaction.member.roles.cache.some(r => guildConfig.staffRoleIds.includes(r.id)) || interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
  if (!isStaff) return interaction.reply({ embeds: [createErrorEmbed('Only staff can claim tickets.')], ephemeral: true });

  ticket.claimedBy = interaction.user.id;
  await ticket.save();

  await interaction.channel.send({ embeds: [createSuccessEmbed(`${interaction.user} has claimed this ticket.`)] });
  return interaction.reply({ content: 'Claimed successfully.', ephemeral: true });
};

/**
 * Closes a ticket.
 */
export const closeTicket = async (interaction, ticketId) => {
  // If confirmed or not? We will implement a confirmation step if needed,
  // but simpler to just do it or use a modal. The requirement says confirmation.
  // For simplicity in this "service" function, we assume the user clicked the confirmation button
  // or we trigger the confirmation UI here.
  // Let's implement the actual closing logic here, called after confirmation.

  const ticket = await Ticket.findOne({ ticketId, guildId: interaction.guildId });
  if (!ticket) {
    const msg = { embeds: [createErrorEmbed('Ticket not found.')], ephemeral: true };
    return (interaction.deferred || interaction.replied) ? interaction.followUp(msg) : interaction.reply(msg);
  }

  if (interaction.deferred || interaction.replied) {
    await interaction.followUp({ content: 'Closing ticket... Generating transcript...', ephemeral: true });
  } else {
    await interaction.reply({ content: 'Closing ticket... Generating transcript...', ephemeral: true });
  }

  // Fetch messages
  let messages = [];
  try {
    messages = await interaction.channel.messages.fetch({ limit: 100 });
  } catch (e) {
    logger.warn('Could not fetch messages for transcript');
  }

  // Generate Transcript
  const transcriptContent = messages.reverse().map(m => {
    return `[${m.createdAt.toISOString()}] ${m.author.tag}: ${m.content} ${m.attachments.size > 0 ? '(Attachment)' : ''}`;
  }).join('\n');

  const buffer = Buffer.from(transcriptContent, 'utf-8');
  const attachment = new AttachmentBuilder(buffer, { name: `transcript-${ticketId}.txt` });

  // Send to log channel
  const guildConfig = await GuildConfig.findOne({ guildId: interaction.guildId });
  if (guildConfig && guildConfig.ticketLogChannelId) {
    try {
      const logChannel = interaction.guild.channels.cache.get(guildConfig.ticketLogChannelId);
      if (logChannel) {
        const logEmbed = createInfoEmbed('Ticket Closed', `Ticket #${ticketId} closed.`)
          .addFields(
            { name: 'Creator', value: `<@${ticket.creatorId}>`, inline: true },
            { name: 'Claimed By', value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : 'None', inline: true },
            { name: 'Closed By', value: interaction.user.toString(), inline: true },
            { name: 'Duration', value: `${Math.round((Date.now() - ticket.createdAt) / 1000 / 60)} mins`, inline: true }
          );
        await logChannel.send({ embeds: [logEmbed], files: [attachment] });
      }
    } catch (err) {
      logger.error('Failed to send log', err);
    }
  }

  // DM Creator
  try {
    const creator = await interaction.guild.members.fetch(ticket.creatorId);
    await creator.send({ content: `Your ticket #${ticketId} has been closed. Here is the transcript.`, files: [attachment] });
  } catch (err) {
    // DM closed
  }

  // Update DB
  ticket.status = 'closed';
  ticket.closedAt = new Date();
  await ticket.save();

  // Delete channel
  setTimeout(() => {
    if (interaction.channel) interaction.channel.delete().catch(e => logger.error('Failed to delete channel', e));
  }, guildConfig.ticketCloseDelaySeconds * 1000);
};


export const generateTranscript = async (interaction, ticketId) => {
  let messages = await interaction.channel.messages.fetch({ limit: 100 });
  const transcriptContent = messages.reverse().map(m => {
    return `[${m.createdAt.toISOString()}] ${m.author.tag}: ${m.content}`;
  }).join('\n');

  const buffer = Buffer.from(transcriptContent, 'utf-8');
  const attachment = new AttachmentBuilder(buffer, { name: `transcript-${ticketId}.txt` });

  await interaction.reply({ content: 'Here is the transcript:', files: [attachment], ephemeral: true });
};

export const toggleLock = async (interaction, ticketId) => {
  const ticket = await Ticket.findOne({ ticketId, guildId: interaction.guildId });
  if (!ticket) return interaction.reply({ embeds: [createErrorEmbed('Ticket DB entry not found.')], ephemeral: true });

  const currentOverwrites = interaction.channel.permissionOverwrites.cache.get(ticket.creatorId);
  const canSend = currentOverwrites?.allow.has(PermissionsBitField.Flags.SendMessages);

  if (canSend) {
    await interaction.channel.permissionOverwrites.edit(ticket.creatorId, { SendMessages: false });
    interaction.reply({ embeds: [createSuccessEmbed('Ticket locked for creator.')], ephemeral: true });
  } else {
    await interaction.channel.permissionOverwrites.edit(ticket.creatorId, { SendMessages: true });
    interaction.reply({ embeds: [createSuccessEmbed('Ticket unlocked for creator.')], ephemeral: true });
  }
};
