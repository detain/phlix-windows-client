<script setup lang="ts">
/**
 * SyncPlayOverlay.vue
 *
 * Overlay shown when user is in a SyncPlay room.
 * Displays room info, member count, sync status, and leave button.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { computed } from 'vue';
import { useSyncPlayStore } from '../stores/useSyncPlayStore';
import Icon from '@phlix/ui/components/Icon.vue';
import Button from '@phlix/ui/components/Button.vue';

const store = useSyncPlayStore();

// Computed
const isInRoom = computed(() => store.isInRoom);
const roomName = computed(() => store.roomName);
const memberCount = computed(() => store.memberCount);
const isConnected = computed(() => store.isConnected);
const sessionState = computed(() => store.session?.state ?? 'unknown');

/**
 * Get the appropriate icon for the current session state.
 */
function getStateIcon(state: string): string {
  switch (state) {
    case 'playing':
      return 'play';
    case 'paused':
      return 'pause';
    case 'waiting':
      return 'clock';
    case 'ended':
      return 'x-circle';
    default:
      return 'help-circle';
  }
}

/**
 * Handle leave room action.
 */
async function handleLeave(): Promise<void> {
  await store.leaveRoom();
}
</script>

<template>
  <div
    v-if="isInRoom"
    class="syncplay-overlay"
  >
    <div class="syncplay-info">
      <div class="syncplay-icon">
        <Icon name="users" />
      </div>
      <div class="syncplay-details">
        <span class="room-name">{{ roomName }}</span>
        <div class="syncplay-status">
          <span
            class="status-indicator"
            :class="{ connected: isConnected }"
          />
          <span class="member-count">{{ memberCount }} {{ memberCount === 1 ? 'member' : 'members' }}</span>
        </div>
      </div>
    </div>

    <div class="syncplay-state">
      <Icon :name="getStateIcon(sessionState)" />
      <span class="state-label">{{ sessionState }}</span>
    </div>

    <Button
      variant="ghost"
      size="sm"
      @click="handleLeave"
    >
      <Icon name="log-out" />
      Leave
    </Button>
  </div>
</template>

<style scoped>
.syncplay-overlay {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 16px;
  background: var(--color-bg-secondary, #1a1a2e);
  border-radius: 8px;
  border: 1px solid var(--color-border, #333);
}

.syncplay-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.syncplay-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--color-primary-bg, rgba(99, 102, 241, 0.2));
  color: var(--color-primary, #6366f1);
}

.syncplay-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.room-name {
  font-weight: 600;
  font-size: 0.875rem;
}

.syncplay-status {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-warning, #f59e0b);
}

.status-indicator.connected {
  background: var(--color-success, #10b981);
}

.member-count {
  font-size: 0.75rem;
  color: var(--color-text-secondary, #999);
}

.syncplay-state {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: var(--color-bg-tertiary, #252538);
  border-radius: 16px;
  font-size: 0.75rem;
  color: var(--color-text-secondary, #999);
  text-transform: capitalize;
}

.state-label {
  min-width: 60px;
  text-align: center;
}
</style>
