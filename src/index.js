import { Client, GatewayIntentBits, Collection, Partials } from 'discord.js';
import config, { validateConfig } from './utils/config.js';
import { connectDB } from './utils/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
const commandsToDeploy = []; // Array to hold command data for deployment

// Load Commands
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  
  // We need to wait for all commands to load before starting the bot
  // so we wrap this in an async function immediately
  (async () => {
    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      try {
        const module = await import(filePath);
        const command = module.default;

        // Support both "SlashCommandBuilder" (data) and simple objects (name)
        if ('data' in command && 'execute' in command) {
          client.commands.set(command.data.name, command);
          commandsToDeploy.push(command.data.toJSON());
          console.log(`[CMD] Loaded Slash Command: ${command.data.name}`);
        } 
        else if ('name' in command && 'execute' in command) {
          client.commands.set(command.name, command);
          // If it's a simple command, we create a basic slash definition
          commandsToDeploy.push({ 
            name: command.name, 
            description: command.description || 'No description provided.' 
          });
          console.log(`[CMD] Loaded Simple Command: ${command.name}`);
        } else {
          console.warn(`[WARNING] The command at ${filePath} is missing "data" or "name".`);
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
      console.log(`[EVENT] Loaded event: ${event.name}`);
    }).catch(err => console.error(`[ERROR] Failed to load event ${file}:`, err));
  }
}

// Auto-Deploy Commands when the bot is ready
client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    
    // Only deploy if we actually loaded commands
    if (commandsToDeploy.length > 0) {
        try {
            console.log(`[DEPLOY] Started refreshing ${commandsToDeploy.length} application (/) commands.`);
            
            // This deploys to ALL servers (Global). 
            // Note: Global updates can take up to 1 hour to cache, but usually instant for dev bots.
            await client.application.commands.set(commandsToDeploy);
            
            console.log('[DEPLOY] Successfully reloaded application (/) commands.');
        } catch (error) {
            console.error('[DEPLOY ERROR]', error);
        }
    }
});

// Start
(async () => {
  await connectDB();
  await client.login(config.DISCORD_TOKEN);
})();
