<script lang="ts">
  let { children } = $props();
</script>

<svelte:head>
  <title>RPS Hand Tactics</title>
</svelte:head>

<div class="app">
  {@render children()}
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #0f0f23;
    color: #e0e0e0;
    min-height: 100vh;
  }

  :global(*) {
    box-sizing: border-box;
  }

  .app {
    max-width: 600px;
    margin: 0 auto;
    padding: 1rem;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
</style>
