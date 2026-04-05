// --- Moves ---
export type Move = 'rock' | 'paper' | 'scissors';

// --- Cards ---
export type CardType = 'strengthen' | 'weaken' | 'special' | 'field' | 'field_persistent' | 'nullify';

export type CardEffect =
  | { kind: 'strengthen'; move: Move }
  | { kind: 'weaken'; move: Move }
  | { kind: 'shield' }
  | { kind: 'tiebreaker' }
  | { kind: 'invert' }
  | { kind: 'nullify' }
  | { kind: 'field_persistent'; move: Move; modifier: 1 | -1 };

export interface Card {
  id: string;         // card type identifier (e.g. 'str-rock')
  uid: string;        // unique instance identifier
  name: string;
  type: CardType;
  description: string;
  effect: CardEffect;
}

// --- Player state within a game ---
export interface PlayerSubmission {
  move: Move | null;
  cardUid: string | null;
  lockedIn: boolean;
}

export interface PlayerState {
  id: string;
  name: string;
  hand: Card[];
  score: number;
  submission: PlayerSubmission;
}

// --- Game state machine ---
export type GameMode = 'draft' | 'random';

export type GamePhase =
  | 'waiting'
  | 'drafting'
  | 'starting'
  | 'picking'
  | 'revealing'
  | 'round-end'
  | 'match-end';

export interface ActiveField {
  move: Move;
  modifier: 1 | -1;
}

export interface DetailEntry {
  key: string;
  params?: Record<string, string>;
}

export interface RoundResult {
  round: number;
  moves: [Move, Move];
  cards: [Card | null, Card | null];
  winner: 0 | 1 | null;
  scoreAwarded: [number, number];
  details: DetailEntry[];
}

export interface GameState {
  roomCode: string;
  mode: GameMode;
  players: PlayerState[];
  phase: GamePhase;
  round: number;
  roundResults: RoundResult[];
  activeField: ActiveField | null;
  turnTimer: number;
  rematchRequested: [boolean, boolean];
}

// --- Client view (hides opponent's hand and submission) ---
export interface ClientGameState {
  roomCode: string;
  mode: GameMode;
  playerIndex: number;
  players: [ClientPlayerView, ClientPlayerView];
  phase: GamePhase;
  round: number;
  roundResults: RoundResult[];
  activeField: ActiveField | null;
  turnTimer: number;
}

export interface ClientPlayerView {
  name: string;
  score: number;
  cardCount: number;
  hand?: Card[];          // only present for the local player
  submission?: PlayerSubmission; // only present for the local player
  lockedIn: boolean;
}

// --- Socket events ---
export interface ServerToClientEvents {
  'room-created': (data: { roomCode: string }) => void;
  'room-joined': (data: { gameState: ClientGameState }) => void;
  'match-found': (data: { roomCode: string }) => void;
  'draft-start': (data: { cards: Card[] }) => void;
  'game-start': (data: { gameState: ClientGameState }) => void;
  'round-start': (data: { round: number; timeLimit: number }) => void;
  'opponent-locked': () => void;
  'round-result': (data: { result: RoundResult; activeField: ActiveField | null; scores: [number, number] }) => void;
  'match-result': (data: { winner: 0 | 1 | null; finalScore: [number, number] }) => void;
  'rematch-requested': () => void;
  'rematch-declined': () => void;
  'opponent-disconnected': () => void;
  'error': (data: { message: string }) => void;
}

export interface ClientToServerEvents {
  'create-room': (data: { playerName: string; mode: GameMode }) => void;
  'join-room': (data: { roomCode: string; playerName: string }) => void;
  'queue-quickmatch': (data: { playerName: string; modes: GameMode[] }) => void;
  'cancel-quickmatch': () => void;
  'submit-draft': (data: { cardIds: string[] }) => void;
  'submit-move': (data: { move: Move; cardUid?: string }) => void;
  'lock-in': () => void;
  'rematch': () => void;
  'decline-rematch': () => void;
  'leave-game': () => void;
}
