<script lang="ts">
  import { t } from '$lib/i18n/index.js';

  interface Props {
    p1Name: string;
    p2Name: string;
    p1Score: number;
    p2Score: number;
    round: number;
    playerIndex: number;
  }

  let { p1Name, p2Name, p1Score, p2Score, round, playerIndex }: Props = $props();
</script>

<div class="scoreboard">
  <div class="player" class:you={playerIndex === 0}>
    <span class="name">{p1Name}{playerIndex === 0 ? ` ${$t('scoreboard.you')}` : ''}</span>
    <span class="score">{p1Score}</span>
  </div>
  <div class="round-info">
    {$t('scoreboard.round')} {round} / 5
  </div>
  <div class="player" class:you={playerIndex === 1}>
    <span class="score">{p2Score}</span>
    <span class="name">{playerIndex === 1 ? `${$t('scoreboard.you')} ` : ''}{p2Name}</span>
  </div>
</div>

<style>
  .scoreboard {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.5rem;
    background: #16213e;
    border-radius: 12px;
    gap: 1rem;
  }

  .player {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .player.you .name {
    color: #7c3aed;
  }

  .name {
    font-weight: 600;
    font-size: 1rem;
  }

  .score {
    font-size: 1.8rem;
    font-weight: 800;
    color: #f1f1f1;
  }

  .round-info {
    font-size: 0.85rem;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
</style>
