<script lang="ts">
  interface Props {
    seconds: number;
  }

  let { seconds }: Props = $props();
  let remaining = $state(0);

  $effect(() => {
    remaining = seconds;
    const interval = setInterval(() => {
      remaining = Math.max(0, remaining - 1);
    }, 1000);
    return () => clearInterval(interval);
  });
</script>

<div class="timer" class:urgent={remaining <= 5}>
  {remaining}s
</div>

<style>
  .timer {
    font-size: 1.2rem;
    font-weight: 700;
    color: #888;
    font-variant-numeric: tabular-nums;
  }

  .timer.urgent {
    color: #ef4444;
    animation: pulse 0.5s ease-in-out infinite alternate;
  }

  @keyframes pulse {
    from { transform: scale(1); }
    to { transform: scale(1.1); }
  }
</style>
