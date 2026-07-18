<script setup lang="ts">
import { ref, watch } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { duplicateRoleSchema, roleSchema } from '@/schemas/admin'
import { rolesApi } from '@/api/roles'
import { useApiError } from '@/composables/useApiError'
import PermissionMatrixDialog from '@/components/PermissionMatrixDialog.vue'
import type { PageQuery } from '@/types/api'
import type { Role } from '@/types/models'

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

const items = ref<Role[]>([])
const totalItems = ref(0)
const loading = ref(false)
const lastOptions = ref<TableOptions>({ page: 1, itemsPerPage: 10, sortBy: [] })

const headers = [
  { title: 'Name', key: 'name' },
  { title: 'Description', key: 'description', sortable: false },
  { title: 'Attributes', key: 'attributes', sortable: false },
  { title: 'Users', key: 'userCount', sortable: false, align: 'end' as const },
  { title: '', key: 'actions', sortable: false, align: 'end' as const },
]

async function loadItems(options: TableOptions) {
  lastOptions.value = options
  loading.value = true
  clearError()

  const sort = options.sortBy[0]
  const params: PageQuery = {
    page: options.page - 1, // Vuetify is 1-based; the API is 0-based.
    size: options.itemsPerPage,
    sort: sort ? `${sort.key},${sort.order ?? 'asc'}` : undefined,
  }

  try {
    const pageResult = await rolesApi.list(params)
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

// --- Create / edit dialog -------------------------------------------------
const formOpen = ref(false)
const editing = ref<Role | null>(null)
const saving = ref(false)
const { message: formError, set: setFormError, clear: clearFormError } = useApiError()

const {
  handleSubmit: handleFormSubmit,
  defineField: defineFormField,
  errors: formErrors,
  resetForm,
} = useForm({
  validationSchema: toTypedSchema(roleSchema),
  initialValues: { name: '', description: '' },
})

const [name, nameProps] = defineFormField('name')
const [description, descriptionProps] = defineFormField('description')

function openCreate() {
  editing.value = null
  clearFormError()
  resetForm({ values: { name: '', description: '' } })
  formOpen.value = true
}

function openEdit(role: Role) {
  editing.value = role
  clearFormError()
  resetForm({ values: { name: role.name, description: role.description ?? '' } })
  formOpen.value = true
}

const onFormSubmit = handleFormSubmit(async (values) => {
  saving.value = true
  clearFormError()
  try {
    const payload = { name: values.name, description: values.description || undefined }
    if (editing.value) {
      await rolesApi.update(editing.value.id, payload)
    } else {
      await rolesApi.create(payload)
    }
    formOpen.value = false
    reload()
  } catch (err) {
    setFormError(err)
  } finally {
    saving.value = false
  }
})

// --- Duplicate dialog -----------------------------------------------------
const duplicateTarget = ref<Role | null>(null)
const duplicating = ref(false)
const { message: duplicateError, set: setDuplicateError, clear: clearDuplicateError } = useApiError()

const {
  handleSubmit: handleDuplicateSubmit,
  defineField: defineDuplicateField,
  errors: duplicateErrors,
  resetForm: resetDuplicateForm,
} = useForm({
  validationSchema: toTypedSchema(duplicateRoleSchema),
  initialValues: { name: '' },
})

const [duplicateName, duplicateNameProps] = defineDuplicateField('name')

function openDuplicate(role: Role) {
  duplicateTarget.value = role
  clearDuplicateError()
  resetDuplicateForm({ values: { name: `${role.name} (copy)` } })
}

const onDuplicateSubmit = handleDuplicateSubmit(async (values) => {
  if (!duplicateTarget.value) return
  duplicating.value = true
  clearDuplicateError()
  try {
    await rolesApi.duplicate(duplicateTarget.value.id, { name: values.name })
    duplicateTarget.value = null
    reload()
  } catch (err) {
    setDuplicateError(err)
  } finally {
    duplicating.value = false
  }
})

// --- Permission matrix ----------------------------------------------------
const matrixOpen = ref(false)
const matrixRole = ref<Role | null>(null)

function openMatrix(role: Role) {
  matrixRole.value = role
  matrixOpen.value = true
}

// --- Delete confirmation --------------------------------------------------
const deleteTarget = ref<Role | null>(null)
const deleting = ref(false)

// System roles never reach the confirm dialog (the action is disabled), but
// guard anyway so a stale reference cannot trigger a doomed request.
watch(deleteTarget, (target) => {
  if (target?.isSystem) {
    deleteTarget.value = null
  }
})

async function confirmDelete() {
  if (!deleteTarget.value || deleteTarget.value.isSystem) return
  deleting.value = true
  try {
    await rolesApi.remove(deleteTarget.value.id)
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
      <h1 class="text-h4">Roles</h1>
      <v-spacer />
      <v-btn v-can="'roles:create'" color="primary" prepend-icon="mdi-plus" @click="openCreate">
        New role
      </v-btn>
    </div>

    <v-alert v-if="errorMessage" type="error" variant="tonal" density="compact" class="mb-4">
      {{ errorMessage }}
    </v-alert>

    <v-card rounded="lg" border flat>
      <v-data-table-server
        :headers="headers"
        :items="items"
        :items-length="totalItems"
        :loading="loading"
        :items-per-page="10"
        @update:options="loadItems"
      >
        <template #[`item.description`]="{ item }">
          <span class="text-medium-emphasis">{{ item.description ?? '—' }}</span>
        </template>
        <template #[`item.attributes`]="{ item }">
          <v-chip v-if="item.isSystem" size="small" variant="tonal" class="mr-1">System</v-chip>
          <v-chip
            v-if="item.isSuperAdmin"
            color="warning"
            size="small"
            variant="tonal"
            prepend-icon="mdi-shield-crown"
            class="mr-1"
          >
            Super admin
          </v-chip>
          <v-chip v-if="item.isDefault" color="info" size="small" variant="tonal">Default</v-chip>
        </template>
        <template #[`item.actions`]="{ item }">
          <v-btn
            v-can="'roles:edit'"
            icon="mdi-key-outline"
            size="small"
            variant="text"
            title="Permissions"
            @click="openMatrix(item)"
          />
          <v-btn
            v-can="'roles:create'"
            icon="mdi-content-copy"
            size="small"
            variant="text"
            title="Duplicate"
            @click="openDuplicate(item)"
          />
          <v-btn
            v-can="'roles:edit'"
            icon="mdi-pencil"
            size="small"
            variant="text"
            title="Edit"
            @click="openEdit(item)"
          />
          <v-btn
            v-can="'roles:delete'"
            icon="mdi-delete"
            size="small"
            variant="text"
            color="error"
            title="Delete"
            :disabled="item.isSystem"
            @click="deleteTarget = item"
          />
        </template>
      </v-data-table-server>
    </v-card>

    <!-- Create / edit -->
    <v-dialog v-model="formOpen" max-width="560">
      <v-card rounded="lg">
        <v-card-title class="text-h6 pt-4 px-6">
          {{ editing ? 'Edit role' : 'New role' }}
        </v-card-title>

        <v-card-text class="px-6">
          <v-alert v-if="formError" type="error" variant="tonal" density="compact" class="mb-4">
            {{ formError }}
          </v-alert>

          <v-form @submit.prevent="onFormSubmit">
            <v-text-field
              v-model="name"
              v-bind="nameProps"
              :error-messages="formErrors.name"
              label="Name"
              :disabled="editing?.isSystem ?? false"
              :hint="editing?.isSystem ? 'System role names cannot be changed' : undefined"
              :persistent-hint="editing?.isSystem ?? false"
            />
            <v-textarea
              v-model="description"
              v-bind="descriptionProps"
              :error-messages="formErrors.description"
              label="Description"
              rows="2"
              auto-grow
            />
          </v-form>
        </v-card-text>

        <v-card-actions class="px-6 pb-4">
          <v-spacer />
          <v-btn variant="text" @click="formOpen = false">Cancel</v-btn>
          <v-btn color="primary" :loading="saving" @click="onFormSubmit">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Duplicate -->
    <v-dialog
      :model-value="!!duplicateTarget"
      max-width="420"
      @update:model-value="duplicateTarget = null"
    >
      <v-card rounded="lg">
        <v-card-title class="text-h6 pt-4 px-6">Duplicate role</v-card-title>

        <v-card-text class="px-6">
          <v-alert v-if="duplicateError" type="error" variant="tonal" density="compact" class="mb-4">
            {{ duplicateError }}
          </v-alert>

          <p class="text-body-2 text-medium-emphasis mb-4">
            Creates a copy of <strong>{{ duplicateTarget?.name }}</strong> with the same
            permission set.
          </p>

          <v-form @submit.prevent="onDuplicateSubmit">
            <v-text-field
              v-model="duplicateName"
              v-bind="duplicateNameProps"
              :error-messages="duplicateErrors.name"
              label="New role name"
              autofocus
            />
          </v-form>
        </v-card-text>

        <v-card-actions class="px-6 pb-4">
          <v-spacer />
          <v-btn variant="text" @click="duplicateTarget = null">Cancel</v-btn>
          <v-btn color="primary" :loading="duplicating" @click="onDuplicateSubmit">Duplicate</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Permission matrix -->
    <PermissionMatrixDialog v-model="matrixOpen" :role="matrixRole" @saved="reload" />

    <!-- Delete confirmation -->
    <v-dialog :model-value="!!deleteTarget" max-width="420" @update:model-value="deleteTarget = null">
      <v-card rounded="lg">
        <v-card-title class="text-h6">Delete role</v-card-title>
        <v-card-text>
          Delete <strong>{{ deleteTarget?.name }}</strong>? This cannot be undone.
          <v-alert
            v-if="(deleteTarget?.userCount ?? 0) > 0"
            type="warning"
            variant="tonal"
            density="compact"
            class="mt-3"
          >
            This role is still assigned to {{ deleteTarget?.userCount }}
            {{ deleteTarget?.userCount === 1 ? 'user' : 'users' }} — deletion will be rejected
            until they are moved to another role.
          </v-alert>
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
