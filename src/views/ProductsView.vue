<script setup lang="ts">
import { ref, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { productsApi, type ProductListParams } from '@/api/products'
import { usePermission } from '@/composables/usePermission'
import { useApiError } from '@/composables/useApiError'
import ProductFormDialog from '@/components/ProductFormDialog.vue'
import type { Product } from '@/types/models'

const { can } = usePermission()
const { message: errorMessage, set: setError, clear: clearError } = useApiError()

// --- Table state ----------------------------------------------------------
interface SortItem {
  key: string
  order?: 'asc' | 'desc'
}
interface TableOptions {
  page: number
  itemsPerPage: number
  sortBy: SortItem[]
}

const items = ref<Product[]>([])
const totalItems = ref(0)
const loading = ref(false)
const lastOptions = ref<TableOptions>({ page: 1, itemsPerPage: 10, sortBy: [] })

const headers = [
  { title: 'Name', key: 'name' },
  { title: 'SKU', key: 'sku' },
  { title: 'Price', key: 'price', align: 'end' as const },
  { title: 'Stock', key: 'stockQuantity', align: 'end' as const },
  { title: 'Active', key: 'active' },
  { title: '', key: 'actions', sortable: false, align: 'end' as const },
]

// --- Filters --------------------------------------------------------------
const nameFilter = ref('')
const activeFilter = ref<boolean | null>(null)

async function loadItems(options: TableOptions) {
  lastOptions.value = options
  loading.value = true
  clearError()

  const sort = options.sortBy[0]
  const params: ProductListParams = {
    page: options.page - 1, // Vuetify is 1-based; the API is 0-based.
    size: options.itemsPerPage,
    sort: sort ? `${sort.key},${sort.order ?? 'asc'}` : undefined,
    name: nameFilter.value || undefined,
    active: activeFilter.value ?? undefined,
  }

  try {
    const pageResult = await productsApi.list(params)
    items.value = pageResult.content
    totalItems.value = pageResult.totalElements
  } catch (err) {
    setError(err)
  } finally {
    loading.value = false
  }
}

// Reload (reset to page 1) when filters change; debounce the text input.
const reload = useDebounceFn(() => {
  loadItems({ ...lastOptions.value, page: 1 })
}, 300)
watch([nameFilter, activeFilter], reload)

// --- Create / edit dialog -------------------------------------------------
const dialogOpen = ref(false)
const editing = ref<Product | null>(null)

function openCreate() {
  editing.value = null
  dialogOpen.value = true
}
function openEdit(product: Product) {
  editing.value = product
  dialogOpen.value = true
}
function onSaved() {
  loadItems(lastOptions.value)
}

// --- Delete confirmation --------------------------------------------------
const deleteTarget = ref<Product | null>(null)
const deleting = ref(false)

async function confirmDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await productsApi.remove(deleteTarget.value.id)
    deleteTarget.value = null
    loadItems(lastOptions.value)
  } catch (err) {
    setError(err)
  } finally {
    deleting.value = false
  }
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}
</script>

<template>
  <div>
    <div class="d-flex align-center mb-4">
      <h1 class="text-h4">Products</h1>
      <v-spacer />
      <v-btn v-if="can('products:create')" color="primary" prepend-icon="mdi-plus" @click="openCreate">
        New product
      </v-btn>
    </div>

    <v-alert v-if="errorMessage" type="error" variant="tonal" density="compact" class="mb-4">
      {{ errorMessage }}
    </v-alert>

    <v-card rounded="lg" border flat>
      <v-card-text>
        <v-row dense>
          <v-col cols="12" sm="6">
            <v-text-field
              v-model="nameFilter"
              label="Search by name"
              prepend-inner-icon="mdi-magnify"
              clearable
              hide-details
              density="comfortable"
            />
          </v-col>
          <v-col cols="12" sm="6">
            <v-select
              v-model="activeFilter"
              label="Status"
              :items="[
                { title: 'All', value: null },
                { title: 'Active', value: true },
                { title: 'Inactive', value: false },
              ]"
              hide-details
              density="comfortable"
            />
          </v-col>
        </v-row>
      </v-card-text>

      <v-data-table-server
        :headers="headers"
        :items="items"
        :items-length="totalItems"
        :loading="loading"
        :items-per-page="10"
        @update:options="loadItems"
      >
        <template #[`item.price`]="{ item }">{{ formatPrice(item.price) }}</template>
        <template #[`item.active`]="{ item }">
          <v-chip :color="item.active ? 'success' : 'default'" size="small" variant="tonal">
            {{ item.active ? 'Active' : 'Inactive' }}
          </v-chip>
        </template>
        <template #[`item.actions`]="{ item }">
          <v-btn
            v-if="can('products:edit')"
            icon="mdi-pencil"
            size="small"
            variant="text"
            @click="openEdit(item)"
          />
          <v-btn
            v-if="can('products:delete')"
            icon="mdi-delete"
            size="small"
            variant="text"
            color="error"
            @click="deleteTarget = item"
          />
        </template>
      </v-data-table-server>
    </v-card>

    <ProductFormDialog v-model="dialogOpen" :product="editing" @saved="onSaved" />

    <v-dialog :model-value="!!deleteTarget" max-width="420" @update:model-value="deleteTarget = null">
      <v-card rounded="lg">
        <v-card-title class="text-h6">Delete product</v-card-title>
        <v-card-text>
          Delete <strong>{{ deleteTarget?.name }}</strong>? This cannot be undone.
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
