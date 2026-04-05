import type { Card, Move } from './types.js';
export declare const FIELD_PLUS_INFO: Record<Move, {
    name: string;
    icon: string;
}>;
export declare const FIELD_MINUS_INFO: Record<Move, {
    name: string;
    icon: string;
}>;
export declare const CARD_CATALOG: Card[];
export declare const DRAFT_CARD_LIST: Card[];
export declare function drawRandomHand(count: number): Card[];
export declare function buildDraftHand(cardIds: string[]): Card[];
//# sourceMappingURL=cards.d.ts.map