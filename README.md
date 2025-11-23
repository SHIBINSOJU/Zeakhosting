# ShotBot – Tickets + Counting + Echo Discord Bot

ShotBot is a Discord bot that provides:

- 🎫 **Ticket system** with 4 category buttons and per-category Discord channel categories  
- 🔢 **Counting system** with MongoDB, validation, and anti-double-counting  
- 🔁 **Echo system** that repeats messages like `shibin is top`  

---

## Features

### 1. Ticket System

- Ticket panel in a dedicated ticket channel.
- 4 buttons:
  - 🆘 **Support**
  - 🛠️ **Technical**
  - 🤝 **Partnership**
  - ❓ **Other**
- Each button creates a ticket channel under a specific **Discord category**:
  - Support → `TICKET_CATEGORY_SUPPORT_ID`
  - Technical → `TICKET_CATEGORY_TECHNICAL_ID`
  - Partnership → `TICKET_CATEGORY_PARTNERSHIP_ID`
  - Other → `TICKET_CATEGORY_OTHER_ID`
- Ticket embed uses **server icon as thumbnail**.
- Inside each ticket:
  - **Claim** button → staff member claims the ticket.
  - **Close** button → closes ticket, generates transcript.
- On close:
  - Transcript/log is sent to a **log channel** (`TICKET_LOG_CHANNEL_ID`).
  - Ticket creator gets a **DM** with logs/transcript (if possible).
  - Ticket channel is locked for the user and can optionally be deleted later.

### 2. Counting System

- Runs in one channel set by `COUNTING_CHANNEL_ID`.
- People count `1, 2, 3, 4, ...` in order.
- MongoDB stores:
  - `currentNumber` (next expected number)
  - `lastUserId` (who last counted correctly)
- Rules:
  - If the number is correct:
    - Bot reacts with ✅
    - Updates `currentNumber` and `lastUserId`
  - If the number is wrong:
    - Bot replies with an **ephemeral-style** message explaining the correct next number.
    - Deletes the wrong message.
  - **One message per user in a row**:
    - If the same user tries to count twice in a row:
      - Bot warns them (ephemeral-style).
      - Deletes the message.
      - Count does not progress.

### 3. Echo System

- Controlled by:
  - `ECHO_ENABLED`
  - `ECHO_CHANNEL_ID` (optional)
- When enabled, in the echo channel:
  - User: `shibin is top`  
  - Bot: `shibin is top`
- The bot repeats the **exact same content**, no extra text.

---

## Project Structure

Suggested Node.js/discord.js + MongoDB structure:

```bash
project-root/
├─ src/
│  ├─ index.js                # Bot entry point
│  ├─ config/
│  │  └─ env.js               # Loads and validates environment variables
│  ├─ database/
│  │  ├─ mongo.js             # MongoDB connection
│  │  ├─ models/
│  │  │  ├─ Ticket.js         # Ticket schema/model
│  │  │  └─ CountingState.js  # Counting state model
│  ├─ features/
│  │  ├─ tickets/
│  │  │  ├─ ticketPanel.js    # Sends the ticket panel with 4 buttons
│  │  │  ├─ ticketCreate.js   # Handles button clicks to create tickets
│  │  │  ├─ ticketActions.js  # Claim / Close / transcript logic
│  │  ├─ counting/
│  │  │  ├─ countingHandler.js # Handles counting channel messages
│  │  ├─ echo/
│  │  │  └─ echoHandler.js    # Echo system logic
│  ├─ commands/
│  │  ├─ ticketpanel.js       # Command to post the ticket panel
│  │  └─ resetcount.js        # Optional command to reset counting
│  ├─ utils/
│  │  ├─ logger.js            # Logging helper
│  │  └─ transcript.js        # Utility to generate ticket transcripts
│  └─ events/
│     ├─ ready.js             # Bot ready event
│     ├─ interactionCreate.js # Button interactions (tickets)
│     └─ messageCreate.js     # Counting + echo
├─ .env                       # Your real env values (not committed)
├─ .env.example               # Example env model
├─ package.json
└─ README.md
