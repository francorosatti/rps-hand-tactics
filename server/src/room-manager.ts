import {
  type GameState,
  type GameMode,
  type PlayerState,
  ROOM_CODE_LENGTH,
  STALE_ROOM_TTL_MS,
} from 'shared';

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O to avoid confusion
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function createPlayerState(id: string, name: string): PlayerState {
  return {
    id,
    name,
    hand: [],
    score: 0,
    submission: { move: null, cardUid: null, lockedIn: false },
  };
}

export class RoomManager {
  rooms = new Map<string, GameState>();
  playerToRoom = new Map<string, string>();
  private roomCreatedAt = new Map<string, number>();

  createRoom(playerId: string, playerName: string, mode: GameMode): string {
    let code: string;
    do {
      code = generateCode();
    } while (this.rooms.has(code));

    const state: GameState = {
      roomCode: code,
      mode,
      players: [createPlayerState(playerId, playerName)],
      phase: 'waiting',
      round: 0,
      roundResults: [],
      activeField: null,
      turnTimer: 0,
      rematchRequested: [false, false],
    };

    this.rooms.set(code, state);
    this.playerToRoom.set(playerId, code);
    this.roomCreatedAt.set(code, Date.now());
    return code;
  }

  joinRoom(roomCode: string, playerId: string, playerName: string): GameState | string {
    const state = this.rooms.get(roomCode);
    if (!state) return 'Room not found';
    if (state.players.length >= 2) return 'Room is full';
    if (state.phase !== 'waiting') return 'Game already in progress';

    state.players.push(createPlayerState(playerId, playerName));
    this.playerToRoom.set(playerId, roomCode);
    return state;
  }

  getRoom(roomCode: string): GameState | undefined {
    return this.rooms.get(roomCode);
  }

  getRoomByPlayer(playerId: string): GameState | undefined {
    const code = this.playerToRoom.get(playerId);
    return code ? this.rooms.get(code) : undefined;
  }

  getPlayerIndex(roomCode: string, playerId: string): number {
    const state = this.rooms.get(roomCode);
    if (!state) return -1;
    return state.players.findIndex((p) => p.id === playerId);
  }

  leaveRoom(playerId: string): { roomCode: string; opponentId?: string } | null {
    const code = this.playerToRoom.get(playerId);
    if (!code) return null;

    const state = this.rooms.get(code);
    this.playerToRoom.delete(playerId);

    if (!state) return null;

    const opponentId = state.players.find((p) => p.id !== playerId)?.id;

    // Clean up
    if (opponentId) {
      this.playerToRoom.delete(opponentId);
    }
    this.rooms.delete(code);
    this.roomCreatedAt.delete(code);

    return { roomCode: code, opponentId };
  }

  cleanupStaleRooms(): string[] {
    const now = Date.now();
    const removed: string[] = [];
    for (const [code, createdAt] of this.roomCreatedAt) {
      if (now - createdAt > STALE_ROOM_TTL_MS) {
        const state = this.rooms.get(code);
        if (state) {
          for (const p of state.players) {
            this.playerToRoom.delete(p.id);
          }
        }
        this.rooms.delete(code);
        this.roomCreatedAt.delete(code);
        removed.push(code);
      }
    }
    return removed;
  }
}
