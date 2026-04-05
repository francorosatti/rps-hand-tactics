<script lang="ts">
  import type { Card } from 'shared';
  import { t } from '$lib/i18n/index.js';
  import CardSlot from './CardSlot.svelte';

  interface Props {
    cards: Card[];
    selectedCardId: string | null;
    disabled: boolean;
    onSelectCard: (card: Card | null) => void;
  }

  let { cards, selectedCardId, disabled, onSelectCard }: Props = $props();

  function handleSelect(card: Card) {
    if (selectedCardId === card.uid) {
      onSelectCard(null); // deselect
    } else {
      onSelectCard(card);
    }
  }
</script>

<div class="card-hand">
  <h3>{$t('hand.yourCards')}</h3>
  <div class="cards">
    {#each cards as card (card.uid)}
      <CardSlot
        {card}
        selected={selectedCardId === card.uid}
        {disabled}
        onSelect={handleSelect}
      />
    {/each}
    {#if cards.length === 0}
      <p class="empty">{$t('hand.noCards')}</p>
    {/if}
  </div>
</div>

<style>
  .card-hand h3 {
    margin: 0 0 0.5rem;
    font-size: 0.9rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #888;
  }

  .cards {
    display: flex;
    gap: 0.75rem;
    justify-content: center;
    flex-wrap: wrap;
  }

  .empty {
    color: #666;
    font-style: italic;
  }
</style>
