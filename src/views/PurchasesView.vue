<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { purchasesApi, purchasingConfigApi, type PurchaseListParams } from '@/api/purchases'
import { usePermission } from '@/composables/usePermission'
import { useApiError } from '@/composables/useApiError'
import PurchaseFormDialog from '@/components/PurchaseFormDialog.vue'
import PurchaseDetailDialog from '@/components/PurchaseDetailDialog.vue'
import type {
  PurCancelReason,
  PurIdentifierType,
  PurStatus,
  PurType,
  PurWarehouse,
  PurchaseDetail,
  PurchaseRow,
} from '@/types/models'

const { can } = usePermission()
const { message: errorMessage, set: setError, clear: clearError } = useApiError()

// --- Reference data ---------------------------------------------------------
const statuses = ref<PurStatus[]>([])
const types = ref<PurType[]>([])
const warehouses = ref<PurWarehouse[]>([])
const cancelReasons = ref<PurCancelReason[]>([])
const identifierTypes = ref<PurIdentifierType[]>([])

onMounted(async () => {
  try {
    ;[statuses.value, types.value, warehouses.value, cancelReasons.value, identifierTypes.value] =
      await Promise.all([
        purchasingConfigApi.statuses(),
        purchasingConfigApi.types(),
        purchasingConfigApi.warehouses(),
        purchasingConfigApi.cancelReasons(),
        purchasingConfigApi.identifierTypes(),
      ])
  } catch (err) {
    setError(err)
  }
})

// --- Table state ------------------------------------------------------------
interface SortItem {
  key: string
  order?: 'asc' | 'desc'
}
interface TableOptions {
  page: number
  itemsPerPage: number
  sortBy: SortItem[]
}

const items = ref<PurchaseRow[]>([])
const totalItems = ref(0)
const loading = ref(false)
const lastOptions = ref<TableOptions>({ page: 1, itemsPerPage: 10, sortBy: [] })

const headers = [
  { title: 'Number', key: 'purchaseNumber' },
  { title: 'Supplier', key: 'supplier', sortable: false },
  { title: 'Type', key: 'type', sortable: false },
  { title: 'Status', key: 'status', sortable: false },
  { title: 'Total', key: 'totalAmount', align: 'end' as const },
  { title: 'Created', key: 'createdAt' },
  { title: '', key: 'actions', sortable: false, align: 'end' as const },
]

// --- Filters ----------------------------------------------------------------
const searchFilter = ref('')
const statusFilter = ref<number | null>(null)
const typeFilter = ref<number | null>(null)
const warehouseFilter = ref<number | null>(null)
const fromFilter = ref('')
const toFilter = ref('')

const statusItems = computed(() => [
  { title: 'All statuses', value: null as number | null },
  ...statuses.value.map((s) => ({ title: s.name, value: s.id as number | null })),
])
const typeItems = computed(() => [
  { title: 'All types', value: null as number | null },
  ...types.value.map((t) => ({ title: t.name, value: t.id as number | null })),
])
const warehouseItems = computed(() => [
  { title: 'All warehouses', value: null as number | null },
  ...warehouses.value.map((w) => ({ title: w.name, value: w.id as number | null })),
])

async function loadItems(options: TableOptions) {
  lastOptions.value = options
  loading.value = true
  clearError()

  const sort = options.sortBy[0]
  const params: PurchaseListParams = {
    page: options.page - 1,
    size: options.itemsPerPage,
    sort: sort ? `${sort.key},${sort.order ?? 'asc'}` : undefined,
    search: searchFilter.value || undefined,
    statusId: statusFilter.value ?? undefined,
    typeId: typeFilter.value ?? undefined,
    warehouseId: warehouseFilter.value ?? undefined,
    createdFrom: fromFilter.value || undefined,
    createdTo: toFilter.value || undefined,
  }

  try {
    const pageResult = await purchasesApi.list(params)
    items.value = pageResult.content
    totalItems.value = pageResult.totalElements
  } catch (err) {
    setError(err)
  } finally {
    loading.value = false
  }
}

function refresh() {
  void loadItems(lastOptions.value)
}

const reload = useDebounceFn(() => {
  void loadItems({ ...lastOptions.value, page: 1 })
}, 300)
watch([searchFilter, statusFilter, typeFilter, warehouseFilter, fromFilter, toFilter], reload)

// --- Dialogs ----------------------------------------------------------------
const formOpen = ref(false)
const editingDetail = ref<PurchaseDetail | null>(null)
const detailOpen = ref(false)
const detailId = ref<number | null>(null)
const deleteTarget = ref<PurchaseRow | null>(null)
const deleting = ref(false)

function openCreate() {
  editingDetail.value = null
  formOpen.value = true
}

async function openEdit(row: PurchaseRow) {
  clearError()
  try {
    editingDetail.value = await purchasesApi.get(row.id)
    formOpen.value = true
  } catch (err) {
    setError(err)
  }
}

function openDetail(row: PurchaseRow) {
  detailId.value = row.id
  detailOpen.value = true
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await purchasesApi.deleteDraft(deleteTarget.value.id)
    deleteTarget.value = null
    refresh()
  } catch (err) {
    setError(err)
  } finally {
    deleting.value = false
  }
}

function statusColor(status: PurStatus): string {
  if (status.isCompletedState) return 'success'
  if (status.isCancelledState || status.isRejectedState) return 'error'
  if (status.isPendingState) return 'warning'
  if (status.isDraftState) return 'default'
  return 'info'
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(value))
}
</script>

<template>
  <div>
    <div class="d-flex align-center mb-4">
      <h1 class="text-h4">Purchasing</h1>
      <v-spacer />
      <v-btn v-can="'purchasing:create'" color="primary" prepend-icon="mdi-plus" @click="openCreate">
        New purchase
      </v-btn>
    </div>

    <v-alert v-if="errorMessage" type="error" variant="tonal" density="compact" class="mb-4">
      {{ errorMessage }}
    </v-alert>

    <v-card rounded="lg" border flat>
      <v-card-text>
        <v-row dense align="center">
          <v-col cols="12" sm="3">
            <v-text-field
              v-model="searchFilter"
              label="Search number, supplier, notes…"
              prepend-inner-icon="mdi-magnify"
              clearable
              hide-details
              density="comfortable"
            />
          </v-col>
          <v-col cols="6" sm="2">
            <v-select v-model="statusFilter" label="Status" :items="statusItems" hide-details density="comfortable" />
          </v-col>
          <v-col cols="6" sm="2">
            <v-select v-model="typeFilter" label="Type" :items="typeItems" hide-details density="comfortable" />
          </v-col>
          <v-col cols="6" sm="2">
            <v-select v-model="warehouseFilter" label="Warehouse" :items="warehouseItems" hide-details density="comfortable" />
          </v-col>
          <v-col cols="6" sm="2">
            <v-text-field v-model="fromFilter" label="From" type="date" hide-details density="comfortable" clearable />
          </v-col>
          <v-col cols="6" sm="2">
            <v-text-field v-model="toFilter" label="To" type="date" hide-details density="comfortable" clearable />
          </v-col>
        </v-row>
      </v-card-text>

      <v-data-table-server
        :headers="headers"
        :items="items"
        :items-length="totalItems"
        :loading="loading"
        :items-per-page="10"
        item-value="id"
        @update:options="loadItems"
      >
        <template #[`item.purchaseNumber`]="{ item }">
          <a class="text-primary cursor-pointer" @click="openDetail(item)">
            {{ item.purchaseNumber }}
          </a>
        </template>
        <template #[`item.supplier`]="{ item }">
          {{ item.supplierName }}
          <div class="text-caption text-medium-emphasis">{{ item.supplierCode }}</div>
        </template>
        <template #[`item.type`]="{ item }">
          <v-chip size="small" variant="tonal">{{ item.type.name }}</v-chip>
        </template>
        <template #[`item.status`]="{ item }">
          <v-chip :color="statusColor(item.status)" size="small" variant="tonal">
            {{ item.status.name }}
          </v-chip>
        </template>
        <template #[`item.totalAmount`]="{ item }">{{ item.totalAmount.toFixed(2) }}</template>
        <template #[`item.createdAt`]="{ item }">{{ formatDate(item.createdAt) }}</template>
        <template #[`item.actions`]="{ item }">
          <v-btn icon="mdi-eye" size="small" variant="text" @click="openDetail(item)" />
          <v-btn
            v-if="item.status.allowsEditing && can('purchasing:edit')"
            icon="mdi-pencil"
            size="small"
            variant="text"
            @click="openEdit(item)"
          />
          <v-btn
            v-if="item.status.isDraftState && can('purchasing:delete')"
            icon="mdi-delete"
            size="small"
            variant="text"
            color="error"
            @click="deleteTarget = item"
          />
        </template>
      </v-data-table-server>
    </v-card>

    <PurchaseFormDialog
      v-model="formOpen"
      :purchase="editingDetail"
      :types="types"
      :warehouses="warehouses"
      @saved="refresh"
    />

    <PurchaseDetailDialog
      v-model="detailOpen"
      :purchase-id="detailId"
      :cancel-reasons="cancelReasons"
      :identifier-types="identifierTypes"
      @changed="refresh"
    />

    <!-- Delete draft confirmation -->
    <v-dialog :model-value="!!deleteTarget" max-width="420" @update:model-value="deleteTarget = null">
      <v-card rounded="lg">
        <v-card-title class="text-h6">Delete draft</v-card-title>
        <v-card-text>
          Delete draft <strong>{{ deleteTarget?.purchaseNumber }}</strong>? Drafts affect nothing
          and can be safely removed.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="deleteTarget = null">Cancel</v-btn>
          <v-btn color="error" :loading="deleting" @click="confirmDelete">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
