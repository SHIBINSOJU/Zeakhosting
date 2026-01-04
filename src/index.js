import { Client, GatewayIntentBits, Collection, Partials, ActivityType } from 'discord.js';
import config, { validateConfig } from './utils/config.js';
import { connectDB } from './utils/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { status } from 'minecraft-server-util'; // Import this for the bot status

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- CONFIGURATION FOR STATUS ---
const SERVER_IP_FOR_STATUS = 'play.zeakmc.net'; // CHANGE THIS to your server IP
const SERVER_PORT = 25565; // Default Java port
// --------------------------------

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

// Load Commands
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
        } else if ('name' in command && 'execute' in command) {
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

// Load Events
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

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    
    // 1. AUTO-DEPLOY COMMANDS
    if (commandsToDeploy.length > 0) {
        try {
            console.log(`[DEPLOY] Refreshing ${commandsToDeploy.length} commands...`);
            await client.application.commands.set(commandsToDeploy);
            console.log('[DEPLOY] Commands registered globaly.');
        } catch (error) {
            console.error('[DEPLOY ERROR]', error);
        }
    }

    // 2. LIVE BOT STATUS LOOP
    const updateStatus = async () => {
        try {
            // Fetch server info
            const result = await status(SERVER_IP_FOR_STATUS, SERVER_PORT);
            const playerCount = result.players.online;
            const maxPlayers = result.players.max;

            // Set Activity: "Playing with 77/100 players"
            client.user.setActivity(`with ${playerCount}/${maxPlayers} players`, { type: ActivityType.Playing });
        } catch (error) {
            console.warn(`[STATUS] Could not fetch ${SERVER_IP_FOR_STATUS}`);
            client.user.setActivity('Server Offline', { type: ActivityType.Watching });
        }
    };

    // Run immediately, then every 60 seconds
    updateStatus();
    setInterval(updateStatus, 60000); 
});

// Start
(async () => {
  await connectDB();
  await client.login(config.DISCORD_TOKEN);
})();
