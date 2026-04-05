# RPS Hand Tactics

A browser-based 1v1 Rock Paper Scissors game with booster cards. Lightweight, works on phone and PC.

## Tech Stack

- **Monorepo**: npm workspaces (`shared/`, `server/`, `client/`)
- **Frontend**: SvelteKit 5 (Svelte 5 runes, adapter-auto), Socket.io-client
- **Backend**: Node.js + Socket.io (no Express, plain `http.createServer`)
- **Shared**: TypeScript package with types, card definitions, and resolution engine
- **Node version**: 22 (`.nvmrc` in root, use `nvm use` before running)
- **No database**: all game state is in-memory (`Map`)

## Commands

```bash
npm run dev:server    # Start game server on port 3001 (tsx watch)
npm run dev:client    # Start SvelteKit dev on port 5173
npm run build -w shared  # MUST rebuild after editing shared/ (server uses dist/)
npm run check -w client  # Svelte type-check
npx -w server tsc --noEmit  # Server type-check
```

**Important**: After any change to `shared/src/`, run `npm run build -w shared` before testing. The server imports from `shared/dist/`, not `src/`.

## Architecture

### Server-authoritative

The server owns all game state. Clients send intents (`submit-move`, `lock-in`), the server validates, resolves, and broadcasts results. Clients never compute outcomes.

### Project Structure

```
shared/src/
  types.ts        # All TypeScript interfaces (Move, Card, GameState, socket events)
  constants.ts    # Game constants (timers, hand size, max rounds)
  cards.ts        # Card definitions, CARD_CATALOG, DRAFT_CARD_LIST, drawRandomHand()
  resolution.ts   # Pure function resolveRound() — core game logic
  index.ts        # Re-exports everything

server/src/
  index.ts            # HTTP + Socket.io server setup (port 3001)
  socket-handlers.ts  # All socket event handlers, wires everything together
  room-manager.ts     # Room CRUD, 4-letter codes, player-to-room mapping
  matchmaking.ts      # Quick match queue with mode-aware pairing
  game-loop.ts        # Game state machine, round orchestration, timers, toClientState()

client/src/
  lib/stores/socket.ts  # Socket.io singleton + connected store
  lib/stores/game.ts    # All game state stores + socket event listeners
  lib/components/       # HandPicker, CardHand, CardSlot, Scoreboard, RoundResult, Timer
  routes/+page.svelte   # Single-page app: home, lobby, drafting, game, result screens
```

### State Machine

```
waiting → drafting (draft mode) → starting → picking → revealing → round-end → picking (loop)
        → starting (random mode)                                  → match-end (score >= 3 or round 5)
```

### Card System

Cards have two IDs: `id` (type identifier like `str-rock`) and `uid` (unique instance). Use `uid` for selection, keying, and removal. Use `id` for card type lookups and draft building.

#### Card Types

| Card | Type | Power Effect |
|------|------|-------------|
| +Rock/+Paper/+Scissors | strengthen | +1 to your move's power |
| -Rock/-Paper/-Scissors | weaken | -1 to opponent's move's power |
| Shield | special | Converts a loss to a tie (applied after outcome) |
| Tiebreaker | special | Converts a tie to a win (applied before Shield) |
| Invert | field | Reverses all matchups for the round |
| Nullify | nullify | Cancels opponent's card (both Nullify = both cancel) |
| Rock/Paper/Scissors Field +1 | field_persistent | +1 power to that element for ALL players. Persists until replaced |
| Rock/Paper/Scissors Field -1 | field_persistent | -1 power to that element for ALL players. Persists until replaced |

#### Resolution Algorithm (shared/src/resolution.ts)

Uses a **power-level system**. Each move starts with a base advantage from the RPS table (+1 win, 0 tie, -1 loss). Power modifiers shift this:

1. **Nullify** — cancel opponent's card
2. **Update persistent field** — if a field_persistent card was played
3. **Invert check** — flip the matchup table (both Invert = cancel)
4. **Calculate power** — accumulate modifiers from field + strengthen + weaken
5. **Resolve** — `advantage = base + (p1Power - p2Power)`. >=1 = win, <=-1 = lose, else tie
6. **Tiebreaker** — if tie, tiebreaker player wins (both = still tie)
7. **Shield** — if losing, convert to tie

#### Card Draft Modes

- **Random**: 3 cards dealt from CARD_CATALOG (25 cards pool, no duplicates in hand)
- **Draft**: Players pick 3 from DRAFT_CARD_LIST (unique card types). Duplicates allowed (can pick same card 3x). Blind simultaneous draft.

### Socket Events

**Client → Server**: `create-room`, `join-room`, `queue-quickmatch` (with `modes: GameMode[]`), `cancel-quickmatch`, `submit-draft`, `submit-move`, `lock-in`, `rematch`, `leave-game`

**Server → Client**: `room-created`, `room-joined`, `match-found`, `draft-start`, `game-start`, `round-start`, `opponent-locked`, `round-result`, `match-result`, `opponent-disconnected`, `error`

### Key Design Decisions

- Cards are consumed on play regardless of Nullify (prevents risk-free spam)
- Persistent field cards (`field_persistent`) stay active across rounds until any new field_persistent card is played. Invert does NOT replace the active field.
- Scores are integers (1 per win). Match ends at score >= 3 OR after 5 rounds (highest score wins, or draw).
- Timer auto-submits a random move with no card if player doesn't lock in.
- `toClientState()` in game-loop.ts strips opponent's hand and submission before sending to client.
- The Svelte client is a single-page app — all screens (home/lobby/draft/game/result) are in `+page.svelte` controlled by a `currentScreen` store.
