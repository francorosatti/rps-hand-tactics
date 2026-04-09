<script lang="ts">
  import { onMount } from 'svelte';
  import type { GameMode } from 'shared';
  import { getSocket, connectSocket } from '$lib/stores/socket.js';
  import {
    initGameListeners,
    currentScreen,
    gameState,
    draftCards,
    matchResult,
    lastRoundResult,
    opponentDisconnected,
    errorMessage,
    searching,
    rematchState,
    chatMessages,
    sendChatMessage,
  } from '$lib/stores/game.js';
  import HandPicker from '$lib/components/HandPicker.svelte';
  import CardHand from '$lib/components/CardHand.svelte';
  import CardSlot from '$lib/components/CardSlot.svelte';
  import Scoreboard from '$lib/components/Scoreboard.svelte';
  import RoundResult from '$lib/components/RoundResult.svelte';
  import Timer from '$lib/components/Timer.svelte';
  import type { Move, Card } from 'shared';
  import { FIELD_PLUS_INFO, FIELD_MINUS_INFO } from 'shared';
  import { t, locale } from '$lib/i18n/index.js';

  function activeFieldLabel(move: Move, modifier: number): string {
    const info = modifier > 0 ? FIELD_PLUS_INFO[move] : FIELD_MINUS_INFO[move];
    const cardId = `field-${move}-${modifier > 0 ? 'plus' : 'minus'}`;
    const effect = modifier > 0 ? $t('game.boosts') : $t('game.weakens');
    return `${info.icon} ${$t(`card.${cardId}.name`)} (${effect} ${$t(`move.${move}`)})`;
  }

  let playerName = $state('');
  let joinCode = $state('');
  let createMode = $state<GameMode>('random');
  let quickModes = $state<GameMode[]>(['random', 'draft']);

  // Draft state
  let draftSelection = $state<{ uid: string; id: string }[]>([]);
  let draftSubmitted = $state(false);

  // Game state
  let selectedMove = $state<Move | null>(null);
  let selectedCardId = $state<string | null>(null);
  let lockedIn = $state(false);
  let chatInput = $state('');

  onMount(() => {
    const saved = localStorage.getItem('rps-player-name');
    if (saved) playerName = saved;

    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      window.history.replaceState({}, '', window.location.pathname);
    }

    connectSocket();
    initGameListeners();

    if (roomParam && playerName.trim()) {
      const socket = getSocket();
      socket.emit('join-room', { roomCode: roomParam.trim().toUpperCase(), playerName: playerName.trim() });
    } else if (roomParam) {
      joinCode = roomParam.toUpperCase();
    }
  });

  function saveName() {
    localStorage.setItem('rps-player-name', playerName);
  }

  function createRoom() {
    if (!playerName.trim()) return;
    saveName();
    const socket = getSocket();
    socket.emit('create-room', { playerName: playerName.trim(), mode: createMode });
  }

  function joinRoom() {
    if (!playerName.trim() || !joinCode.trim()) return;
    saveName();
    const socket = getSocket();
    socket.emit('join-room', { roomCode: joinCode.trim().toUpperCase(), playerName: playerName.trim() });
  }

  function quickMatch() {
    if (!playerName.trim() || quickModes.length === 0) return;
    saveName();
    const socket = getSocket();
    socket.emit('queue-quickmatch', { playerName: playerName.trim(), modes: quickModes });
    $searching = true;
  }

  function cancelQuickMatch() {
    const socket = getSocket();
    socket.emit('cancel-quickmatch');
    $searching = false;
  }

  function selectMove(move: Move) {
    if (lockedIn) return;
    selectedMove = move;
    const socket = getSocket();
    socket.emit('submit-move', { move, cardUid: selectedCardId ?? undefined });
  }

  function selectCard(card: Card | null) {
    if (lockedIn) return;
    selectedCardId = card?.uid ?? null;
    if (selectedMove) {
      const socket = getSocket();
      socket.emit('submit-move', { move: selectedMove, cardUid: selectedCardId ?? undefined });
    }
  }

  function lockIn() {
    if (!selectedMove || lockedIn) return;
    lockedIn = true;
    const socket = getSocket();
    socket.emit('lock-in');
  }

  function rematch() {
    const socket = getSocket();
    socket.emit('rematch');
    $rematchState = 'sent';
    selectedMove = null;
    selectedCardId = null;
    lockedIn = false;
    draftSubmitted = false;
    draftSelection = [];
  }

  function declineRematch() {
    const socket = getSocket();
    socket.emit('decline-rematch');
    $rematchState = 'none';
  }

  function leaveGame() {
    const socket = getSocket();
    socket.emit('leave-game');
    $currentScreen = 'home';
    $gameState = null;
    $matchResult = null;
    $chatMessages = [];
    $rematchState = 'none';
    selectedMove = null;
    selectedCardId = null;
    lockedIn = false;
    draftSubmitted = false;
    draftSelection = [];
  }

  function copyRoomCode() {
    if ($gameState?.roomCode) {
      navigator.clipboard.writeText($gameState.roomCode);
    }
  }

  function copyRoomLink() {
    if ($gameState?.roomCode) {
      const url = new URL(window.location.href.split('?')[0]);
      url.searchParams.set('room', $gameState.roomCode);
      navigator.clipboard.writeText(url.toString());
    }
  }

  let lastRound = $state(0);
  $effect(() => {
    const round = $gameState?.round ?? 0;
    if (round !== lastRound) {
      lastRound = round;
      selectedMove = null;
      selectedCardId = null;
      lockedIn = false;
    }
  });

  function toggleDraftCard(uid: string, id: string) {
    const idx = draftSelection.findIndex((s) => s.uid === uid);
    if (idx !== -1) {
      draftSelection = draftSelection.filter((_, i) => i !== idx);
    } else if (draftSelection.length < 3) {
      draftSelection = [...draftSelection, { uid, id }];
    }
  }

  function submitDraft() {
    if (draftSelection.length !== 3) return;
    const socket = getSocket();
    socket.emit('submit-draft', { cardIds: draftSelection.map((s) => s.id) });
    draftSubmitted = true;
  }

  function submitChat() {
    if (!chatInput.trim()) return;
    sendChatMessage(chatInput);
    chatInput = '';
  }
</script>

{#if $errorMessage}
  <div class="error-toast">{$errorMessage}</div>
{/if}

{#if $currentScreen === 'home'}
  <div class="home">
    <div class="lang-toggle">
      <button class="lang-btn" class:active={$locale === 'en'} onclick={() => $locale = 'en'}>EN</button>
      <button class="lang-btn" class:active={$locale === 'es'} onclick={() => $locale = 'es'}>ES</button>
    </div>
    <h1>{$t('home.title')}</h1>
    <p class="subtitle">{$t('home.subtitle')}</p>

    <div class="name-input">
      <input type="text" bind:value={playerName} placeholder={$t('home.yourName')} maxlength="20" />
    </div>

    <div class="section">
      <h2>{$t('home.createRoom')}</h2>
      <div class="mode-select">
        <button class:active={createMode === 'random'} onclick={() => createMode = 'random'}>{$t('home.randomCards')}</button>
        <button class:active={createMode === 'draft'} onclick={() => createMode = 'draft'}>{$t('home.draftCards')}</button>
      </div>
      <p class="mode-desc">{createMode === 'random' ? $t('home.randomCardsDesc') : $t('home.draftCardsDesc')}</p>
      <button class="primary-btn" onclick={createRoom} disabled={!playerName.trim()}>{$t('home.createRoom')}</button>
    </div>

    <div class="section">
      <h2>{$t('home.joinRoom')}</h2>
      <div class="join-row">
        <input type="text" bind:value={joinCode} placeholder={$t('home.roomCode')} maxlength="4" class="code-input" />
        <button class="primary-btn" onclick={joinRoom} disabled={!playerName.trim() || !joinCode.trim()}>{$t('home.join')}</button>
      </div>
    </div>

    <div class="section">
      <h2>{$t('home.quickMatch')}</h2>
      <div class="mode-select">
        <button
          class:active={quickModes.includes('random')}
          onclick={() => quickModes = quickModes.includes('random') ? quickModes.filter(m => m !== 'random') : [...quickModes, 'random']}
        >{$t('home.randomCards')}</button>
        <button
          class:active={quickModes.includes('draft')}
          onclick={() => quickModes = quickModes.includes('draft') ? quickModes.filter(m => m !== 'draft') : [...quickModes, 'draft']}
        >{$t('home.draftCards')}</button>
      </div>
      <p class="mode-desc">
        {#if quickModes.length === 2}
          {$t('home.bothModesDesc')}
        {:else if quickModes.includes('random')}
          {$t('home.randomCardsDesc')}
        {:else if quickModes.includes('draft')}
          {$t('home.draftCardsDesc')}
        {/if}
      </p>
      {#if $searching}
        <button class="primary-btn cancel" onclick={cancelQuickMatch}>{$t('home.cancelSearch')}</button>
        <p class="searching">{$t('home.searching')}</p>
      {:else}
        <button class="primary-btn" onclick={quickMatch} disabled={!playerName.trim() || quickModes.length === 0}>{$t('home.findMatch')}</button>
      {/if}
    </div>
  </div>

{:else if $currentScreen === 'lobby'}
  <div class="lobby">
    <h1>{$t('lobby.waiting')}</h1>
    {#if $gameState?.roomCode}
      <div class="room-code-display">
        <span class="code">{$gameState.roomCode}</span>
        <button onclick={copyRoomCode} class="copy-btn">{$t('lobby.copyCode')}</button>
        <button onclick={copyRoomLink} class="copy-btn">{$t('lobby.copyLink')}</button>
      </div>
      <p>{$t('lobby.shareCode')}</p>
    {/if}
    <div class="spinner"></div>
    <button class="secondary-btn" onclick={leaveGame}>{$t('lobby.leave')}</button>
  </div>

{:else if $currentScreen === 'drafting'}
  <div class="draft-screen">
    {#if draftSubmitted}
      <h1>{$t('draft.lockedIn')}</h1>
      <div class="draft-summary">
        <p>{$t('draft.yourPicks')}</p>
        <div class="draft-picks">
          {#each draftSelection as sel (sel.uid)}
            {@const card = $draftCards.find((c) => c.uid === sel.uid)}
            {#if card}
              <CardSlot {card} selected={true} disabled={true} onSelect={() => {}} />
            {/if}
          {/each}
        </div>
      </div>
      <div class="waiting-opponent">
        <div class="spinner"></div>
        <p>{$t('draft.waitingOpponent')}</p>
      </div>
    {:else}
      <h1>{$t('draft.title')}</h1>
      <p>{$t('draft.pickCards')} ({draftSelection.length}/3)</p>

      {@const sections = [
        { label: $t('draft.boost'), color: '#22c55e', cards: $draftCards.filter(c => c.type === 'strengthen') },
        { label: $t('draft.sabotage'), color: '#ef4444', cards: $draftCards.filter(c => c.type === 'weaken') },
        { label: $t('draft.special'), color: '#3b82f6', cards: $draftCards.filter(c => c.type === 'special' || c.type === 'nullify' || c.type === 'field') },
        { label: $t('draft.field'), color: '#a855f7', cards: $draftCards.filter(c => c.type === 'field_persistent') },
      ]}

      {#each sections as section}
        {#if section.cards.length > 0}
          <div class="draft-section">
            <h3 class="draft-section-label" style="color: {section.color}">{section.label}</h3>
            <div class="draft-grid">
              {#each section.cards as card (card.uid)}
                <CardSlot
                  {card}
                  selected={draftSelection.some((s) => s.uid === card.uid)}
                  disabled={draftSelection.length >= 3 && !draftSelection.some((s) => s.uid === card.uid)}
                  onSelect={() => toggleDraftCard(card.uid, card.id)}
                />
              {/each}
            </div>
          </div>
        {/if}
      {/each}

      <button class="primary-btn" onclick={submitDraft} disabled={draftSelection.length !== 3}>
        {$t('draft.confirmDraft')}
      </button>
    {/if}
  </div>

{:else if $currentScreen === 'game' && $gameState}
  <div class="game-screen">
    {#if $opponentDisconnected}
      <div class="disconnect-banner">{$t('game.opponentDisconnected')}</div>
    {/if}

    <Scoreboard
      p1Name={$gameState.players[0].name}
      p2Name={$gameState.players[1].name}
      p1Score={$gameState.players[0].score}
      p2Score={$gameState.players[1].score}
      round={$gameState.round}
      playerIndex={$gameState.playerIndex}
    />

    {#if $gameState.activeField}
      <div class="active-field">
        {$t('game.activeField')} {activeFieldLabel($gameState.activeField.move, $gameState.activeField.modifier)}
      </div>
    {/if}

    {#if $lastRoundResult && ($gameState.phase === 'revealing' || $gameState.phase === 'round-end')}
      <RoundResult
        result={$lastRoundResult}
        playerIndex={$gameState.playerIndex}
        p1Name={$gameState.players[0].name}
        p2Name={$gameState.players[1].name}
      />
    {:else if $gameState.phase === 'picking'}
      <div class="picking-area">
        <div class="opponent-status">
          {#if $gameState.players[$gameState.playerIndex === 0 ? 1 : 0].lockedIn}
            <span class="locked">{$t('game.opponentLocked')}</span>
          {:else}
            <span class="waiting-opp">{$t('game.opponentChoosing')}</span>
          {/if}
        </div>

        <Timer seconds={$gameState.turnTimer} />

        <HandPicker
          selected={selectedMove}
          disabled={lockedIn}
          onSelect={selectMove}
        />

        {#if $gameState.players[$gameState.playerIndex].hand}
          <CardHand
            cards={$gameState.players[$gameState.playerIndex].hand!}
            selectedCardId={selectedCardId}
            disabled={lockedIn}
            onSelectCard={selectCard}
          />
        {/if}

        <button
          class="primary-btn lock-btn"
          onclick={lockIn}
          disabled={!selectedMove || lockedIn}
        >
          {lockedIn ? $t('game.lockedIn') : $t('game.lockIn')}
        </button>
      </div>
    {/if}

    <div class="chat-box">
      <div class="chat-title">💬 {$t('game.chatTitle')}</div>
      <div class="chat-messages">
        {#if $chatMessages.length === 0}
          <p class="chat-empty">{$t('game.chatEmpty')}</p>
        {:else}
          {#each $chatMessages as message (message.id)}
            <div class="chat-message" class:mine={message.playerIndex === $gameState.playerIndex}>
              <div class="chat-meta">
                <span class="chat-author">{message.playerName}</span>
                <span class="chat-time">{new Date(message.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <p>{message.text}</p>
            </div>
          {/each}
        {/if}
      </div>
      <form class="chat-input-row" onsubmit={(e) => { e.preventDefault(); submitChat(); }}>
        <input
          type="text"
          bind:value={chatInput}
          maxlength="200"
          placeholder={$t('game.chatPlaceholder')}
          aria-label={$t('game.chatTitle')}
        />
        <button class="primary-btn" type="submit" disabled={!chatInput.trim()}>{$t('game.chatSend')}</button>
      </form>
    </div>

    <button class="secondary-btn leave-btn" onclick={leaveGame}>{$t('game.leaveGame')}</button>
  </div>

{:else if $currentScreen === 'result'}
  <div class="result-screen">
    <h1>
      {#if $matchResult}
        {$matchResult.winner === null ? $t('result.draw') : $matchResult.winner === $gameState?.playerIndex ? $t('result.victory') : $t('result.defeat')}
      {/if}
    </h1>
    {#if $matchResult}
      <p class="final-score">{$matchResult.finalScore[0]} - {$matchResult.finalScore[1]}</p>
    {/if}
    <div class="result-actions">
      {#if $rematchState === 'sent'}
        <p class="rematch-status">{$t('result.rematchWaiting')}</p>
      {:else if $rematchState === 'received'}
        <p class="rematch-status">{$t('result.rematchRequested')}</p>
        <button class="primary-btn" onclick={rematch}>{$t('result.acceptRematch')}</button>
        <button class="secondary-btn" onclick={declineRematch}>{$t('result.declineRematch')}</button>
      {:else}
        <button class="primary-btn" onclick={rematch}>{$t('result.rematch')}</button>
      {/if}
      <button class="secondary-btn" onclick={leaveGame}>{$t('result.leave')}</button>
    </div>
  </div>
{/if}

<style>
  .home {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
    padding-top: 2rem;
  }

  h1 {
    font-size: 2rem;
    margin: 0;
    background: linear-gradient(135deg, #7c3aed, #3b82f6);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .subtitle {
    color: #888;
    margin: -0.5rem 0 0;
  }

  h2 {
    font-size: 1rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #888;
    margin: 0 0 0.5rem;
  }

  .section {
    width: 100%;
    background: #16213e;
    padding: 1.25rem;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .name-input input, .code-input {
    padding: 0.75rem;
    border: 2px solid #333;
    border-radius: 8px;
    background: #1a1a2e;
    color: white;
    font-size: 1rem;
    width: 100%;
  }

  .code-input {
    text-transform: uppercase;
    letter-spacing: 0.2em;
    text-align: center;
    font-weight: 700;
    min-width: 160px;
  }

  .code-input::placeholder {
    text-transform: none;
    letter-spacing: normal;
    font-weight: 400;
  }

  .join-row {
    display: flex;
    gap: 0.75rem;
    align-items: center;
  }

  .mode-select {
    display: flex;
    gap: 0.5rem;
  }

  .mode-select button {
    padding: 0.5rem 1rem;
    border: 2px solid #444;
    border-radius: 8px;
    background: transparent;
    color: #ccc;
    cursor: pointer;
    transition: all 0.2s;
  }

  .mode-select button.active {
    border-color: #7c3aed;
    background: #2d1b69;
    color: white;
  }

  .mode-desc {
    font-size: 0.8rem;
    color: #999;
    margin: 0.25rem 0 0.5rem;
    min-height: 1.2em;
  }

  .mode-desc-small {
    font-size: 0.7rem;
    color: #777;
    margin: 0.25rem 0 0;
  }

  .primary-btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 8px;
    background: #7c3aed;
    color: white;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .primary-btn:hover:not(:disabled) {
    background: #6d28d9;
  }

  .primary-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .primary-btn.cancel {
    background: #ef4444;
  }

  .secondary-btn {
    padding: 0.5rem 1rem;
    border: 2px solid #444;
    border-radius: 8px;
    background: transparent;
    color: #ccc;
    cursor: pointer;
    font-size: 0.9rem;
  }

  .secondary-btn:hover {
    border-color: #666;
  }

  .lang-toggle {
    display: flex;
    gap: 0.25rem;
    align-self: flex-end;
  }

  .lang-btn {
    padding: 0.3rem 0.6rem;
    border: 1px solid #444;
    border-radius: 6px;
    background: transparent;
    color: #888;
    cursor: pointer;
    font-size: 0.75rem;
    font-weight: 600;
    transition: all 0.2s;
  }

  .lang-btn.active {
    border-color: #7c3aed;
    color: #7c3aed;
    background: #2d1b69;
  }

  .searching {
    color: #888;
    font-style: italic;
    text-align: center;
  }

  .lobby {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
    padding-top: 4rem;
  }

  .room-code-display {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .code {
    font-size: 3rem;
    font-weight: 800;
    letter-spacing: 0.3em;
    color: #7c3aed;
  }

  .copy-btn {
    padding: 0.5rem 1rem;
    border: 2px solid #7c3aed;
    border-radius: 8px;
    background: transparent;
    color: #7c3aed;
    cursor: pointer;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #333;
    border-top: 4px solid #7c3aed;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .draft-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding-top: 1rem;
  }

  .draft-section {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .draft-section-label {
    margin: 0;
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    padding-bottom: 0.25rem;
    border-bottom: 1px solid #333;
  }

  .draft-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    justify-content: center;
  }

  .draft-summary {
    text-align: center;
    color: #aaa;
  }

  .draft-picks {
    display: flex;
    gap: 0.75rem;
    justify-content: center;
    margin-top: 0.5rem;
  }

  .waiting-opponent {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    margin-top: 1.5rem;
    color: #888;
  }

  .game-screen {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .picking-area {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.25rem;
    padding: 1rem 0;
  }

  .opponent-status {
    font-size: 0.9rem;
  }

  .locked { color: #22c55e; }
  .waiting-opp { color: #888; }

  .lock-btn {
    width: 100%;
    padding: 1rem;
    font-size: 1.2rem;
  }

  .leave-btn {
    align-self: center;
    margin-top: auto;
  }

  .chat-box {
    border: 1px solid #30363d;
    background: #0f172a;
    border-radius: 12px;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .chat-title {
    font-size: 0.9rem;
    color: #cbd5e1;
    font-weight: 600;
  }

  .chat-messages {
    max-height: 180px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    padding-right: 0.25rem;
  }

  .chat-empty {
    margin: 0;
    color: #94a3b8;
    font-size: 0.85rem;
  }

  .chat-message {
    background: #111827;
    border: 1px solid #1f2937;
    border-radius: 8px;
    padding: 0.45rem 0.6rem;
  }

  .chat-message.mine {
    background: #1e1b4b;
    border-color: #3730a3;
  }

  .chat-meta {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    margin-bottom: 0.15rem;
  }

  .chat-author {
    color: #c4b5fd;
    font-size: 0.78rem;
    font-weight: 700;
  }

  .chat-time {
    color: #94a3b8;
    font-size: 0.74rem;
  }

  .chat-message p {
    margin: 0;
    color: #e2e8f0;
    font-size: 0.88rem;
    word-break: break-word;
  }

  .chat-input-row {
    display: flex;
    gap: 0.5rem;
  }

  .chat-input-row input {
    flex: 1;
    min-width: 0;
    padding: 0.6rem 0.7rem;
    border: 1px solid #334155;
    border-radius: 8px;
    background: #020617;
    color: #e2e8f0;
  }

  .chat-input-row .primary-btn {
    padding: 0.6rem 0.9rem;
    font-size: 0.9rem;
  }

  .active-field {
    text-align: center;
    padding: 0.5rem;
    background: #2d1b69;
    border-radius: 8px;
    font-size: 0.85rem;
    color: #a78bfa;
    text-transform: capitalize;
  }

  .disconnect-banner {
    background: #ef4444;
    color: white;
    text-align: center;
    padding: 0.5rem;
    border-radius: 8px;
    font-weight: 600;
  }

  .result-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
    padding-top: 4rem;
  }

  .final-score {
    font-size: 3rem;
    font-weight: 800;
  }

  .result-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 1rem;
  }

  .rematch-status {
    width: 100%;
    text-align: center;
    color: #94a3b8;
    font-size: 0.95rem;
    margin: 0;
  }

  .error-toast {
    position: fixed;
    top: 1rem;
    left: 50%;
    transform: translateX(-50%);
    background: #ef4444;
    color: white;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    z-index: 100;
    font-weight: 600;
  }
</style>
