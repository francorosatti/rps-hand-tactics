<script lang="ts">
  import type { RoundResult } from 'shared';

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

  let outcomeText = $derived.by(() => {
    if (result.winner === null) return 'TIE!';
    return result.winner === playerIndex ? 'YOU WIN!' : 'YOU LOSE!';
  });

  let outcomeClass = $derived.by(() => {
    if (result.winner === null) return 'tie';
    return result.winner === playerIndex ? 'win' : 'lose';
  });
</script>

<div class="round-result">
  <div class="moves">
    <div class="move-display">
      <span class="player-name">{p1Name}</span>
      <span class="move-emoji">{moveEmoji[result.moves[0]]}</span>
      <span class="move-label">{result.moves[0]}</span>
      {#if result.cards[0]}
        <span class="card-played">{result.cards[0].name}</span>
      {/if}
    </div>
    <span class="vs">VS</span>
    <div class="move-display">
      <span class="player-name">{p2Name}</span>
      <span class="move-emoji">{moveEmoji[result.moves[1]]}</span>
      <span class="move-label">{result.moves[1]}</span>
      {#if result.cards[1]}
        <span class="card-played">{result.cards[1].name}</span>
      {/if}
    </div>
  </div>

  <div class="outcome {outcomeClass}">{outcomeText}</div>

  {#if result.details}
    <p class="details">{result.details}</p>
  {/if}

  {#if result.scoreAwarded[0] > 0 || result.scoreAwarded[1] > 0}
    <p class="score-change">
      Score: +{result.scoreAwarded[0]} / +{result.scoreAwarded[1]}
    </p>
  {/if}
</div>

<style>
  .round-result {
    text-align: center;
    padding: 1.5rem;
    background: #16213e;
    border-radius: 16px;
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }

  .moves {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2rem;
  }

  .move-display {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }

  .player-name {
    font-size: 0.8rem;
    color: #888;
  }

  .move-emoji {
    font-size: 3rem;
  }

  .move-label {
    text-transform: capitalize;
    font-weight: 600;
  }

  .card-played {
    font-size: 0.75rem;
    padding: 0.2rem 0.5rem;
    background: #2d1b69;
    border-radius: 6px;
    color: #a78bfa;
  }

  .vs {
    font-size: 1.2rem;
    font-weight: 800;
    color: #666;
  }

  .outcome {
    margin-top: 1rem;
    font-size: 1.5rem;
    font-weight: 800;
  }

  .outcome.win { color: #22c55e; }
  .outcome.lose { color: #ef4444; }
  .outcome.tie { color: #f59e0b; }

  .details {
    margin-top: 0.5rem;
    font-size: 0.85rem;
    color: #aaa;
    line-height: 1.4;
  }

  .score-change {
    margin-top: 0.25rem;
    font-size: 0.8rem;
    color: #7c3aed;
  }
</style>
