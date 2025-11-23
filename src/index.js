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

// Load Commands
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    import(filePath).then(module => {
      const command = module.default;
      if ('name' in command && 'execute' in command) {
        client.commands.set(command.name, command);
        console.log(`[CMD] Loaded command: ${command.name}`);
      } else {
        console.warn(`[WARNING] The command at ${filePath} is missing a required "name" or "execute" property.`);
      }
    }).catch(err => console.error(`[ERROR] Failed to load command ${file}:`, err));
  }
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

// Start
(async () => {
  await connectDB();
  await client.login(config.DISCORD_TOKEN);
})();
