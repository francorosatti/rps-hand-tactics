<script lang="ts">
  import type { Move } from 'shared';

  interface Props {
    selected: Move | null;
    disabled: boolean;
    onSelect: (move: Move) => void;
  }

  let { selected, disabled, onSelect }: Props = $props();

  const moves: { move: Move; emoji: string }[] = [
    { move: 'rock', emoji: '🪨' },
    { move: 'paper', emoji: '📄' },
    { move: 'scissors', emoji: '✂️' },
  ];
</script>

<div class="hand-picker">
  {#each moves as { move, emoji }}
    <button
      class="move-btn"
      class:selected={selected === move}
      disabled={disabled}
      onclick={() => onSelect(move)}
    >
      <span class="emoji">{emoji}</span>
      <span class="label">{move}</span>
    </button>
  {/each}
</div>

<style>
  .hand-picker {
    display: flex;
    gap: 1rem;
    justify-content: center;
  }

  .move-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem 1.5rem;
    border: 3px solid #444;
    border-radius: 16px;
    background: #1a1a2e;
    color: white;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 1rem;
    min-width: 80px;
  }

  .move-btn:hover:not(:disabled) {
    border-color: #7c3aed;
    transform: translateY(-4px);
  }

  .move-btn.selected {
    border-color: #7c3aed;
    background: #2d1b69;
    box-shadow: 0 0 20px rgba(124, 58, 237, 0.4);
  }

  .move-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .emoji {
    font-size: 2.5rem;
  }

  .label {
    text-transform: capitalize;
    font-weight: 600;
  }
</style>
