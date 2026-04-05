<script lang="ts">
  import { onMount } from 'svelte';
  import type { RoundResult, DetailEntry } from 'shared';
  import { t } from '$lib/i18n/index.js';

  interface Props {
    result: RoundResult;
    playerIndex: number;
    p1Name: string;
    p2Name: string;
  }

  let { result, playerIndex, p1Name, p2Name }: Props = $props();

  const moveEmoji: Record<string, string> = {
    rock: '🪨',
    paper: '📄',
    scissors: '✂️',
  };

  const moveKeys: Record<string, string> = {
    rock: 'move.rock',
    paper: 'move.paper',
    scissors: 'move.scissors',
  };

  // Staged reveal: clash → cards → details (one by one) → outcome
  let phase = $state<'clash' | 'cards' | 'details' | 'outcome'>('clash');
  let visibleDetails = $state(0);

  onMount(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    timers.push(setTimeout(() => phase = 'cards', 800));

    const detailStart = 1600;
    const detailCount = result.details.length;

    if (detailCount > 0) {
      timers.push(setTimeout(() => phase = 'details', detailStart));
      for (let i = 0; i < detailCount; i++) {
        timers.push(setTimeout(() => visibleDetails = i + 1, detailStart + (i + 1) * 500));
      }
    }

    const outcomeTime = detailStart + (detailCount > 0 ? (detailCount + 1) * 500 : 400);
    timers.push(setTimeout(() => phase = 'outcome', outcomeTime));

    return () => timers.forEach(clearTimeout);
  });

  let outcomeText = $derived.by(() => {
    if (result.winner === null) return $t('roundResult.tie');
    return result.winner === playerIndex ? $t('roundResult.youWin') : $t('roundResult.youLose');
  });

  let outcomeClass = $derived.by(() => {
    if (result.winner === null) return 'tie';
    return result.winner === playerIndex ? 'win' : 'lose';
  });

  function translateDetail(detail: DetailEntry): string {
    const p = detail.params ?? {};
    // Resolve translated card name and move name into params
    const resolved: Record<string, string> = { ...p };
    if (p.cardId) {
      resolved.cardName = $t(`card.${p.cardId}.name`);
    }
    if (p.move) {
      resolved.move = $t(`move.${p.move}`);
    }
    if (p.effect && (detail.key === 'detail.fieldActive')) {
      resolved.effect = $t(`detail.fieldActive.${p.effect}`);
    }
    if (p.effect && (detail.key === 'detail.fieldEffect')) {
      resolved.effect = $t(`detail.fieldEffect.${p.effect}`);
    }
    return $t(detail.key, resolved);
  }

  function cardDisplayName(card: { id: string; name: string } | null): string {
    if (!card) return $t('roundResult.noCard');
    // Extract emoji and use translated name
    const match = card.name.match(/^(\p{Extended_Pictographic}[\uFE0F\u200D]*(?:\p{Extended_Pictographic}[\uFE0F\u200D]*)*)\s/u);
    const icon = match ? match[1] + ' ' : '';
    return icon + $t(`card.${card.id}.name`);
  }
</script>

<div class="round-result">
  <!-- Moves clash in from sides -->
  <div class="moves">
    <div class="move-display slide-left">
      <span class="player-name">{p1Name}</span>
      <span class="move-emoji">{moveEmoji[result.moves[0]]}</span>
      <span class="move-label">{$t(moveKeys[result.moves[0]])}</span>
    </div>
    <span class="vs-badge" class:visible={phase !== 'clash'}>{$t('roundResult.vs')}</span>
    <div class="move-display slide-right">
      <span class="player-name">{p2Name}</span>
      <span class="move-emoji">{moveEmoji[result.moves[1]]}</span>
      <span class="move-label">{$t(moveKeys[result.moves[1]])}</span>
    </div>
  </div>

  <!-- Cards fade in -->
  {#if phase !== 'clash'}
    <div class="cards-row visible">
      <div class="card-badge-wrap">
        {#if result.cards[0]}
          <span class="card-played pop">{cardDisplayName(result.cards[0])}</span>
        {:else}
          <span class="card-played none">{$t('roundResult.noCard')}</span>
        {/if}
      </div>
      <div class="card-badge-wrap">
        {#if result.cards[1]}
          <span class="card-played pop">{cardDisplayName(result.cards[1])}</span>
        {:else}
          <span class="card-played none">{$t('roundResult.noCard')}</span>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Details appear one by one -->
  {#if visibleDetails > 0}
    <div class="details-list">
      {#each result.details.slice(0, visibleDetails) as detail, i (i)}
        <p class="detail-line fade-up">{translateDetail(detail)}</p>
      {/each}
    </div>
  {/if}

  <!-- Outcome slams in -->
  {#if phase === 'outcome'}
    <div class="outcome {outcomeClass} slam">{outcomeText}</div>

    {#if result.scoreAwarded[0] > 0 || result.scoreAwarded[1] > 0}
      <p class="score-change fade-up">
        +{result.scoreAwarded[0]} / +{result.scoreAwarded[1]}
      </p>
    {/if}
  {/if}
</div>

<style>
  .round-result {
    text-align: center;
    padding: 1.5rem;
    background: #16213e;
    border-radius: 16px;
    overflow: hidden;
    min-height: 200px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }

  .moves {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1.5rem;
    width: 100%;
  }

  .move-display {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }

  .slide-left {
    animation: slideFromLeft 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  .slide-right {
    animation: slideFromRight 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  @keyframes slideFromLeft {
    from { opacity: 0; transform: translateX(-60px); }
    to { opacity: 1; transform: translateX(0); }
  }

  @keyframes slideFromRight {
    from { opacity: 0; transform: translateX(60px); }
    to { opacity: 1; transform: translateX(0); }
  }

  .player-name {
    font-size: 0.8rem;
    color: #888;
  }

  .move-emoji {
    font-size: 3.5rem;
    filter: drop-shadow(0 2px 8px rgba(0,0,0,0.3));
  }

  .move-label {
    text-transform: capitalize;
    font-weight: 600;
    font-size: 0.9rem;
  }

  .vs-badge {
    font-size: 0.9rem;
    font-weight: 800;
    color: #555;
    opacity: 0;
    transition: all 0.3s;
  }

  .vs-badge.visible {
    opacity: 1;
    animation: pulseBadge 0.4s ease both;
  }

  @keyframes pulseBadge {
    0% { transform: scale(0.5); opacity: 0; }
    60% { transform: scale(1.3); }
    100% { transform: scale(1); opacity: 1; }
  }

  .cards-row {
    display: flex;
    justify-content: center;
    gap: 3rem;
    width: 100%;
    animation: fadeIn 0.4s ease both;
  }

  .card-badge-wrap {
    min-width: 80px;
    display: flex;
    justify-content: center;
  }

  .card-played {
    font-size: 0.8rem;
    padding: 0.3rem 0.75rem;
    background: #2d1b69;
    border-radius: 8px;
    color: #a78bfa;
    font-weight: 600;
    white-space: nowrap;
  }

  .card-played.none {
    background: transparent;
    color: #555;
    font-weight: 400;
  }

  .card-played.pop {
    animation: popIn 0.35s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  @keyframes popIn {
    from { transform: scale(0); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  /* --- Details list --- */
  .details-list {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    width: 100%;
    max-width: 90%;
  }

  .detail-line {
    margin: 0;
    font-size: 0.85rem;
    color: #ccc;
    line-height: 1.4;
    padding: 0.3rem 0.6rem;
    background: rgba(255,255,255,0.04);
    border-radius: 6px;
    border-left: 3px solid #7c3aed;
    text-align: left;
  }

  /* --- Outcome --- */
  .outcome {
    font-size: 2rem;
    font-weight: 900;
    letter-spacing: 0.05em;
  }

  .outcome.win { color: #22c55e; }
  .outcome.lose { color: #ef4444; }
  .outcome.tie { color: #f59e0b; }

  .outcome.slam {
    animation: slamIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  @keyframes slamIn {
    0% { transform: scale(2.5); opacity: 0; }
    60% { transform: scale(0.9); }
    100% { transform: scale(1); opacity: 1; }
  }

  .score-change {
    font-size: 0.9rem;
    color: #7c3aed;
    font-weight: 700;
    margin: 0;
  }

  .fade-up {
    animation: fadeUp 0.4s ease both;
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
</style>
