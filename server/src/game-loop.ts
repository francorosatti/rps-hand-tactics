import type { Server } from 'socket.io';
import type {
  GameState,
  Move,
  ClientGameState,
  ClientPlayerView,
  ServerToClientEvents,
  ClientToServerEvents,
} from 'shared';
import {
  HAND_SIZE,
  PICK_TIMER_SECONDS,
  DRAFT_TIMER_SECONDS,
  ROUND_END_PAUSE_MS,
  ROUNDS_TO_WIN,
  MAX_ROUNDS,
  drawRandomHand,
  resolveRound,
} from 'shared';

const MOVES: Move[] = ['rock', 'paper', 'scissors'];

type IO = Server<ClientToServerEvents, ServerToClientEvents>;

const timers = new Map<string, ReturnType<typeof setTimeout>>();

function clearRoomTimer(roomCode: string) {
  const t = timers.get(roomCode);
  if (t) {
    clearTimeout(t);
    timers.delete(roomCode);
  }
}

export function toClientState(state: GameState, playerIndex: number): ClientGameState {
  const players = state.players.map((p, i): ClientPlayerView => {
    const isLocal = i === playerIndex;
    return {
      name: p.name,
      score: p.score,
      cardCount: p.hand.length,
      hand: isLocal ? p.hand : undefined,
      submission: isLocal ? p.submission : undefined,
      lockedIn: p.submission.lockedIn,
    };
  }) as [ClientPlayerView, ClientPlayerView];

  return {
    roomCode: state.roomCode,
    mode: state.mode,
    playerIndex,
    players,
    phase: state.phase,
    round: state.round,
    roundResults: state.roundResults,
    activeField: state.activeField,
    turnTimer: state.turnTimer,
  };
}

export function startGame(io: IO, state: GameState): void {
  if (state.mode === 'random') {
    // Deal random hands
    state.players[0].hand = drawRandomHand(HAND_SIZE);
    state.players[1].hand = drawRandomHand(HAND_SIZE);
    state.phase = 'starting';
    emitGameStart(io, state);
    startRound(io, state);
  } else {
    // Draft mode
    state.phase = 'drafting';
    // Import DRAFT_CARD_LIST dynamically to avoid circular deps
    import('shared').then(({ DRAFT_CARD_LIST }) => {
      for (const p of state.players) {
        io.to(p.id).emit('draft-start', { cards: DRAFT_CARD_LIST });
      }
    });
  }
}

export function finishDraft(io: IO, state: GameState): void {
  state.phase = 'starting';
  emitGameStart(io, state);
  startRound(io, state);
}

function emitGameStart(io: IO, state: GameState): void {
  for (let i = 0; i < state.players.length; i++) {
    io.to(state.players[i].id).emit('game-start', {
      gameState: toClientState(state, i),
    });
  }
}

export function startRound(io: IO, state: GameState): void {
  state.round++;
  state.phase = 'picking';
  state.turnTimer = PICK_TIMER_SECONDS;

  // Reset submissions
  for (const p of state.players) {
    p.submission = { move: null, cardUid: null, lockedIn: false };
  }

  for (const p of state.players) {
    io.to(p.id).emit('round-start', {
      round: state.round,
      timeLimit: PICK_TIMER_SECONDS,
    });
  }

  // Timer: auto-resolve when time runs out
  clearRoomTimer(state.roomCode);
  timers.set(
    state.roomCode,
    setTimeout(() => {
      autoResolve(io, state);
    }, PICK_TIMER_SECONDS * 1000)
  );
}

function autoResolve(io: IO, state: GameState): void {
  if (state.phase !== 'picking') return;

  // Auto-submit random moves for players who haven't locked in
  for (const p of state.players) {
    if (!p.submission.lockedIn) {
      p.submission.move = MOVES[Math.floor(Math.random() * MOVES.length)];
      p.submission.cardUid = null;
      p.submission.lockedIn = true;
    }
  }

  doResolve(io, state);
}

export function checkBothLockedIn(io: IO, state: GameState): void {
  if (state.players.every((p) => p.submission.lockedIn)) {
    clearRoomTimer(state.roomCode);
    doResolve(io, state);
  }
}

function doResolve(io: IO, state: GameState): void {
  state.phase = 'revealing';

  const p1 = state.players[0];
  const p2 = state.players[1];

  const p1Card = p1.submission.cardUid
    ? p1.hand.find((c) => c.uid === p1.submission.cardUid) ?? null
    : null;
  const p2Card = p2.submission.cardUid
    ? p2.hand.find((c) => c.uid === p2.submission.cardUid) ?? null
    : null;

  // Remove played cards from hands
  if (p1Card) {
    const idx = p1.hand.findIndex((c) => c.uid === p1.submission.cardUid);
    if (idx !== -1) p1.hand.splice(idx, 1);
  }
  if (p2Card) {
    const idx = p2.hand.findIndex((c) => c.uid === p2.submission.cardUid);
    if (idx !== -1) p2.hand.splice(idx, 1);
  }

  const { result, newActiveField } = resolveRound({
    p1: { move: p1.submission.move!, card: p1Card },
    p2: { move: p2.submission.move!, card: p2Card },
    activeField: state.activeField,
    round: state.round,
  });

  state.activeField = newActiveField;
  state.roundResults.push(result);

  // Update scores
  p1.score += result.scoreAwarded[0];
  p2.score += result.scoreAwarded[1];

  // Emit round result
  for (const p of state.players) {
    io.to(p.id).emit('round-result', {
      result,
      activeField: state.activeField,
      scores: [p1.score, p2.score],
    });
  }

  // Check for match end
  const someoneWon = p1.score >= ROUNDS_TO_WIN || p2.score >= ROUNDS_TO_WIN;
  const maxRoundsReached = state.round >= MAX_ROUNDS;

  if (someoneWon || maxRoundsReached) {
    state.phase = 'round-end';
    let winner: 0 | 1 | null;
    if (p1.score > p2.score) winner = 0;
    else if (p2.score > p1.score) winner = 1;
    else winner = null; // draw

    // Delay match-result so the last round animation plays
    clearRoomTimer(state.roomCode);
    timers.set(
      state.roomCode,
      setTimeout(() => {
        state.phase = 'match-end';
        for (const p of state.players) {
          io.to(p.id).emit('match-result', {
            winner,
            finalScore: [p1.score, p2.score],
          });
        }
      }, ROUND_END_PAUSE_MS)
    );
  } else {
    state.phase = 'round-end';
    clearRoomTimer(state.roomCode);
    timers.set(
      state.roomCode,
      setTimeout(() => {
        startRound(io, state);
      }, ROUND_END_PAUSE_MS)
    );
  }
}

export function cleanupRoom(roomCode: string): void {
  clearRoomTimer(roomCode);
}
