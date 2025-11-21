# ShotDevs Discord Bot

A complete, production-ready Discord bot featuring a Ticket System and a Counting System.

## Features

### Ticket System
- Multi-category support (Support, Issues, Partnership, Other).
- Persistent ticket panel.
- Ticket management: Claim, Close, Transcript, Lock/Unlock.
- Transcripts saved to log channel and DM'd to user.
- Configurable categories and staff roles.

### Counting System
- Strict counting validation (1, 2, 3...).
- Atomic database updates to prevent race conditions.
- Leaderboard tracking (streak, top counters).
- Admin controls (Reset, Set).

## Prerequisites

- Node.js v18+
- MongoDB (running locally or cloud)
- A Discord Bot Token

## Installation

1. **Clone the repository**
   ```bash
   git clone <repo_url>
   cd shotdevs-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   Copy `.env.example` to `.env` and fill in your details:
   ```env
   TOKEN=your_bot_token
   MONGO_URI=mongodb://localhost:27017/shotdevs_bot
   CLIENT_ID=your_client_id
   GUILD_ID=optional_guild_id_for_instant_deploy
   ```

4. **Deploy Commands**
   Run this once to register slash commands:
   ```bash
   npm run deploy
   ```

5. **Start the Bot**
   ```bash
   npm start
   ```

## Setup Guide

### 1. Ticket System Setup
1. Create categories for your tickets (e.g., "Support Tickets", "Partnerships").
2. Create a log channel for transcripts (e.g., #ticket-logs).
3. Create a staff role.
4. Run `/ticket-setup`:
   - `/ticket-setup type:support category:#SupportTickets log_channel:#ticket-logs staff_role:@Staff`
   - Repeat for other types (Issues, Partnership, Other).
5. Post the ticket panel:
   - `/ticket-post channel:#open-a-ticket`

### 2. Counting System Setup
1. Create a channel for counting (e.g., #counting).
2. Run `/count-setup add channel:#counting`.
3. Start counting from 1!
4. If needed, admins can use `/count set number:100` or `/count reset`.

## Project Structure

- `src/commands`: Slash command definitions.
- `src/events`: Event handlers (interaction, message).
- `src/models`: Mongoose schemas (GuildConfig, Ticket, Counting).
- `src/services`: Business logic (Ticket creation, Counting validation).
- `src/utils`: Helpers (Logger, Embeds).

## License

© ShotDevs
