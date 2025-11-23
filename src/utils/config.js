import dotenv from 'dotenv';
dotenv.config();

const requiredEnvVars = [
  'DISCORD_TOKEN',
  'MONGODB_URI',
  // We can add other critical ones here, or just warn if they are missing
];

const config = {
  DISCORD_TOKEN: process.env.DISCORD_TOKEN,
  PREFIX: process.env.PREFIX || '!',
  MONGODB_URI: process.env.MONGODB_URI,

  // Ticket System
  TICKET_PANEL_CHANNEL_ID: process.env.TICKET_PANEL_CHANNEL_ID,
  TICKET_LOG_CHANNEL_ID: process.env.TICKET_LOG_CHANNEL_ID,
  STAFF_ROLE_ID: process.env.STAFF_ROLE_ID,
  TICKET_DESCRIPTION: process.env.TICKET_DESCRIPTION || 'Click a button below to open a ticket.',
  TICKET_CATEGORY_SUPPORT_ID: process.env.TICKET_CATEGORY_SUPPORT_ID,
  TICKET_CATEGORY_TECHNICAL_ID: process.env.TICKET_CATEGORY_TECHNICAL_ID,
  TICKET_CATEGORY_PARTNERSHIP_ID: process.env.TICKET_CATEGORY_PARTNERSHIP_ID,
  TICKET_CATEGORY_OTHER_ID: process.env.TICKET_CATEGORY_OTHER_ID,

  // Counting System
  COUNTING_CHANNEL_ID: process.env.COUNTING_CHANNEL_ID,
  COUNTING_START_NUMBER: parseInt(process.env.COUNTING_START_NUMBER || '1', 10),

  // Echo System
  ECHO_ENABLED: process.env.ECHO_ENABLED === 'true',
  ECHO_CHANNEL_ID: process.env.ECHO_CHANNEL_ID,

  // Welcome System 
  WELCOME_ENABLED: process.env.WELCOME_ENABLED === 'true',
  WELCOME_CHANNEL_ID: process.env.WELCOME_CHANNEL_ID,
};

export function validateConfig() {
  const missing = requiredEnvVars.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error(`[ERROR] Missing required environment variables: ${missing.join(', ')}`);
    // As per instructions: fail safely and log an error rather than crashing.
    // However, without a TOKEN, we can't really start.
    // I'll return false so the main loop can decide whether to proceed or not.
    return false;
  }
  return true;
}

export default config;
