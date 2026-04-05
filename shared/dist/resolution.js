// Standard power levels: rock=1, scissors=2, paper=3
// Each move beats the one 1 level below it (wrapping: paper(3) beats rock(1) because 3 beats "0 mod 3" = 3>1)
// We use a numeric approach: each move gets a base power, modifiers shift it.
// Comparison: if powers differ by a full step (1.0), the higher wins.
// If powers differ by a half step (0.5), it's a tie.
// If powers are equal, it's a tie.
function getEffect(card) {
    return card?.effect ?? null;
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
export function resolveRound(input) {
    const { round } = input;
    let p1Card = input.p1.card;
    let p2Card = input.p2.card;
    const p1Move = input.p1.move;
    const p2Move = input.p2.move;
    const n1 = input.p1.name;
    const n2 = input.p2.name;
    let activeField = input.activeField;
    const details = [];
    // --- Step 1: Nullify ---
    const p1Nullify = getEffect(p1Card)?.kind === 'nullify';
    const p2Nullify = getEffect(p2Card)?.kind === 'nullify';
    if (p1Nullify && p2Nullify) {
        details.push('Both played 🚫 Silence — both cards cancelled!');
        p1Card = null;
        p2Card = null;
    }
    else if (p1Nullify) {
        details.push(`${n1}'s 🚫 Silence cancelled ${n2}'s ${p2Card?.name ?? 'card'}!`);
        p2Card = null;
        p1Card = null;
    }
    else if (p2Nullify) {
        details.push(`${n2}'s 🚫 Silence cancelled ${n1}'s ${p1Card?.name ?? 'card'}!`);
        p1Card = null;
        p2Card = null;
    }
    const p1Effect = getEffect(p1Card);
    const p2Effect = getEffect(p2Card);
    // --- Step 2: Update persistent field ---
    if (p1Effect?.kind === 'field_persistent') {
        activeField = { move: p1Effect.move, modifier: p1Effect.modifier };
        details.push(`${p1Card.name} is now active! All ${p1Effect.move} moves get ${p1Effect.modifier > 0 ? 'stronger' : 'weaker'}.`);
    }
    if (p2Effect?.kind === 'field_persistent') {
        activeField = { move: p2Effect.move, modifier: p2Effect.modifier };
        details.push(`${p2Card.name} is now active! All ${p2Effect.move} moves get ${p2Effect.modifier > 0 ? 'stronger' : 'weaker'}.`);
    }
    // --- Step 3: Invert check ---
    const invert = p1Effect?.kind === 'invert' || p2Effect?.kind === 'invert';
    const bothInvert = p1Effect?.kind === 'invert' && p2Effect?.kind === 'invert';
    const useInvert = invert && !bothInvert;
    if (bothInvert) {
        details.push('Both played 🔄 Reversal — they cancel out!');
    }
    else if (useInvert) {
        details.push('🔄 Reversal flips all matchups this round!');
    }
    // --- Step 4: Calculate power modifiers for each player's move ---
    let p1Power = 0;
    let p2Power = 0;
    // Active field
    if (activeField) {
        if (p1Move === activeField.move)
            p1Power += activeField.modifier;
        if (p2Move === activeField.move)
            p2Power += activeField.modifier;
        if (p1Move === activeField.move || p2Move === activeField.move) {
            const affected = [];
            if (p1Move === activeField.move)
                affected.push(`${n1}'s ${p1Move}`);
            if (p2Move === activeField.move)
                affected.push(`${n2}'s ${p2Move}`);
            details.push(`Active field ${activeField.modifier > 0 ? 'boosts' : 'weakens'} ${affected.join(' and ')}.`);
        }
    }
    // Strengthen
    if (p1Effect?.kind === 'strengthen') {
        if (p1Effect.move === p1Move) {
            p1Power += 1;
            details.push(`${p1Card.name} powers up ${n1}'s ${p1Move}!`);
        }
        else {
            details.push(`${p1Card.name} had no effect — ${n1} didn't play ${p1Effect.move}.`);
        }
    }
    if (p2Effect?.kind === 'strengthen') {
        if (p2Effect.move === p2Move) {
            p2Power += 1;
            details.push(`${p2Card.name} powers up ${n2}'s ${p2Move}!`);
        }
        else {
            details.push(`${p2Card.name} had no effect — ${n2} didn't play ${p2Effect.move}.`);
        }
    }
    // Weaken
    if (p1Effect?.kind === 'weaken') {
        if (p1Effect.move === p2Move) {
            p2Power -= 1;
            details.push(`${p1Card.name} weakens ${n2}'s ${p2Move}!`);
        }
        else {
            details.push(`${p1Card.name} had no effect — ${n2} didn't play ${p1Effect.move}.`);
        }
    }
    if (p2Effect?.kind === 'weaken') {
        if (p2Effect.move === p1Move) {
            p1Power -= 1;
            details.push(`${p2Card.name} weakens ${n1}'s ${p1Move}!`);
        }
        else {
            details.push(`${p2Card.name} had no effect — ${n1} didn't play ${p2Effect.move}.`);
        }
    }
    // --- Step 5: Determine outcome ---
    let outcome = resolveWithPower(p1Move, p2Move, p1Power, p2Power, useInvert);
    // --- Step 6: Tiebreaker ---
    if (outcome === 'tie') {
        const p1Tie = p1Effect?.kind === 'tiebreaker';
        const p2Tie = p2Effect?.kind === 'tiebreaker';
        if (p1Tie && p2Tie) {
            details.push('Both played 👑 Crown — they cancel out, still a tie!');
        }
        else if (p1Tie) {
            outcome = 'win';
            details.push(`${n1}'s 👑 Crown breaks the tie!`);
        }
        else if (p2Tie) {
            outcome = 'lose';
            details.push(`${n2}'s 👑 Crown breaks the tie!`);
        }
    }
    // --- Step 7: Shield ---
    if (outcome === 'win' && p2Effect?.kind === 'shield') {
        outcome = 'tie';
        details.push(`${n2}'s 🛡️ Shield blocks the hit — it's a tie!`);
    }
    else if (outcome === 'lose' && p1Effect?.kind === 'shield') {
        outcome = 'tie';
        details.push(`${n1}'s 🛡️ Shield blocks the hit — it's a tie!`);
    }
    // --- Step 8: Determine winner and score ---
    let winner = null;
    let scoreAwarded = [0, 0];
    if (outcome === 'win') {
        winner = 0;
        scoreAwarded = [1, 0];
    }
    else if (outcome === 'lose') {
        winner = 1;
        scoreAwarded = [0, 1];
    }
    const result = {
        round,
        moves: [p1Move, p2Move],
        cards: [input.p1.card, input.p2.card],
        winner,
        scoreAwarded,
        details,
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
function resolveWithPower(p1Move, p2Move, p1Power, p2Power, inverted) {
    const base = getBaseAdvantage(p1Move, p2Move, inverted);
    const advantage = base + (p1Power - p2Power);
    if (advantage >= 1)
        return 'win';
    if (advantage <= -1)
        return 'lose';
    return 'tie';
}
function getBaseAdvantage(p1Move, p2Move, inverted) {
    if (p1Move === p2Move)
        return 0;
    const normalWins = {
        rock: 'scissors',
        paper: 'rock',
        scissors: 'paper',
    };
    const invertedWins = {
        rock: 'paper',
        paper: 'scissors',
        scissors: 'rock',
    };
    const wins = inverted ? invertedWins : normalWins;
    return wins[p1Move] === p2Move ? 1 : -1;
}
// --- Helpers ---
//# sourceMappingURL=resolution.js.map