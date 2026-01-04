import { 
    EmbedBuilder, 
    ButtonBuilder, 
    ActionRowBuilder, 
    ButtonStyle, 
    ComponentType,
    AttachmentBuilder,
    SlashCommandBuilder // Required for the IP input box
} from 'discord.js';
import { status } from 'minecraft-server-util';

export default {
    // THIS 'data' SECTION IS WHAT ADDS THE INPUT BOX
    data: new SlashCommandBuilder()
        .setName('mcstatus')
        .setDescription('Check the status of a Minecraft Server')
        .addStringOption(option => 
            option.setName('ip')
                .setDescription('The Server IP (e.g., play.hypixel.net)')
                .setRequired(true)
        ),

    async execute(interaction, client) {
        // 1. Get the IP the user typed
        const rawInput = interaction.options.getString('ip'); 
        
        // 2. Logic to handle Ports (IP:Port)
        let host, port;
        const parts = rawInput.split(':');

        if (parts.length === 2) {
            host = parts[0];
            port = parseInt(parts[1]);
        } else {
            host = rawInput;
            port = 25565; // Default Java Port
        }

        await interaction.deferReply();

        try {
            // 3. Fetch Status
            const result = await status(host, port);

            // 4. Create Icon
            let iconAttachment = null;
            if (result.favicon) {
                const buffer = Buffer.from(result.favicon.split(',')[1], 'base64');
                iconAttachment = new AttachmentBuilder(buffer, { name: 'icon.png' });
            }

            // 5. Build Embed
            const statusEmbed = new EmbedBuilder()
                .setColor('#2F3136')
                .setTitle(`${host}:${port} Status`)
                .setDescription(result.motd.clean || 'No MOTD')
                .addFields(
                    { name: '🟢 Status', value: 'Online', inline: true },
                    { name: '📶 Ping', value: `${result.roundTripLatency}ms`, inline: true },
                    { name: '👥 Players', value: `${result.players.online} / ${result.players.max}`, inline: true },
                    { name: '🔧 Version', value: result.version.name || 'Unknown', inline: true }
                )
                .setTimestamp();

            if (iconAttachment) {
                statusEmbed.setThumbnail('attachment://icon.png');
            }

            // 6. Create Button
            const playerButton = new ButtonBuilder()
                .setCustomId('get_playerlist')
                .setLabel('Show Playerlist')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📜');

            const row = new ActionRowBuilder().addComponents(playerButton);

            const response = await interaction.editReply({
                embeds: [statusEmbed],
                components: [row],
                files: iconAttachment ? [iconAttachment] : []
            });

            // 7. Handle Button Clicks
            const collector = response.createMessageComponentCollector({ 
                componentType: ComponentType.Button, 
                time: 900000 
            });

            collector.on('collect', async (i) => {
                if (i.customId === 'get_playerlist') {
                    let playerDescription = 'No players online.';
                    
                    if (result.players.sample && result.players.sample.length > 0) {
                        playerDescription = result.players.sample.map(p => `• **${p.name}**`).join('\n');
                        if (result.players.online > result.players.sample.length) {
                            playerDescription += `\n\n*...and ${result.players.online - result.players.sample.length} more.*`;
                        }
                    } else if (result.players.online > 0) {
                        playerDescription = 'Players are online, but the server is hiding their names.';
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
                .setTitle('🔴 Server Offline')
                .setDescription(`Could not connect to **${host}:${port}**.\nCheck if the server is offline or the IP is wrong.`);
            
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};

