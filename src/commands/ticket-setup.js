import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import GuildConfig from '../models/GuildConfig.js';
import { createSuccessEmbed, createErrorEmbed } from '../utils/embeds.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ticket-setup')
    .setDescription('Configure ticket system categories')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option.setName('type')
        .setDescription('The ticket type')
        .setRequired(true)
        .addChoices(
          { name: 'Support', value: 'support' },
          { name: 'Issues', value: 'issues' },
          { name: 'Partnership', value: 'partnership' },
          { name: 'Other', value: 'other' }
        )
    )
    .addChannelOption(option =>
      option.setName('category')
        .setDescription('The category to create tickets in')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(true)
    )
    .addChannelOption(option =>
        option.setName('log_channel')
        .setDescription('Channel for ticket logs')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addRoleOption(option =>
        option.setName('staff_role')
        .setDescription('Role that can see/claim tickets')
        .setRequired(false)
    ),

  async execute(interaction) {
    const type = interaction.options.getString('type');
    const category = interaction.options.getChannel('category');
    const logChannel = interaction.options.getChannel('log_channel');
    const staffRole = interaction.options.getRole('staff_role');

    const updateData = {
      [`ticketCategories.${type}`]: category.id
    };
    if (logChannel) updateData.ticketLogChannelId = logChannel.id;

    let config = await GuildConfig.findOne({ guildId: interaction.guildId });
    if (!config) {
      config = new GuildConfig({ guildId: interaction.guildId });
    }

    Object.assign(config, {
        ticketCategories: { ...config.ticketCategories, [type]: category.id }
    });

    if (logChannel) config.ticketLogChannelId = logChannel.id;
    if (staffRole) {
        if (!config.staffRoleIds.includes(staffRole.id)) {
            config.staffRoleIds.push(staffRole.id);
        }
    }

    await config.save();

    await interaction.reply({ embeds: [createSuccessEmbed(`Configured **${type}** tickets to category ${category}.`)] });
  }
};
