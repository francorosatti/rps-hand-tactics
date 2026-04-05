const moves = ['rock', 'paper', 'scissors'];
let uidCounter = 0;
function nextUid() {
    return `card-${++uidCounter}-${Math.random().toString(36).slice(2, 8)}`;
}
function strengthenCard(move) {
    const beats = move === 'rock' ? 'paper' : move === 'paper' ? 'scissors' : 'rock';
    return {
        id: `str-${move}`,
        uid: nextUid(),
        name: `+${move[0].toUpperCase() + move.slice(1)}`,
        type: 'strengthen',
        description: `Your ${move} beats opponent's ${move} and ties with ${beats}`,
        effect: { kind: 'strengthen', move },
    };
}
function weakenCard(move) {
    const normallyBeats = move === 'rock' ? 'scissors' : move === 'paper' ? 'rock' : 'paper';
    return {
        id: `wk-${move}`,
        uid: nextUid(),
        name: `-${move[0].toUpperCase() + move.slice(1)}`,
        type: 'weaken',
        description: `Opponent's ${move} loses to your ${move} and ties with ${normallyBeats}`,
        effect: { kind: 'weaken', move },
    };
}
function fieldPersistentCard(move, modifier) {
    const sign = modifier > 0 ? '+' : '';
    const losesTo = move === 'rock' ? 'paper' : move === 'paper' ? 'scissors' : 'rock';
    const beats = move === 'rock' ? 'scissors' : move === 'paper' ? 'rock' : 'paper';
    const desc = modifier > 0
        ? `${move} ties with ${losesTo} (for all players). Persists until replaced.`
        : `${move} ties with ${beats} (for all players). Persists until replaced.`;
    return {
        id: `field-${move}-${modifier > 0 ? 'plus' : 'minus'}`,
        uid: nextUid(),
        name: `${move[0].toUpperCase() + move.slice(1)} Field ${sign}${modifier}`,
        type: 'field_persistent',
        description: desc,
        effect: { kind: 'field_persistent', move, modifier },
    };
}
function specialCard(id, name, type, description, effect) {
    return { id, uid: nextUid(), name, type, description, effect };
}
export const CARD_CATALOG = [
    // Strengthen (2 each = 6)
    ...moves.flatMap((m) => [strengthenCard(m), strengthenCard(m)]),
    // Weaken (2 each = 6)
    ...moves.flatMap((m) => [weakenCard(m), weakenCard(m)]),
    // Shield (2)
    specialCard('shield', 'Shield', 'special', 'Tie instead of lose', { kind: 'shield' }),
    specialCard('shield', 'Shield', 'special', 'Tie instead of lose', { kind: 'shield' }),
    // Tiebreaker (2)
    specialCard('tiebreaker', 'Tiebreaker', 'special', 'Win ties instead of drawing', { kind: 'tiebreaker' }),
    specialCard('tiebreaker', 'Tiebreaker', 'special', 'Win ties instead of drawing', { kind: 'tiebreaker' }),
    // Invert (1)
    specialCard('invert', 'Invert', 'field', 'Reverse all matchups for this round', { kind: 'invert' }),
    // Nullify (2)
    specialCard('nullify', 'Nullify', 'nullify', "Cancel opponent's booster card", { kind: 'nullify' }),
    specialCard('nullify', 'Nullify', 'nullify', "Cancel opponent's booster card", { kind: 'nullify' }),
    // Persistent field cards (6)
    ...moves.flatMap((m) => [fieldPersistentCard(m, 0.5), fieldPersistentCard(m, -0.5)]),
];
// Unique card templates for draft mode (players pick by card id)
export const DRAFT_CARD_LIST = [
    ...moves.map((m) => strengthenCard(m)),
    ...moves.map((m) => weakenCard(m)),
    specialCard('shield', 'Shield', 'special', 'Tie instead of lose', { kind: 'shield' }),
    specialCard('tiebreaker', 'Tiebreaker', 'special', 'Win ties instead of drawing', { kind: 'tiebreaker' }),
    specialCard('invert', 'Invert', 'field', 'Reverse all matchups for this round', { kind: 'invert' }),
    specialCard('nullify', 'Nullify', 'nullify', "Cancel opponent's booster card", { kind: 'nullify' }),
    ...moves.flatMap((m) => [fieldPersistentCard(m, 0.5), fieldPersistentCard(m, -0.5)]),
];
export function drawRandomHand(count) {
    const pool = CARD_CATALOG.map((c) => ({ ...c, uid: nextUid() }));
    const hand = [];
    for (let i = 0; i < count && pool.length > 0; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        hand.push(pool.splice(idx, 1)[0]);
    }
    return hand;
}
export function buildDraftHand(cardIds) {
    return cardIds.map((id) => {
        const card = DRAFT_CARD_LIST.find((c) => c.id === id);
        if (!card)
            throw new Error(`Unknown card id: ${id}`);
        return { ...card, uid: nextUid() };
    });
}
//# sourceMappingURL=cards.js.map