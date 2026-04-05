# RPS Hand Tactics

A browser-based 1v1 Rock Paper Scissors game with booster cards.

## Prerequisites

- Node.js 22+ (use `nvm use` if you have nvm installed)
- npm 10+

## Setup

```bash
# Install all dependencies (shared, server, client)
npm install

# Build the shared package (required before first run)
npm run build -w shared
```

## Running Locally

You need two terminals:

**Terminal 1 — Game Server (port 3001)**
```bash
npm run dev:server
```

**Terminal 2 — Web Client (port 5173)**
```bash
npm run dev:client
```

Open `http://localhost:5173` in your browser. To test multiplayer, open a second tab.

## How to Play

1. Enter your name on the home screen
2. **Create Room** — pick Random or Draft mode, share the 4-letter code with a friend
3. **Join Room** — enter a room code to join a friend's game
4. **Quick Match** — queue up for a random opponent (select which modes you want)

### Game Flow

- Best of 5 rounds, first to 3 wins
- Each round: pick Rock, Paper, or Scissors + optionally play a booster card
- Lock in your choice before the 60-second timer runs out
- Both players reveal simultaneously

### Booster Cards

Each player gets 3 cards per match (drafted or random).

| Card | Effect |
|------|--------|
| +Rock / +Paper / +Scissors | Strengthens your move (wins mirrors, ties counters) |
| -Rock / -Paper / -Scissors | Weakens opponent's move (loses to mirrors, ties what it beats) |
| Shield | Converts a loss into a tie |
| Tiebreaker | Converts a tie into a win |
| Invert | Reverses all matchups for the round |
| Nullify | Cancels the opponent's booster card |
| Element Field +1 | Globally strengthens an element for all players (persists across rounds) |
| Element Field -1 | Globally weakens an element for all players (persists across rounds) |

## Project Structure

```
shared/   — TypeScript types, card definitions, resolution engine
server/   — Node.js + Socket.io game server
client/   — SvelteKit frontend
```

See [CLAUDE.md](CLAUDE.md) for full technical documentation.
