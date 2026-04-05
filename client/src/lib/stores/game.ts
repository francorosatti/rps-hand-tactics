import { writable, get } from 'svelte/store';
import type {
  ClientGameState,
  Card,
  RoundResult,
  ActiveField,
  GameMode,
} from 'shared';
import { getSocket } from './socket.js';

export const gameState = writable<ClientGameState | null>(null);
export const draftCards = writable<Card[]>([]);
export const currentScreen = writable<'home' | 'lobby' | 'drafting' | 'game' | 'result'>('home');
export const opponentDisconnected = writable(false);
export const matchResult = writable<{ winner: 0 | 1 | null; finalScore: [number, number] } | null>(null);
export const lastRoundResult = writable<RoundResult | null>(null);
export const errorMessage = writable<string | null>(null);
export const searching = writable(false);
export const rematchState = writable<'none' | 'sent' | 'received'>('none');

export function initGameListeners(): void {
  const socket = getSocket();

  socket.on('room-created', ({ roomCode }) => {
    gameState.update((s) => {
      if (!s) {
        return {
          roomCode,
          mode: 'random' as GameMode,
          playerIndex: 0,
          players: [
            { name: '', score: 0, cardCount: 0, hand: [], submission: { move: null, cardUid: null, lockedIn: false }, lockedIn: false },
            { name: '', score: 0, cardCount: 0, lockedIn: false },
          ],
          phase: 'waiting',
          round: 0,
          roundResults: [],
          activeField: null,
          turnTimer: 0,
        } satisfies ClientGameState;
      }
      return { ...s, roomCode };
    });
    currentScreen.set('lobby');
  });

  socket.on('room-joined', ({ gameState: gs }) => {
    gameState.set(gs);
    currentScreen.set('lobby');
  });

  socket.on('match-found', ({ roomCode }) => {
    searching.set(false);
    currentScreen.set('lobby');
  });

  socket.on('draft-start', ({ cards }) => {
    draftCards.set(cards);
    currentScreen.set('drafting');
  });

  socket.on('game-start', ({ gameState: gs }) => {
    gameState.set(gs);
    lastRoundResult.set(null);
    matchResult.set(null);
    opponentDisconnected.set(false);
    currentScreen.set('game');
  });

  socket.on('round-start', ({ round, timeLimit }) => {
    gameState.update((s) => {
      if (!s) return s;
      return {
        ...s,
        round,
        phase: 'picking',
        turnTimer: timeLimit,
        players: s.players.map((p, i) => {
          if (i === s.playerIndex) {
            return { ...p, submission: { move: null, cardUid: null, lockedIn: false }, lockedIn: false };
          }
          return { ...p, lockedIn: false };
        }) as [typeof s.players[0], typeof s.players[1]],
      };
    });
    lastRoundResult.set(null);
  });

  socket.on('opponent-locked', () => {
    gameState.update((s) => {
      if (!s) return s;
      const opIdx = s.playerIndex === 0 ? 1 : 0;
      const players = [...s.players] as [typeof s.players[0], typeof s.players[1]];
      players[opIdx] = { ...players[opIdx], lockedIn: true };
      return { ...s, players };
    });
  });

  socket.on('round-result', ({ result, activeField, scores }) => {
    lastRoundResult.set(result);
    gameState.update((s) => {
      if (!s) return s;
      const players = s.players.map((p, i) => ({
        ...p,
        score: scores[i],
      })) as [typeof s.players[0], typeof s.players[1]];

      // Remove played card from local hand
      if (result.cards[s.playerIndex] && players[s.playerIndex].hand) {
        const playedCardUid = result.cards[s.playerIndex]!.uid;
        players[s.playerIndex] = {
          ...players[s.playerIndex],
          hand: players[s.playerIndex].hand!.filter((c) => c.uid !== playedCardUid),
          cardCount: players[s.playerIndex].cardCount - 1,
        };
      }

      return {
        ...s,
        phase: 'revealing',
        roundResults: [...s.roundResults, result],
        activeField,
        players,
      };
    });
  });

  socket.on('match-result', (data) => {
    matchResult.set(data);
    currentScreen.set('result');
    rematchState.set('none');
    gameState.update((s) => (s ? { ...s, phase: 'match-end' } : s));
  });

  socket.on('rematch-requested', () => {
    rematchState.set('received');
  });

  socket.on('rematch-declined', () => {
    rematchState.set('none');
  });

  socket.on('opponent-disconnected', () => {
    opponentDisconnected.set(true);
  });

  socket.on('error', ({ message }) => {
    errorMessage.set(message);
    setTimeout(() => errorMessage.set(null), 3000);
  });
}
