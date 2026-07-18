<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { suppliersApi } from '@/api/suppliers'
import { useApiError } from '@/composables/useApiError'
import { usePermission } from '@/composables/usePermission'
import type {
  SupDocumentType,
  SupRatingCriterion,
  SupplierDetail,
  SupplierDocument,
  SupplierLogEntry,
  SupplierRating,
  SupplierRow,
} from '@/types/models'

/**
 * Supplier 360°: profile summary, per-criterion evaluation (weighted overall),
 * documents and the append-only history log.
 */
const props = defineProps<{
  modelValue: boolean
  supplierId: number | null
  criteria: SupRatingCriterion[]
  documentTypes: SupDocumentType[]
}>()

const emit = defineEmits<{ 'update:modelValue': [boolean]; changed: [] }>()

const open = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const { can } = usePermission()
const { message: errorMessage, set: setError, clear: clearError } = useApiError()

const detail = ref<SupplierDetail | null>(null)
const tab = ref<'profile' | 'rating' | 'documents' | 'history'>('profile')
const busy = ref(false)

const ratings = ref<SupplierRating[]>([])
const documents = ref<SupplierDocument[]>([])
const logs = ref<SupplierLogEntry[]>([])
const scores = ref<Record<number, number>>({})

async function reload() {
  if (!props.supplierId) return
  clearError()
  try {
    detail.value = await suppliersApi.get(props.supplierId)
    ;[ratings.value, documents.value] = await Promise.all([
      suppliersApi.ratings(props.supplierId),
      suppliersApi.documents(props.supplierId),
    ])
    logs.value = (await suppliersApi.logs(props.supplierId, { size: 30 })).content
    scores.value = {}
    props.criteria.filter((c) => c.active).forEach((c) => {
      scores.value[c.id] = ratings.value.find((r) => r.criterionId === c.id)?.score ?? 0
    })
  } catch (err) {
    setError(err)
  }
}

watch(open, (isOpen) => {
  if (!isOpen) return
  tab.value = 'profile'
  void reload()
})

async function saveRatings() {
  if (!props.supplierId) return
  busy.value = true
  clearError()
  try {
    await suppliersApi.rate(
      props.supplierId,
      Object.entries(scores.value)
        .filter(([, score]) => score > 0)
        .map(([criterionId, score]) => ({ criterionId: Number(criterionId), score })),
    )
    await reload()
    emit('changed')
  } catch (err) {
    setError(err)
  } finally {
    busy.value = false
  }
}

// --- Documents ---------------------------------------------------------------
const documentInput = ref<HTMLInputElement | null>(null)
const docTypeId = ref<number | null>(null)

async function onDocumentFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !props.supplierId) return
  busy.value = true
  clearError()
  try {
    await suppliersApi.uploadDocument(props.supplierId, file, docTypeId.value ?? undefined)
    await reload()
  } catch (err) {
    setError(err)
  } finally {
    busy.value = false
  }
}

async function downloadDocument(doc: SupplierDocument) {
  if (!props.supplierId) return
  const blob = await suppliersApi.downloadDocument(props.supplierId, doc.id)
  if (!blob) return
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = doc.fileName
  link.click()
  URL.revokeObjectURL(url)
}

async function deleteDocument(doc: SupplierDocument) {
  if (!props.supplierId) return
  busy.value = true
  try {
    await suppliersApi.deleteDocument(props.supplierId, doc.id)
    await reload()
  } catch (err) {
    setError(err)
  } finally {
    busy.value = false
  }
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  )
}

const row = computed<SupplierRow | null>(() => detail.value?.supplier ?? null)
</script>

<template>
  <v-dialog v-model="open" max-width="820">
    <v-card v-if="row" rounded="lg">
      <v-card-title class="text-h6 pt-4 px-6 d-flex align-center flex-wrap">
        {{ row.displayName }}
        <span class="text-body-2 text-medium-emphasis ml-2">{{ row.supplierCode }}</span>
        <v-chip size="small" variant="tonal" class="ml-3">{{ row.type.name }}</v-chip>
        <v-chip size="small" variant="tonal" class="ml-2" :color="row.status.isBlocking ? 'error' : 'success'">
          {{ row.status.name }}
        </v-chip>
        <v-spacer />
        <v-rating :model-value="row.ratingAvg ?? 0" density="compact" size="small" half-increments readonly />
        <span v-if="row.ratingAvg != null" class="text-body-2 ml-1">{{ row.ratingAvg.toFixed(2) }}</span>
      </v-card-title>

      <v-tabs v-model="tab" class="px-4" density="compact">
        <v-tab value="profile">Profile</v-tab>
        <v-tab value="rating">Evaluation</v-tab>
        <v-tab value="documents">Documents ({{ documents.length }})</v-tab>
        <v-tab value="history">History</v-tab>
      </v-tabs>
      <v-divider />

      <v-card-text class="px-6" style="max-height: 55vh; overflow-y: auto">
        <v-alert v-if="errorMessage" type="error" variant="tonal" density="compact" class="mb-3">
          {{ errorMessage }}
        </v-alert>

        <v-window v-model="tab">
          <v-window-item value="profile">
            <v-row dense class="text-body-2">
              <v-col cols="6" sm="4"><strong>Company:</strong> {{ row.companyName }}</v-col>
              <v-col cols="6" sm="4"><strong>Legal name:</strong> {{ detail?.legalName ?? '—' }}</v-col>
              <v-col cols="6" sm="4"><strong>Owner:</strong> {{ detail?.ownerName ?? '—' }}</v-col>
              <v-col cols="6" sm="4"><strong>Tax no.:</strong> {{ detail?.taxNumber ?? '—' }}</v-col>
              <v-col cols="6" sm="4"><strong>National ID:</strong> {{ detail?.nationalId ?? '—' }}</v-col>
              <v-col cols="6" sm="4"><strong>Reg. no.:</strong> {{ detail?.registrationNumber ?? '—' }}</v-col>
              <v-col cols="6" sm="4"><strong>City:</strong> {{ row.city ?? '—' }}</v-col>
              <v-col cols="6" sm="4"><strong>Payment term:</strong> {{ row.paymentTerm?.name ?? '—' }}</v-col>
              <v-col cols="6" sm="4"><strong>Credit limit:</strong> {{ row.creditLimit ?? '—' }}</v-col>
              <v-col cols="12"><strong>Website:</strong> {{ detail?.website ?? '—' }}</v-col>
            </v-row>

            <p class="text-subtitle-2 mt-4 mb-1">Channels</p>
            <div v-for="(channel, i) in detail?.channels" :key="'ch' + i" class="text-body-2">
              <v-icon :icon="channel.kind === 'PHONE' ? 'mdi-phone' : 'mdi-email'" size="x-small" />
              {{ channel.value }}
              <v-chip v-if="channel.isDefault" size="x-small" variant="tonal" class="ml-1">default</v-chip>
            </div>

            <p class="text-subtitle-2 mt-4 mb-1">Contact persons</p>
            <div v-for="(contact, i) in detail?.contacts" :key="'co' + i" class="text-body-2">
              {{ contact.fullName }}
              <span class="text-caption text-medium-emphasis">
                {{ [contact.position, contact.mobile ?? contact.phone, contact.email].filter(Boolean).join(' · ') }}
              </span>
              <v-chip v-if="contact.isPrimary" size="x-small" variant="tonal" class="ml-1">primary</v-chip>
            </div>

            <p class="text-subtitle-2 mt-4 mb-1">Bank accounts</p>
            <div v-for="(bank, i) in detail?.bankAccounts" :key="'b' + i" class="text-body-2">
              {{ bank.bankName }}
              <span class="text-caption text-medium-emphasis">
                {{ [bank.iban, bank.accountNumber, bank.accountHolder].filter(Boolean).join(' · ') }}
              </span>
              <v-chip v-if="bank.isDefault" size="x-small" variant="tonal" class="ml-1">default</v-chip>
            </div>
          </v-window-item>

          <v-window-item value="rating">
            <p class="text-body-2 text-medium-emphasis mb-3">
              Scores are 0–5 per criterion; the overall rating is the weighted average
              (weights are configurable). Score 0 leaves a criterion unrated.
            </p>
            <div
              v-for="criterion in criteria.filter((c) => c.active)"
              :key="criterion.id"
              class="d-flex align-center mb-2"
            >
              <span class="text-body-2" style="min-width: 180px">
                {{ criterion.name }}
                <span class="text-caption text-medium-emphasis">(w {{ criterion.weight }})</span>
              </span>
              <v-rating v-model="scores[criterion.id]" density="compact" hover :readonly="!can('suppliers:rate')" />
            </div>
            <v-btn
              v-can="'suppliers:rate'"
              size="small"
              color="primary"
              class="mt-2"
              :loading="busy"
              @click="saveRatings"
            >
              Save evaluation
            </v-btn>
          </v-window-item>

          <v-window-item value="documents">
            <input ref="documentInput" type="file" class="d-none" @change="onDocumentFile" />
            <div v-if="can('suppliers:edit')" class="d-flex align-center ga-2 mb-3">
              <v-select
                v-model="docTypeId"
                :items="documentTypes.filter((t) => t.active)"
                item-title="name"
                item-value="id"
                label="Document type"
                density="compact"
                hide-details
                clearable
                style="max-width: 220px"
              />
              <v-btn size="small" variant="tonal" prepend-icon="mdi-paperclip" :loading="busy" @click="documentInput?.click()">
                Upload document
              </v-btn>
            </div>
            <p v-if="documents.length === 0" class="text-body-2 text-medium-emphasis">No documents.</p>
            <v-list density="compact">
              <v-list-item v-for="doc in documents" :key="doc.id">
                <v-list-item-title>
                  {{ doc.fileName }}
                  <v-chip v-if="doc.docType" size="x-small" variant="tonal" class="ml-1">{{ doc.docType }}</v-chip>
                </v-list-item-title>
                <v-list-item-subtitle>
                  {{ (doc.fileSize / 1024).toFixed(1) }} KB · {{ doc.uploadedByEmail ?? 'system' }} · {{ formatDate(doc.createdAt) }}
                </v-list-item-subtitle>
                <template #append>
                  <v-btn icon="mdi-download" size="x-small" variant="text" @click="downloadDocument(doc)" />
                  <v-btn v-if="can('suppliers:edit')" icon="mdi-delete" size="x-small" variant="text" @click="deleteDocument(doc)" />
                </template>
              </v-list-item>
            </v-list>
          </v-window-item>

          <v-window-item value="history">
            <v-timeline density="compact" side="end" truncate-line="both">
              <v-timeline-item v-for="log in logs" :key="log.id" size="x-small">
                <div class="d-flex align-center flex-wrap">
                  <v-chip size="x-small" variant="tonal" class="mr-2">{{ log.action }}</v-chip>
                  <span class="text-caption text-medium-emphasis">
                    {{ formatDate(log.occurredAt) }}
                    <template v-if="log.actorEmail"> · {{ log.actorEmail }}</template>
                  </span>
                </div>
                <div class="text-body-2">{{ log.title }}</div>
              </v-timeline-item>
            </v-timeline>
          </v-window-item>
        </v-window>
      </v-card-text>

      <v-card-actions class="px-6 pb-4">
        <v-spacer />
        <v-btn variant="text" @click="open = false">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
