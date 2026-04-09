import type { Server, Socket } from 'socket.io';
import type {
	ChatMessage,
	ClientToServerEvents,
	ServerToClientEvents,
} from 'shared';
import { HAND_SIZE, buildDraftHand } from 'shared';
import { RoomManager } from './room-manager.js';
import { MatchmakingQueue } from './matchmaking.js';
import {
	startGame,
	finishDraft,
	checkBothLockedIn,
	toClientState,
	cleanupRoom,
} from './game-loop.js';

type IO = Server<ClientToServerEvents, ServerToClientEvents>;
type ClientSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

const MAX_CHAT_LENGTH = 200;

const rooms = new RoomManager();
const queue = new MatchmakingQueue();

function sanitizeChatText(text: string): string {
	return text.replace(/\s+/g, ' ').trim();
}

export function registerHandlers(io: IO): void {
	// Periodic stale room cleanup
	setInterval(() => {
		const removed = rooms.cleanupStaleRooms();
		if (removed.length > 0) {
			for (const code of removed) cleanupRoom(code);
		}
	}, 60_000);

	io.on('connection', (socket: ClientSocket) => {
		console.log(`Connected: ${socket.id}`);

		socket.on('create-room', ({ playerName, mode }) => {
			const code = rooms.createRoom(socket.id, playerName, mode);
			socket.join(code);
			socket.emit('room-created', { roomCode: code });
			console.log(`Room ${code} created by ${playerName} (${mode} mode)`);
		});

		socket.on('join-room', ({ roomCode, playerName }) => {
			const code = roomCode.toUpperCase();
			const result = rooms.joinRoom(code, socket.id, playerName);
			if (typeof result === 'string') {
				socket.emit('error', { message: result });
				return;
			}

			socket.join(code);

			// Notify both players
			for (let i = 0; i < result.players.length; i++) {
				io.to(result.players[i].id).emit('room-joined', {
					gameState: toClientState(result, i),
				});
			}

			console.log(`${playerName} joined room ${code}`);
			startGame(io, result);
		});

		socket.on('queue-quickmatch', ({ playerName, modes }) => {
			queue.enqueue(socket.id, playerName, modes);
			console.log(`${playerName} queued for quickmatch (${modes.join(', ')})`);

			const match = queue.tryMatch();
			if (match) {
				const { p1, p2, mode } = match;
				const code = rooms.createRoom(p1.playerId, p1.playerName, mode);
				const state = rooms.joinRoom(code, p2.playerId, p2.playerName);

				if (typeof state === 'string') {
					// Should not happen
					console.error('Quickmatch room join failed:', state);
					return;
				}

				const s1 = io.sockets.sockets.get(p1.playerId);
				const s2 = io.sockets.sockets.get(p2.playerId);
				s1?.join(code);
				s2?.join(code);

				io.to(p1.playerId).emit('match-found', { roomCode: code });
				io.to(p2.playerId).emit('match-found', { roomCode: code });

				console.log(
					`Quickmatch: ${p1.playerName} vs ${p2.playerName} in ${code} (${mode})`,
				);
				startGame(io, state);
			}
		});

		socket.on('cancel-quickmatch', () => {
			queue.dequeue(socket.id);
		});

		socket.on('submit-draft', ({ cardIds }) => {
			const state = rooms.getRoomByPlayer(socket.id);
			if (!state || state.phase !== 'drafting') return;

			if (cardIds.length !== HAND_SIZE) {
				socket.emit('error', { message: `Pick exactly ${HAND_SIZE} cards` });
				return;
			}

			const playerIdx = rooms.getPlayerIndex(state.roomCode, socket.id);
			if (playerIdx === -1) return;

			try {
				state.players[playerIdx].hand = buildDraftHand(cardIds);
			} catch (e: any) {
				socket.emit('error', { message: e.message });
				return;
			}

			// Check if both players have drafted
			if (state.players.every((p) => p.hand.length === HAND_SIZE)) {
				finishDraft(io, state);
			}
		});

		socket.on('submit-move', ({ move, cardUid }) => {
			const state = rooms.getRoomByPlayer(socket.id);
			if (!state || state.phase !== 'picking') return;

			const playerIdx = rooms.getPlayerIndex(state.roomCode, socket.id);
			if (playerIdx === -1) return;

			const player = state.players[playerIdx];
			if (player.submission.lockedIn) return;

			// Validate card
			if (cardUid && !player.hand.some((c) => c.uid === cardUid)) {
				socket.emit('error', { message: 'Card not in hand' });
				return;
			}

			player.submission.move = move;
			player.submission.cardUid = cardUid ?? null;
		});

		socket.on('lock-in', () => {
			const state = rooms.getRoomByPlayer(socket.id);
			if (!state || state.phase !== 'picking') return;

			const playerIdx = rooms.getPlayerIndex(state.roomCode, socket.id);
			if (playerIdx === -1) return;

			const player = state.players[playerIdx];
			if (player.submission.lockedIn) return;
			if (!player.submission.move) {
				socket.emit('error', { message: 'Select a move first' });
				return;
			}

			player.submission.lockedIn = true;

			// Notify opponent
			const opponentIdx = playerIdx === 0 ? 1 : 0;
			io.to(state.players[opponentIdx].id).emit('opponent-locked');

			checkBothLockedIn(io, state);
		});

		socket.on('send-chat-message', ({ text }) => {
			const state = rooms.getRoomByPlayer(socket.id);
			if (!state || state.players.length < 2) return;

			const playerIdx = rooms.getPlayerIndex(state.roomCode, socket.id);
			if (playerIdx === -1) return;

			const cleanText = sanitizeChatText(text);
			if (!cleanText) return;

			if (cleanText.length > MAX_CHAT_LENGTH) {
				socket.emit('error', {
					message: `Message too long (max ${MAX_CHAT_LENGTH} chars)`,
				});
				return;
			}

			const message: ChatMessage = {
				id: `${Date.now()}-${socket.id.slice(0, 6)}`,
				playerIndex: playerIdx === 0 ? 0 : 1,
				playerName: state.players[playerIdx].name,
				text: cleanText,
				sentAt: Date.now(),
			};

			io.to(state.roomCode).emit('chat-message', { message });
		});

		socket.on('rematch', () => {
			const state = rooms.getRoomByPlayer(socket.id);
			if (!state || state.phase !== 'match-end') return;

			const playerIdx = state.players.findIndex((p) => p.id === socket.id);
			if (playerIdx === -1) return;

			state.rematchRequested[playerIdx] = true;
			const opponentIdx = playerIdx === 0 ? 1 : 0;

			if (state.rematchRequested[0] && state.rematchRequested[1]) {
				// Both accepted — reset and start
				state.rematchRequested = [false, false];
				for (const p of state.players) {
					p.score = 0;
					p.hand = [];
					p.submission = { move: null, cardUid: null, lockedIn: false };
				}
				state.round = 0;
				state.roundResults = [];
				state.activeField = null;

				startGame(io, state);
			} else {
				// Notify the opponent that this player wants a rematch
				io.to(state.players[opponentIdx].id).emit('rematch-requested');
			}
		});

		socket.on('decline-rematch', () => {
			const state = rooms.getRoomByPlayer(socket.id);
			if (!state || state.phase !== 'match-end') return;

			const playerIdx = state.players.findIndex((p) => p.id === socket.id);
			if (playerIdx === -1) return;

			const opponentIdx = playerIdx === 0 ? 1 : 0;
			state.rematchRequested = [false, false];
			io.to(state.players[opponentIdx].id).emit('rematch-declined');
		});

		socket.on('leave-game', () => {
			handleDisconnect(io, socket);
		});

		socket.on('disconnect', () => {
			console.log(`Disconnected: ${socket.id}`);
			queue.dequeue(socket.id);
			handleDisconnect(io, socket);
		});
	});
}

function handleDisconnect(io: IO, socket: ClientSocket): void {
	const result = rooms.leaveRoom(socket.id);
	if (result?.opponentId) {
		io.to(result.opponentId).emit('opponent-disconnected');
		cleanupRoom(result.roomCode);
	}
}
