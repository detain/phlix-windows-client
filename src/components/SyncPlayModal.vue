<script setup lang="ts">
/**
 * SyncPlayModal.vue
 *
 * Modal for creating and joining SyncPlay rooms.
 * Shows public rooms list, room creation form, and join functionality.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { ref, computed, onMounted } from 'vue';
import { useSyncPlayStore } from '../stores/useSyncPlayStore';
import Icon from '@phlix/ui/components/Icon.vue';
import Button from '@phlix/ui/components/Button.vue';
import Input from '@phlix/ui/components/Input.vue';
import Switch from '@phlix/ui/components/Switch.vue';

interface Props {
  visible: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'joined', roomId: string): void;
}>();

const store = useSyncPlayStore();

// Form state
const roomName = ref('');
const isPublic = ref(true);
const selectedRoomId = ref<string | null>(null);

// Computed
const canCreate = computed(() => roomName.value.trim().length > 0);
const canJoin = computed(() => selectedRoomId.value !== null);
const isProcessing = computed(() => store.isLoading);
const hasError = computed(() => store.error !== null);

// Fetch rooms when modal becomes visible
onMounted(async () => {
  if (props.visible) {
    await store.fetchPublicRooms();
  }
});

/**
 * Create a new room and join it.
 */
async function handleCreateRoom(): Promise<void> {
  if (!canCreate.value) return;

  try {
    const { roomId } = await store.createRoom(roomName.value, isPublic.value);
    await store.joinRoom(roomId);
    emit('joined', roomId);
    emit('close');
    resetForm();
  } catch (err) {
    // Error is already set in store
    console.error('Failed to create room:', err);
  }
}

/**
 * Join a selected public room.
 */
async function handleJoinRoom(): Promise<void> {
  if (!canJoin.value) return;

  try {
    await store.joinRoom(selectedRoomId.value!);
    emit('joined', selectedRoomId.value!);
    emit('close');
    resetForm();
  } catch (err) {
    console.error('Failed to join room:', err);
  }
}

/**
 * Select a room from the public rooms list.
 */
function selectRoom(roomId: string): void {
  selectedRoomId.value = roomId;
}

/**
 * Close the modal and reset form.
 */
function handleClose(): void {
  resetForm();
  store.clearError();
  emit('close');
}

/**
 * Reset form state.
 */
function resetForm(): void {
  roomName.value = '';
  isPublic.value = true;
  selectedRoomId.value = null;
  store.clearError();
}
</script>

<template>
  <div v-if="visible" class="syncplay-modal-overlay" @click.self="handleClose">
    <div class="syncplay-modal">
      <header class="syncplay-modal-header">
        <h2>SyncPlay</h2>
        <button class="close-btn" @click="handleClose" aria-label="Close">
          <Icon name="x" />
        </button>
      </header>

      <div class="syncplay-modal-body">
        <!-- Error display -->
        <div v-if="hasError" class="error-banner">
          {{ store.error }}
        </div>

        <!-- Create Room Section -->
        <section class="section">
          <h3>Create Room</h3>
          <div class="create-form">
            <Input
              v-model="roomName"
              placeholder="Room name"
              :disabled="isProcessing"
              @keyup.enter="handleCreateRoom"
            />
            <div class="public-toggle">
              <Switch v-model="isPublic" :disabled="isProcessing" />
              <span>Public room</span>
            </div>
            <Button
              variant="primary"
              :disabled="!canCreate || isProcessing"
              :loading="isProcessing"
              @click="handleCreateRoom"
            >
              Create & Join
            </Button>
          </div>
        </section>

        <!-- Public Rooms Section -->
        <section class="section">
          <h3>Public Rooms</h3>
          <div v-if="store.publicRooms.length === 0" class="empty-state">
            <p>No public rooms available.</p>
            <p>Create one above!</p>
          </div>
          <ul v-else class="room-list">
            <li
              v-for="room in store.publicRooms"
              :key="room.id"
              class="room-item"
              :class="{ selected: selectedRoomId === room.id }"
              @click="selectRoom(room.id)"
            >
              <div class="room-info">
                <span class="room-name">{{ room.name }}</span>
                <span class="room-members">{{ room.memberCount }} members</span>
              </div>
              <Icon v-if="selectedRoomId === room.id" name="check" />
            </li>
          </ul>
          <Button
            v-if="store.publicRooms.length > 0"
            variant="secondary"
            :disabled="!canJoin || isProcessing"
            :loading="isProcessing"
            @click="handleJoinRoom"
          >
            Join Selected Room
          </Button>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.syncplay-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.syncplay-modal {
  background: var(--color-bg-secondary, #1a1a2e);
  border-radius: 12px;
  width: 100%;
  max-width: 480px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.syncplay-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border, #333);
}

.syncplay-modal-header h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: var(--color-text-secondary, #999);
  transition: color 0.2s;
}

.close-btn:hover {
  color: var(--color-text, #fff);
}

.syncplay-modal-body {
  padding: 20px;
  overflow-y: auto;
}

.error-banner {
  background: var(--color-error-bg, rgba(239, 68, 68, 0.2));
  color: var(--color-error, #ef4444);
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 0.875rem;
}

.section {
  margin-bottom: 24px;
}

.section:last-child {
  margin-bottom: 0;
}

.section h3 {
  margin: 0 0 12px;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-secondary, #999);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.create-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.public-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
  color: var(--color-text-secondary, #999);
}

.empty-state {
  text-align: center;
  padding: 24px;
  color: var(--color-text-secondary, #999);
}

.empty-state p {
  margin: 0 0 8px;
}

.room-list {
  list-style: none;
  margin: 0 0 12px;
  padding: 0;
  max-height: 200px;
  overflow-y: auto;
}

.room-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.room-item:hover {
  background: var(--color-bg-hover, #2a2a3e);
}

.room-item.selected {
  background: var(--color-primary-bg, rgba(99, 102, 241, 0.2));
  border: 1px solid var(--color-primary, #6366f1);
}

.room-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.room-name {
  font-weight: 500;
}

.room-members {
  font-size: 0.75rem;
  color: var(--color-text-secondary, #999);
}
</style>
