<script lang="ts">
  import type { Card } from 'shared';
  import { t } from '$lib/i18n/index.js';

  interface Props {
    card: Card;
    selected: boolean;
    disabled: boolean;
    onSelect: (card: Card) => void;
  }

  let { card, selected, disabled, onSelect }: Props = $props();

  const typeColors: Record<string, string> = {
    strengthen: '#22c55e',
    weaken: '#ef4444',
    special: '#3b82f6',
    field: '#3b82f6',
    field_persistent: '#a855f7',
    nullify: '#3b82f6',
  };

  const typeKeys: Record<string, string> = {
    strengthen: 'cardType.boost',
    weaken: 'cardType.sabotage',
    special: 'cardType.special',
    field: 'cardType.special',
    field_persistent: 'cardType.field',
    nullify: 'cardType.special',
  };

  function cardIcon(card: Card): string {
    // Extract emoji prefix from name (e.g. "🏔️ Avalanche" -> "🏔️")
    const match = card.name.match(/^(\p{Extended_Pictographic}[\uFE0F\u200D]*(?:\p{Extended_Pictographic}[\uFE0F\u200D]*)*)\s/u);
    return match ? match[1] : '';
  }
</script>

<button
  class="card-slot"
  class:selected
  disabled={disabled}
  onclick={() => onSelect(card)}
  style="--type-color: {typeColors[card.type] || '#444'}"
>
  <div class="card-header">{cardIcon(card)} {$t(`card.${card.id}.name`)}</div>
  <div class="card-type">{$t(typeKeys[card.type] || card.type)}</div>
  <div class="card-desc">{$t(`card.${card.id}.desc`)}</div>
</button>

<style>
  .card-slot {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.75rem;
    border: 2px solid var(--type-color);
    border-radius: 12px;
    background: #1a1a2e;
    color: white;
    cursor: pointer;
    transition: all 0.2s;
    min-width: 100px;
    max-width: 140px;
    text-align: center;
  }

  .card-slot:hover:not(:disabled) {
    transform: translateY(-4px);
    box-shadow: 0 4px 12px color-mix(in srgb, var(--type-color) 40%, transparent);
  }

  .card-slot.selected {
    background: color-mix(in srgb, var(--type-color) 20%, #1a1a2e);
    box-shadow: 0 0 16px color-mix(in srgb, var(--type-color) 50%, transparent);
  }

  .card-slot:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .card-header {
    font-weight: 700;
    font-size: 1.1rem;
  }

  .card-type {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--type-color);
  }

  .card-desc {
    font-size: 0.75rem;
    opacity: 0.8;
    line-height: 1.3;
  }
</style>
