<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { permissionSchema } from '@/schemas/admin'
import { permissionsApi, type PermissionListParams } from '@/api/permissions'
import { useApiError } from '@/composables/useApiError'
import type { ModulePermissionsGroup, Permission } from '@/types/models'

const { message: errorMessage, set: setError, clear: clearError } = useApiError()

// --- Module options -------------------------------------------------------
// Sourced from the grouped endpoint (permissions:view suffices) rather than
// the modules list (which would require modules:view on top).
const groups = ref<ModulePermissionsGroup[]>([])
const moduleOptions = computed(() =>
  groups.value.map((group) => ({ title: group.moduleName, value: group.moduleId })),
)
const moduleCodeById = computed(
  () => new Map(groups.value.map((group) => [group.moduleId, group.moduleCode])),
)

onMounted(async () => {
  try {
    groups.value = await permissionsApi.grouped()
  } catch (err) {
    setError(err)
  }
})

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

const items = ref<Permission[]>([])
const totalItems = ref(0)
const loading = ref(false)
const lastOptions = ref<TableOptions>({ page: 1, itemsPerPage: 10, sortBy: [] })

const headers = [
  { title: 'Code', key: 'code' },
  { title: 'Name', key: 'name' },
  { title: 'Module', key: 'module', sortable: false },
  { title: 'Description', key: 'description', sortable: false },
  { title: 'System', key: 'isSystem', sortable: false },
  { title: '', key: 'actions', sortable: false, align: 'end' as const },
]

// --- Filters --------------------------------------------------------------
const moduleFilter = ref<number | null>(null)

async function loadItems(options: TableOptions) {
  lastOptions.value = options
  loading.value = true
  clearError()

  const sort = options.sortBy[0]
  const params: PermissionListParams = {
    page: options.page - 1, // Vuetify is 1-based; the API is 0-based.
    size: options.itemsPerPage,
    sort: sort ? `${sort.key},${sort.order ?? 'asc'}` : undefined,
    moduleId: moduleFilter.value ?? undefined,
  }

  try {
    const pageResult = await permissionsApi.list(params)
    items.value = pageResult.content
    totalItems.value = pageResult.totalElements
  } catch (err) {
    setError(err)
  } finally {
    loading.value = false
  }
}

function reload() {
  loadItems(lastOptions.value)
}

// Reload (reset to page 1) when the module filter changes.
watch(moduleFilter, () => {
  loadItems({ ...lastOptions.value, page: 1 })
})

// --- Create / edit dialog -------------------------------------------------
const formOpen = ref(false)
const editing = ref<Permission | null>(null)
const saving = ref(false)
const { message: formError, set: setFormError, clear: clearFormError } = useApiError()

const { handleSubmit, defineField, errors, resetForm } = useForm({
  validationSchema: toTypedSchema(permissionSchema),
  initialValues: { action: '', name: '', description: '' },
})

const [moduleId, moduleIdProps] = defineField('moduleId')
const [action, actionProps] = defineField('action')
const [name, nameProps] = defineField('name')
const [description, descriptionProps] = defineField('description')

/** Live `module:action` preview of the resulting permission code. */
const codePreview = computed(() => {
  if (editing.value) {
    return editing.value.code
  }
  const moduleCode =
    (typeof moduleId.value === 'number' ? moduleCodeById.value.get(moduleId.value) : undefined) ??
    'module'
  return `${moduleCode}:${action.value || 'action'}`
})

function openCreate() {
  editing.value = null
  clearFormError()
  resetForm({ values: { action: '', name: '', description: '' } })
  formOpen.value = true
}

function openEdit(permission: Permission) {
  editing.value = permission
  clearFormError()
  // Module and action are immutable: rendered disabled for context, seeded so
  // the shared schema still validates, and excluded from the update payload.
  resetForm({
    values: {
      moduleId: permission.moduleId,
      action: permission.action,
      name: permission.name,
      description: permission.description ?? '',
    },
  })
  formOpen.value = true
}

const onSubmit = handleSubmit(async (values) => {
  saving.value = true
  clearFormError()
  try {
    if (editing.value) {
      await permissionsApi.update(editing.value.id, {
        name: values.name,
        description: values.description || undefined,
      })
    } else {
      await permissionsApi.create({
        moduleId: values.moduleId,
        action: values.action,
        name: values.name,
        description: values.description || undefined,
      })
    }
    formOpen.value = false
    reload()
  } catch (err) {
    setFormError(err)
  } finally {
    saving.value = false
  }
})

// --- Delete confirmation --------------------------------------------------
const deleteTarget = ref<Permission | null>(null)
const deleting = ref(false)

async function confirmDelete() {
  if (!deleteTarget.value || deleteTarget.value.isSystem) return
  deleting.value = true
  try {
    await permissionsApi.remove(deleteTarget.value.id)
    deleteTarget.value = null
    reload()
  } catch (err) {
    setError(err)
    deleteTarget.value = null
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div>
    <div class="d-flex align-center mb-4">
      <h1 class="text-h4">Permissions</h1>
      <v-spacer />
      <v-btn
        v-can="'permissions:create'"
        color="primary"
        prepend-icon="mdi-plus"
        @click="openCreate"
      >
        New permission
      </v-btn>
    </div>

    <v-alert v-if="errorMessage" type="error" variant="tonal" density="compact" class="mb-4">
      {{ errorMessage }}
    </v-alert>

    <v-card rounded="lg" border flat>
      <v-card-text>
        <v-row dense>
          <v-col cols="12" sm="6">
            <v-select
              v-model="moduleFilter"
              label="Module"
              :items="[{ title: 'All modules', value: null }, ...moduleOptions]"
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
        <template #[`item.code`]="{ item }">
          <code>{{ item.code }}</code>
        </template>
        <template #[`item.module`]="{ item }">{{ item.moduleName }}</template>
        <template #[`item.description`]="{ item }">
          <span class="text-medium-emphasis">{{ item.description ?? '—' }}</span>
        </template>
        <template #[`item.isSystem`]="{ item }">
          <v-chip
            v-if="item.isSystem"
            size="small"
            variant="tonal"
            prepend-icon="mdi-lock-outline"
          >
            System
          </v-chip>
        </template>
        <template #[`item.actions`]="{ item }">
          <v-btn
            v-can="'permissions:edit'"
            icon="mdi-pencil"
            size="small"
            variant="text"
            title="Edit"
            @click="openEdit(item)"
          />
          <v-btn
            v-if="!item.isSystem"
            v-can="'permissions:delete'"
            icon="mdi-delete"
            size="small"
            variant="text"
            color="error"
            title="Delete"
            @click="deleteTarget = item"
          />
        </template>
      </v-data-table-server>
    </v-card>

    <!-- Create / edit -->
    <v-dialog v-model="formOpen" max-width="560">
      <v-card rounded="lg">
        <v-card-title class="text-h6 pt-4 px-6">
          {{ editing ? 'Edit permission' : 'New permission' }}
        </v-card-title>

        <v-card-text class="px-6">
          <v-alert v-if="formError" type="error" variant="tonal" density="compact" class="mb-4">
            {{ formError }}
          </v-alert>

          <v-form @submit.prevent="onSubmit">
            <v-select
              v-model="moduleId"
              v-bind="moduleIdProps"
              :error-messages="errors.moduleId"
              label="Module"
              :items="moduleOptions"
              :disabled="!!editing"
            />
            <v-text-field
              v-model="action"
              v-bind="actionProps"
              :error-messages="errors.action"
              label="Action"
              :disabled="!!editing"
              :hint="editing ? 'The action cannot be changed after creation' : 'Lowercase slug, e.g. approve'"
              persistent-hint
            />
            <v-text-field
              v-model="name"
              v-bind="nameProps"
              :error-messages="errors.name"
              label="Name"
            />
            <v-textarea
              v-model="description"
              v-bind="descriptionProps"
              :error-messages="errors.description"
              label="Description"
              rows="2"
              auto-grow
            />
            <div class="text-body-2 text-medium-emphasis mt-1">
              Code: <code>{{ codePreview }}</code>
            </div>
          </v-form>
        </v-card-text>

        <v-card-actions class="px-6 pb-4">
          <v-spacer />
          <v-btn variant="text" @click="formOpen = false">Cancel</v-btn>
          <v-btn color="primary" :loading="saving" @click="onSubmit">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete confirmation -->
    <v-dialog :model-value="!!deleteTarget" max-width="420" @update:model-value="deleteTarget = null">
      <v-card rounded="lg">
        <v-card-title class="text-h6">Delete permission</v-card-title>
        <v-card-text>
          Delete <strong><code>{{ deleteTarget?.code }}</code></strong
          >? It is removed from every role that holds it. This cannot be undone.
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
