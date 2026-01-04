import { 
    EmbedBuilder, 
    ButtonBuilder, 
    ActionRowBuilder, 
    ButtonStyle, 
    ComponentType,
    AttachmentBuilder,
    SlashCommandBuilder
} from 'discord.js';
// 1. IMPORT 'queryFull' INSTEAD OF 'status'
import { queryFull } from 'minecraft-server-util';

export default {
    data: new SlashCommandBuilder()
        .setName('mcstatus')
        .setDescription('Check the status of a Minecraft Server (Query Mode)')
        .addStringOption(option => 
            option.setName('ip')
                .setDescription('The Server IP (e.g., play.hypixel.net)')
                .setRequired(true)
        ),

    async execute(interaction, client) {
        const rawInput = interaction.options.getString('ip'); 
        
        let host, port;
        const parts = rawInput.split(':');

        if (parts.length === 2) {
            host = parts[0];
            port = parseInt(parts[1]);
        } else {
            host = rawInput;
            port = 25565; 
        }

        await interaction.deferReply();

        try {
            // 2. USE QUERY INSTEAD OF STATUS
            // Note: This requires enable-query=true in server.properties
            const result = await queryFull(host, port);

            // Query doesn't always return a favicon, so we skip that part usually.
            // If you really need the icon, you have to run 'status()' separately just for the icon.

            const statusEmbed = new EmbedBuilder()
                .setColor('#2F3136')
                .setTitle(`${host}:${port} Status`)
                .setDescription(result.motd.clean || 'No MOTD')
                .addFields(
                    { name: '🟢 Status', value: 'Online', inline: true },
                    { name: '📶 Latency', value: 'N/A (Query)', inline: true }, // Query doesn't return ping latency
                    { name: '👥 Players', value: `${result.players.online} / ${result.players.max}`, inline: true },
                    { name: '🔧 Version', value: result.version.name || 'Unknown', inline: true }
                )
                .setTimestamp();

            const playerButton = new ButtonBuilder()
                .setCustomId('get_playerlist')
                .setLabel('Show Playerlist')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📜');

            const row = new ActionRowBuilder().addComponents(playerButton);

            const response = await interaction.editReply({
                embeds: [statusEmbed],
                components: [row]
            });

            const collector = response.createMessageComponentCollector({ 
                componentType: ComponentType.Button, 
                time: 900000 
            });

            collector.on('collect', async (i) => {
                if (i.customId === 'get_playerlist') {
                    let playerDescription = 'No players online.';
                    
                    // 3. QUERY RETURNS A SIMPLE ARRAY OF STRINGS (NOT OBJECTS)
                    if (result.players.list && result.players.list.length > 0) {
                        playerDescription = result.players.list.map(p => `• **${p}**`).join('\n');
                    } else if (result.players.online > 0) {
                         playerDescription = 'Players are online, but Query failed to list them.';
                    }

                    const playerEmbed = new EmbedBuilder()
                        .setColor('#00AA00')
                        .setTitle(`Online Players (${result.players.online})`)
                        .setDescription(playerDescription);

                    await i.reply({ embeds: [playerEmbed], ephemeral: true });
                }
            });

        } catch (error) {
            console.error(error);
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('🔴 Server Offline or Query Disabled')
                .setDescription(`Could not connect to **${host}:${port}** via Query.\nEnsure **enable-query=true** is set in server.properties and the port is correct.`);
            
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};
