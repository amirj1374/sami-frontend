<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { usersApi } from '@/api/users'
import { useApiError } from '@/composables/useApiError'
import type { AdminUser, UserAuditEntry } from '@/types/models'

/** Read-only audit trail of one user: who did what, when, old → new values. */
const props = defineProps<{
  modelValue: boolean
  user: AdminUser | null
}>()

const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

const open = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const entries = ref<UserAuditEntry[]>([])
const totalPages = ref(0)
const page = ref(1)
const loading = ref(false)
const { message: errorMessage, set: setError, clear: clearError } = useApiError()

const ACTION_COLORS: Record<string, string> = {
  CREATED: 'success',
  UPDATED: 'info',
  STATUS_CHANGED: 'info',
  ARCHIVED: 'warning',
  RESTORED: 'success',
  DELETED: 'error',
  PURGED: 'error',
  AVATAR_UPDATED: 'info',
}

async function load() {
  if (!props.user) return
  loading.value = true
  clearError()
  try {
    const result = await usersApi.audit(props.user.id, { page: page.value - 1, size: 10 })
    entries.value = result.content
    totalPages.value = result.totalPages
  } catch (err) {
    setError(err)
  } finally {
    loading.value = false
  }
}

watch(open, (isOpen) => {
  if (isOpen) {
    page.value = 1
    void load()
  }
})
watch(page, () => void load())

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  )
}

function changes(entry: UserAuditEntry): { key: string; from: unknown; to: unknown }[] {
  const keys = new Set([
    ...Object.keys(entry.oldValues ?? {}),
    ...Object.keys(entry.newValues ?? {}),
  ])
  return [...keys].map((key) => ({
    key,
    from: entry.oldValues?.[key],
    to: entry.newValues?.[key],
  }))
}
</script>

<template>
  <v-dialog v-model="open" max-width="680">
    <v-card rounded="lg">
      <v-card-title class="text-h6 pt-4 px-6">
        Audit trail — {{ user?.fullName }}
      </v-card-title>

      <v-card-text class="px-6" style="max-height: 60vh; overflow-y: auto">
        <v-alert v-if="errorMessage" type="error" variant="tonal" density="compact" class="mb-4">
          {{ errorMessage }}
        </v-alert>

        <v-progress-linear v-if="loading" indeterminate class="mb-4" />

        <p v-if="!loading && entries.length === 0" class="text-body-2 text-medium-emphasis">
          No audit entries.
        </p>

        <v-timeline density="compact" side="end" truncate-line="both">
          <v-timeline-item
            v-for="entry in entries"
            :key="entry.id"
            :dot-color="ACTION_COLORS[entry.action] ?? 'default'"
            size="x-small"
          >
            <div class="d-flex align-center flex-wrap mb-1">
              <v-chip size="x-small" variant="tonal" :color="ACTION_COLORS[entry.action]" class="mr-2">
                {{ entry.action }}
              </v-chip>
              <span class="text-caption text-medium-emphasis">
                {{ formatDate(entry.createdAt) }}
                <template v-if="entry.actorEmail"> · by {{ entry.actorEmail }}</template>
                <template v-else> · system</template>
              </span>
            </div>
            <div v-for="change in changes(entry)" :key="change.key" class="text-body-2">
              <strong>{{ change.key }}</strong
              >:
              <span class="text-medium-emphasis">{{ change.from ?? '—' }}</span>
              →
              <span>{{ change.to ?? '—' }}</span>
            </div>
          </v-timeline-item>
        </v-timeline>

        <v-pagination
          v-if="totalPages > 1"
          v-model="page"
          :length="totalPages"
          density="comfortable"
          class="mt-2"
        />
      </v-card-text>

      <v-card-actions class="px-6 pb-4">
        <v-spacer />
        <v-btn variant="text" @click="open = false">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
