import type { Move, Card, RoundResult, ActiveField, CardEffect } from './types.js';

type Outcome = 'win' | 'lose' | 'tie';

// Standard power levels: rock=1, scissors=2, paper=3
// Each move beats the one 1 level below it (wrapping: paper(3) beats rock(1) because 3 beats "0 mod 3" = 3>1)
// We use a numeric approach: each move gets a base power, modifiers shift it.
// Comparison: if powers differ by a full step (1.0), the higher wins.
// If powers differ by a half step (0.5), it's a tie.
// If powers are equal, it's a tie.

function getEffect(card: Card | null): CardEffect | null {
  return card?.effect ?? null;
}

export interface ResolveInput {
  p1: { move: Move; card: Card | null };
  p2: { move: Move; card: Card | null };
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
export function resolveRound(input: ResolveInput): ResolveOutput {
  const { round } = input;
  let p1Card = input.p1.card;
  let p2Card = input.p2.card;
  const p1Move = input.p1.move;
  const p2Move = input.p2.move;
  let activeField = input.activeField;
  const details: string[] = [];

  // --- Step 1: Nullify ---
  const p1Nullify = getEffect(p1Card)?.kind === 'nullify';
  const p2Nullify = getEffect(p2Card)?.kind === 'nullify';

  if (p1Nullify && p2Nullify) {
    details.push('Both played Nullify — both cards cancelled!');
    p1Card = null;
    p2Card = null;
  } else if (p1Nullify) {
    details.push(`P1 nullified P2's ${p2Card?.name ?? 'card'}!`);
    p2Card = null;
    p1Card = null;
  } else if (p2Nullify) {
    details.push(`P2 nullified P1's ${p1Card?.name ?? 'card'}!`);
    p1Card = null;
    p2Card = null;
  }

  const p1Effect = getEffect(p1Card);
  const p2Effect = getEffect(p2Card);

  // --- Step 2: Update persistent field ---
  if (p1Effect?.kind === 'field_persistent') {
    activeField = { move: p1Effect.move, modifier: p1Effect.modifier };
    details.push(`${p1Card!.name} is now active!`);
  }
  if (p2Effect?.kind === 'field_persistent') {
    activeField = { move: p2Effect.move, modifier: p2Effect.modifier };
    details.push(`${p2Card!.name} is now active!`);
  }

  // --- Step 3: Invert check ---
  const invert = p1Effect?.kind === 'invert' || p2Effect?.kind === 'invert';
  const bothInvert = p1Effect?.kind === 'invert' && p2Effect?.kind === 'invert';
  const useInvert = invert && !bothInvert;

  if (bothInvert) {
    details.push('Both played Invert — matchups stay normal!');
  } else if (useInvert) {
    details.push('Matchups are inverted this round!');
  }

  // --- Step 4: Calculate power modifiers for each player's move ---
  // Power modifier: positive = stronger, negative = weaker
  // +1.0 = full step (lose→tie→win), +0.5 = half step (lose→tie OR tie→win)
  let p1Power = 0;
  let p2Power = 0;

  // Active field: applies to both players' moves equally
  if (activeField) {
    if (p1Move === activeField.move) p1Power += activeField.modifier;
    if (p2Move === activeField.move) p2Power += activeField.modifier;
  }

  // Strengthen: +1.0 to your own move (full step: wins mirrors, ties counters)
  if (p1Effect?.kind === 'strengthen' && p1Effect.move === p1Move) {
    p1Power += 1;
    details.push(`+${capitalize(p1Move)} boosts P1's ${p1Move}!`);
  }
  if (p2Effect?.kind === 'strengthen' && p2Effect.move === p2Move) {
    p2Power += 1;
    details.push(`+${capitalize(p2Move)} boosts P2's ${p2Move}!`);
  }

  // Weaken: -1.0 to opponent's move
  if (p1Effect?.kind === 'weaken' && p1Effect.move === p2Move) {
    p2Power -= 1;
    details.push(`-${capitalize(p2Move)} weakens P2's ${p2Move}!`);
  }
  if (p2Effect?.kind === 'weaken' && p2Effect.move === p1Move) {
    p1Power -= 1;
    details.push(`-${capitalize(p1Move)} weakens P1's ${p1Move}!`);
  }

  // --- Step 5: Determine outcome from base matchup + power modifiers ---
  let outcome = resolveWithPower(p1Move, p2Move, p1Power, p2Power, useInvert);

  if (activeField && (p1Move === activeField.move || p2Move === activeField.move)) {
    details.push(`${capitalize(activeField.move)} Field ${activeField.modifier > 0 ? '+' : ''}${activeField.modifier} is active!`);
  }

  // --- Step 6: Tiebreaker ---
  if (outcome === 'tie') {
    const p1Tie = p1Effect?.kind === 'tiebreaker';
    const p2Tie = p2Effect?.kind === 'tiebreaker';

    if (p1Tie && p2Tie) {
      details.push('Both played Tiebreaker — still a tie!');
    } else if (p1Tie) {
      outcome = 'win';
      details.push('P1 wins the tie with Tiebreaker!');
    } else if (p2Tie) {
      outcome = 'lose';
      details.push('P2 wins the tie with Tiebreaker!');
    }
  }

  // --- Step 7: Shield ---
  if (outcome === 'win' && p2Effect?.kind === 'shield') {
    outcome = 'tie';
    details.push("P2's Shield converts the loss to a tie!");
  } else if (outcome === 'lose' && p1Effect?.kind === 'shield') {
    outcome = 'tie';
    details.push("P1's Shield converts the loss to a tie!");
  }

  // --- Step 8: Determine winner and score ---
  let winner: 0 | 1 | null = null;
  let scoreAwarded: [number, number] = [0, 0];

  if (outcome === 'win') {
    winner = 0;
    scoreAwarded = [1, 0];
  } else if (outcome === 'lose') {
    winner = 1;
    scoreAwarded = [0, 1];
  }

  const result: RoundResult = {
    round,
    moves: [p1Move, p2Move],
    cards: [input.p1.card, input.p2.card],
    winner,
    scoreAwarded,
    details: details.join(' '),
  };

  return { result, newActiveField: activeField };
}

// --- Power-based resolution ---

/**
 * Resolves outcome for P1 given base matchup and power modifiers.
 *
 * Base matchup gives a "advantage" value:
 *   win  = +1
 *   tie  =  0
 *   lose = -1
 *
 * Net power difference shifts the advantage:
 *   advantage = base + (p1Power - p2Power)
 *
 * Final outcome:
 *   advantage >= 1  → win
 *   advantage <= -1 → lose
 *   otherwise       → tie
 */
function resolveWithPower(
  p1Move: Move,
  p2Move: Move,
  p1Power: number,
  p2Power: number,
  inverted: boolean
): Outcome {
  const base = getBaseAdvantage(p1Move, p2Move, inverted);
  const advantage = base + (p1Power - p2Power);

  if (advantage >= 1) return 'win';
  if (advantage <= -1) return 'lose';
  return 'tie';
}

function getBaseAdvantage(p1Move: Move, p2Move: Move, inverted: boolean): number {
  if (p1Move === p2Move) return 0;

  const normalWins: Record<Move, Move> = {
    rock: 'scissors',
    paper: 'rock',
    scissors: 'paper',
  };

  const invertedWins: Record<Move, Move> = {
    rock: 'paper',
    paper: 'scissors',
    scissors: 'rock',
  };

  const wins = inverted ? invertedWins : normalWins;
  return wins[p1Move] === p2Move ? 1 : -1;
}

// --- Helpers ---

function capitalize(s: string): string {
  return s[0].toUpperCase() + s.slice(1);
}
