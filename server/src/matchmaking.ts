import type { GameMode } from 'shared';

interface QueueEntry {
  playerId: string;
  playerName: string;
  modes: GameMode[];
  joinedAt: number;
}

export class MatchmakingQueue {
  private queue: QueueEntry[] = [];

  enqueue(playerId: string, playerName: string, modes: GameMode[]): void {
    // Remove if already in queue
    this.dequeue(playerId);
    this.queue.push({ playerId, playerName, modes, joinedAt: Date.now() });
  }

  dequeue(playerId: string): void {
    this.queue = this.queue.filter((e) => e.playerId !== playerId);
  }

  tryMatch(): { p1: QueueEntry; p2: QueueEntry; mode: GameMode } | null {
    for (let i = 0; i < this.queue.length; i++) {
      for (let j = i + 1; j < this.queue.length; j++) {
        const a = this.queue[i];
        const b = this.queue[j];
        const commonModes = a.modes.filter((m) => b.modes.includes(m));
        if (commonModes.length > 0) {
          const mode = commonModes[Math.floor(Math.random() * commonModes.length)];
          // Remove both from queue
          this.queue = this.queue.filter((e) => e.playerId !== a.playerId && e.playerId !== b.playerId);
          return { p1: a, p2: b, mode };
        }
      }
    }
    return null;
  }

  isQueued(playerId: string): boolean {
    return this.queue.some((e) => e.playerId === playerId);
  }
}
