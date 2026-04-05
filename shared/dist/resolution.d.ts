import type { Move, Card, RoundResult, ActiveField } from './types.js';
export interface ResolveInput {
    p1: {
        move: Move;
        card: Card | null;
        name: string;
    };
    p2: {
        move: Move;
        card: Card | null;
        name: string;
    };
    activeField: ActiveField | null;
    round: number;
}
export interface ResolveOutput {
    result: RoundResult;
    newActiveField: ActiveField | null;
}
/**
 * Resolve outcome between two moves using power levels.
 *
 * Each move has a power. We compare the attacker's power vs the defender's power
 * using circular RPS logic:
 * - Rock (power) vs Scissors (power): Rock wins if rock_power > scissors_power - 1
 *
 * Actually, let's keep it simpler with the matchup shift approach:
 * - Base matchup from standard RPS table (win/lose/tie)
 * - +0.5 on a move shifts its matchups: lose→tie, tie→win (one half-step each)
 * - -0.5 on a move shifts its matchups: win→tie, tie→lose (one half-step each)
 * - These shifts apply per-move and accumulate from field + booster cards
 */
export declare function resolveRound(input: ResolveInput): ResolveOutput;
//# sourceMappingURL=resolution.d.ts.map