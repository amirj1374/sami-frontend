<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { moduleSchema } from '@/schemas/admin'
import { modulesApi } from '@/api/modules'
import { useApiError } from '@/composables/useApiError'
import type { PageQuery } from '@/types/api'
import type { AppModule } from '@/types/models'

const { t } = useI18n()
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

const items = ref<AppModule[]>([])
const totalItems = ref(0)
const loading = ref(false)
const lastOptions = ref<TableOptions>({ page: 1, itemsPerPage: 10, sortBy: [] })

const headers = [
  { title: t('modules.order'), key: 'displayOrder', align: 'end' as const },
  { title: t('modules.name'), key: 'name' },
  { title: t('modules.code'), key: 'code' },
  { title: t('modules.path'), key: 'path', sortable: false },
  { title: t('modules.permissions'), key: 'permissionCount', sortable: false, align: 'end' as const },
  { title: t('modules.enabled'), key: 'enabled', sortable: false },
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
    // The backend defaults to displayOrder,asc when no sort is given.
    sort: sort ? `${sort.key},${sort.order ?? 'asc'}` : undefined,
  }

  try {
    const pageResult = await modulesApi.list(params)
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

// --- Enable / disable toggle ----------------------------------------------
const togglingId = ref<number | null>(null)

async function toggleEnabled(module: AppModule, enabled: boolean) {
  togglingId.value = module.id
  clearError()
  try {
    await modulesApi.updateStatus(module.id, { enabled })
  } catch (err) {
    setError(err)
  } finally {
    togglingId.value = null
    reload()
  }
}

// --- Create / edit dialog -------------------------------------------------
const formOpen = ref(false)
const editing = ref<AppModule | null>(null)
const saving = ref(false)
const { message: formError, set: setFormError, clear: clearFormError } = useApiError()

const { handleSubmit, defineField, errors, resetForm } = useForm({
  validationSchema: toTypedSchema(moduleSchema(t)),
  initialValues: {
    code: '',
    name: '',
    description: '',
    icon: '',
    path: '',
    displayOrder: 10,
    enabled: true,
    createDefaultPermissions: true,
  },
})

const [code, codeProps] = defineField('code')
const [name, nameProps] = defineField('name')
const [description, descriptionProps] = defineField('description')
const [icon, iconProps] = defineField('icon')
const [path, pathProps] = defineField('path')
const [displayOrder, displayOrderProps] = defineField('displayOrder')
const [enabled, enabledProps] = defineField('enabled')
const [createDefaultPermissions, createDefaultPermissionsProps] =
  defineField('createDefaultPermissions')

/** Live preview shown while the icon field holds a plausible mdi name. */
const iconPreview = computed(() =>
  typeof icon.value === 'string' && icon.value.startsWith('mdi-') ? icon.value : 'mdi-help-circle-outline',
)

function openCreate() {
  editing.value = null
  clearFormError()
  resetForm({
    values: {
      code: '',
      name: '',
      description: '',
      icon: '',
      path: '',
      displayOrder: 10,
      enabled: true,
      createDefaultPermissions: true,
    },
  })
  formOpen.value = true
}

function openEdit(module: AppModule) {
  editing.value = module
  clearFormError()
  // The code field is not rendered when editing (it is immutable) but stays
  // seeded so the shared schema still validates.
  resetForm({
    values: {
      code: module.code,
      name: module.name,
      description: module.description ?? '',
      icon: module.icon,
      path: module.path,
      displayOrder: module.displayOrder,
      enabled: module.enabled,
      createDefaultPermissions: false,
    },
  })
  formOpen.value = true
}

const onSubmit = handleSubmit(async (values) => {
  saving.value = true
  clearFormError()
  try {
    if (editing.value) {
      await modulesApi.update(editing.value.id, {
        name: values.name,
        description: values.description || undefined,
        icon: values.icon,
        path: values.path,
        displayOrder: values.displayOrder,
      })
    } else {
      await modulesApi.create({
        code: values.code,
        name: values.name,
        description: values.description || undefined,
        icon: values.icon,
        path: values.path,
        displayOrder: values.displayOrder,
        enabled: values.enabled,
        createDefaultPermissions: values.createDefaultPermissions,
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
const deleteTarget = ref<AppModule | null>(null)
const deleting = ref(false)

async function confirmDelete() {
  if (!deleteTarget.value || deleteTarget.value.isSystem) return
  deleting.value = true
  try {
    await modulesApi.remove(deleteTarget.value.id)
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
      <h1 class="text-h4">{{ t('modules.title') }}</h1>
      <v-spacer />
      <v-btn v-can="'modules:create'" color="primary" prepend-icon="mdi-plus" @click="openCreate">
        {{ t('modules.new') }}
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
        <template #[`item.name`]="{ item }">
          <v-icon :icon="item.icon" size="small" class="mr-2" />
          {{ item.name }}
          <v-chip v-if="item.isSystem" size="small" variant="tonal" class="ml-2">{{ t('modules.system') }}</v-chip>
        </template>
        <template #[`item.code`]="{ item }">
          <code>{{ item.code }}</code>
        </template>
        <template #[`item.path`]="{ item }">
          <code>{{ item.path }}</code>
        </template>
        <template #[`item.enabled`]="{ item }">
          <v-switch
            v-can.disable="'modules:edit'"
            :model-value="item.enabled"
            :disabled="item.isSystem"
            :loading="togglingId === item.id"
            color="primary"
            density="compact"
            hide-details
            inset
            @update:model-value="toggleEnabled(item, $event === true)"
          />
        </template>
        <template #[`item.actions`]="{ item }">
          <v-btn
            v-can="'modules:edit'"
            icon="mdi-pencil"
            size="small"
            variant="text"
            :title="t('common.edit')"
            @click="openEdit(item)"
          />
          <v-btn
            v-can="'modules:delete'"
            icon="mdi-delete"
            size="small"
            variant="text"
            color="error"
            :title="t('common.delete')"
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
          {{ editing ? t('modules.edit') : t('modules.new') }}
        </v-card-title>

        <v-card-text class="px-6">
          <v-alert v-if="formError" type="error" variant="tonal" density="compact" class="mb-4">
            {{ formError }}
          </v-alert>

          <v-form @submit.prevent="onSubmit">
            <v-text-field
              v-if="!editing"
              v-model="code"
              v-bind="codeProps"
              :error-messages="errors.code"
              :label="t('modules.code')"
              :hint="t('modules.codeHint')"
              persistent-hint
            />
            <v-text-field
              v-model="name"
              v-bind="nameProps"
              :error-messages="errors.name"
              :label="t('modules.name')"
            />
            <v-textarea
              v-model="description"
              v-bind="descriptionProps"
              :error-messages="errors.description"
              :label="t('modules.description')"
              rows="2"
              auto-grow
            />
            <v-text-field
              v-model="icon"
              v-bind="iconProps"
              :error-messages="errors.icon"
              :label="t('modules.icon')"
              :prepend-inner-icon="iconPreview"
              :hint="t('modules.iconHint')"
              persistent-hint
            />
            <v-row>
              <v-col cols="8">
                <v-text-field
                  v-model="path"
                  v-bind="pathProps"
                  :error-messages="errors.path"
                  :label="t('modules.path')"
                  :hint="t('modules.pathHint')"
                  persistent-hint
                />
              </v-col>
              <v-col cols="4">
                <v-text-field
                  v-model="displayOrder"
                  v-bind="displayOrderProps"
                  :error-messages="errors.displayOrder"
                  :label="t('modules.order')"
                  type="number"
                />
              </v-col>
            </v-row>
            <template v-if="!editing">
              <v-switch
                v-model="enabled"
                v-bind="enabledProps"
                :label="t('modules.enabled')"
                color="primary"
                inset
                hide-details
              />
              <v-checkbox
                v-model="createDefaultPermissions"
                v-bind="createDefaultPermissionsProps"
                :label="t('modules.createPermissions')"
                hide-details
              />
            </template>
          </v-form>
        </v-card-text>

        <v-card-actions class="px-6 pb-4">
          <v-spacer />
          <v-btn variant="text" @click="formOpen = false">{{ t('common.cancel') }}</v-btn>
          <v-btn color="primary" :loading="saving" @click="onSubmit">{{ t('common.save') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete confirmation -->
    <v-dialog :model-value="!!deleteTarget" max-width="420" @update:model-value="deleteTarget = null">
      <v-card rounded="lg">
        <v-card-title class="text-h6">{{ t('modules.deleteTitle') }}</v-card-title>
        <v-card-text>
          <i18n-t keypath="modules.deleteConfirm" tag="span">
            <template #name>
              <strong>{{ deleteTarget?.name }}</strong>
            </template>
          </i18n-t>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="deleteTarget = null">{{ t('common.cancel') }}</v-btn>
          <v-btn color="error" :loading="deleting" @click="confirmDelete">{{ t('common.delete') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
