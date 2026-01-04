import { Client, GatewayIntentBits, Collection, Partials, ActivityType } from 'discord.js';
import config, { validateConfig } from './utils/config.js';
import { connectDB } from './utils/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { status } from 'minecraft-server-util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- CONFIGURATION ---
const SERVER_IP = 'in2.kymc.xyz'; 
const SERVER_PORT = 30407;
// ---------------------

if (!validateConfig()) {
  console.error('Bot configuration is invalid. Exiting...');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction]
});

client.commands = new Collection();
const commandsToDeploy = [];

// 1. Load Commands
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  
  (async () => {
    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      try {
        const module = await import(filePath);
        const command = module.default;

        if ('data' in command && 'execute' in command) {
          client.commands.set(command.data.name, command);
          commandsToDeploy.push(command.data.toJSON());
          console.log(`[CMD] Loaded Slash Command: ${command.data.name}`);
        } 
        else if ('name' in command && 'execute' in command) {
          client.commands.set(command.name, command);
          commandsToDeploy.push({ name: command.name, description: 'No description.' });
          console.log(`[CMD] Loaded Simple Command: ${command.name}`);
        }
      } catch (err) {
        console.error(`[ERROR] Failed to load command ${file}:`, err);
      }
    }
  })();
}

// 2. Load Events (Optional now, since we handle interactions below)
const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    import(filePath).then(module => {
      const event = module.default;
      if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
      } else {
        client.on(event.name, (...args) => event.execute(...args, client));
      }
    }).catch(err => console.error(`[ERROR] Failed to load event ${file}:`, err));
  }
}

// ============================================================
// 3. THIS IS THE MISSING PIECE: The Command Handler
// ============================================================
client.on('interactionCreate', async interaction => {
    // We only care about Chat Commands (Slash Commands)
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
    }

    try {
        // Execute the command code
        await command.execute(interaction, client);
    } catch (error) {
        console.error(`Error executing ${interaction.commandName}`);
        console.error(error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'There was an error executing this command!', ephemeral: true });
        } else {
            await interaction.reply({ content: 'There was an error executing this command!', ephemeral: true });
        }
    }
});
// ============================================================


client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    
    // 4. Auto-Deploy Commands
    if (commandsToDeploy.length > 0) {
        try {
            console.log(`[DEPLOY] Refreshing ${commandsToDeploy.length} commands...`);
            await client.application.commands.set(commandsToDeploy);
            console.log('[DEPLOY] Commands registered!');
        } catch (error) {
            console.error('[DEPLOY ERROR]', error);
        }
    }

    // 5. Status Loop
    const updateStatus = async () => {
        try {
            const result = await status(SERVER_IP, SERVER_PORT);
            client.user.setActivity(`with ${result.players.online}/${result.players.max} players`, { type: ActivityType.Playing });
        } catch (error) {
            client.user.setActivity('Server Offline', { type: ActivityType.Watching });
        }
    };
    updateStatus();
    setInterval(updateStatus, 60000); 
});

(async () => {
  await connectDB();
  await client.login(config.DISCORD_TOKEN);
})();

