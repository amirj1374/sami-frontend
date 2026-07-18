<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { customersApi } from '@/api/customers'
import { useApiError } from '@/composables/useApiError'
import type {
  CustomerAddress,
  CustomerContact,
  CustomerDetail,
  CustomerPayload,
  CustomerSource,
  CustomerStatus,
  CustomerTag,
  CustomerType,
  DuplicateMatch,
  PreferenceDefinition,
} from '@/types/models'

/**
 * Create/edit customer dialog: identity, multi-value contacts and addresses
 * (one default each), tags, type/status/source. Before saving, the candidate is
 * checked against the configurable duplicate rules; matches are shown for
 * explicit confirmation ("save anyway") which re-submits with the override flag.
 */
const props = defineProps<{
  modelValue: boolean
  customer: CustomerDetail | null
  types: CustomerType[]
  statuses: CustomerStatus[]
  sources: CustomerSource[]
  tags: CustomerTag[]
  preferenceDefs: PreferenceDefinition[]
}>()

const emit = defineEmits<{ 'update:modelValue': [boolean]; saved: [] }>()

const open = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})
const isEdit = computed(() => props.customer !== null)
const tab = ref<'identity' | 'contacts' | 'addresses' | 'preferences'>('identity')
const saving = ref(false)
const { message: formError, set: setFormError, clear: clearFormError } = useApiError()

const selectableStatuses = computed(() =>
  props.statuses.filter((s) => !s.isArchivedState && !s.isDeletedState),
)
const genderItems = ['male', 'female', 'other', 'unspecified']

// --- Form state (plain reactive; server validates lengths/rules too) --------
interface FormState {
  displayName: string
  firstName: string
  lastName: string
  nationalCode: string
  passportNumber: string
  birthDate: string
  gender: string | null
  occupation: string
  companyName: string
  taxNumber: string
  typeId: number | null
  statusId: number | null
  sourceId: number | null
  tagIds: number[]
}

const form = reactive<FormState>(emptyForm())
const contacts = ref<Omit<CustomerContact, 'id'>[]>([])
const addresses = ref<Omit<CustomerAddress, 'id'>[]>([])
const preferences = ref<Record<string, unknown>>({})
const displayNameError = ref('')
const typeError = ref('')

function emptyForm(): FormState {
  return {
    displayName: '',
    firstName: '',
    lastName: '',
    nationalCode: '',
    passportNumber: '',
    birthDate: '',
    gender: null,
    occupation: '',
    companyName: '',
    taxNumber: '',
    typeId: null,
    statusId: null,
    sourceId: null,
    tagIds: [],
  }
}

watch(open, (isOpen) => {
  if (!isOpen) return
  clearFormError()
  duplicates.value = null
  displayNameError.value = ''
  typeError.value = ''
  tab.value = 'identity'
  const d = props.customer
  Object.assign(form, emptyForm(), d
    ? {
        displayName: d.customer.displayName,
        firstName: d.customer.firstName ?? '',
        lastName: d.customer.lastName ?? '',
        nationalCode: d.nationalCode ?? '',
        passportNumber: d.passportNumber ?? '',
        birthDate: d.birthDate ?? '',
        gender: d.gender,
        occupation: d.occupation ?? '',
        companyName: d.customer.companyName ?? '',
        taxNumber: d.taxNumber ?? '',
        typeId: d.customer.type.id,
        statusId: d.customer.status.id,
        sourceId: d.customer.source?.id ?? null,
        tagIds: d.customer.tags.map((t) => t.id),
      }
    : {
        typeId: props.types.find((t) => t.isDefault)?.id ?? null,
        statusId: props.statuses.find((s) => s.isDefault)?.id ?? null,
      })
  contacts.value = (d?.contacts ?? []).map(({ kind, value, label, isDefault }) => ({
    kind,
    value,
    label,
    isDefault,
  }))
  addresses.value = (d?.addresses ?? []).map(({ id: _id, ...rest }) => ({ ...rest }))
  preferences.value = { ...(d?.preferences ?? {}) }
})

// --- Contact / address list editing -----------------------------------------
function addContact(kind: 'PHONE' | 'EMAIL') {
  contacts.value.push({
    kind,
    value: '',
    label: '',
    isDefault: !contacts.value.some((c) => c.kind === kind && c.isDefault),
  })
}

function setDefaultContact(index: number) {
  const kind = contacts.value[index].kind
  contacts.value.forEach((c, i) => {
    if (c.kind === kind) c.isDefault = i === index
  })
}

function addAddress() {
  addresses.value.push({
    label: '',
    line: '',
    city: '',
    province: '',
    postalCode: '',
    isDefault: !addresses.value.some((a) => a.isDefault),
  })
}

function setDefaultAddress(index: number) {
  addresses.value.forEach((a, i) => (a.isDefault = i === index))
}

// --- Duplicate confirmation --------------------------------------------------
const duplicates = ref<DuplicateMatch[] | null>(null)

function buildPayload(ignoreDuplicates: boolean): CustomerPayload {
  const clean = (s: string) => (s.trim() ? s.trim() : undefined)
  return {
    displayName: form.displayName.trim(),
    firstName: clean(form.firstName),
    lastName: clean(form.lastName),
    nationalCode: clean(form.nationalCode),
    passportNumber: clean(form.passportNumber),
    birthDate: form.birthDate || undefined,
    gender: form.gender ?? undefined,
    occupation: clean(form.occupation),
    companyName: clean(form.companyName),
    taxNumber: clean(form.taxNumber),
    typeId: form.typeId as number,
    statusId: form.statusId ?? undefined,
    sourceId: form.sourceId ?? undefined,
    tagIds: form.tagIds,
    contacts: contacts.value.filter((c) => c.value.trim()),
    addresses: addresses.value.filter((a) => a.line.trim()),
    ignoreDuplicates,
    expectedVersion: props.customer?.customer.version,
  }
}

function validate(): boolean {
  displayNameError.value = form.displayName.trim() ? '' : 'Display name is required'
  typeError.value = form.typeId ? '' : 'Customer type is required'
  return !displayNameError.value && !typeError.value
}

async function submit(ignoreDuplicates = false) {
  if (!validate()) {
    tab.value = 'identity'
    return
  }
  saving.value = true
  clearFormError()
  const payload = buildPayload(ignoreDuplicates)
  try {
    if (!ignoreDuplicates) {
      const matches = await customersApi.checkDuplicates(payload, props.customer?.customer.id)
      if (matches.length > 0) {
        duplicates.value = matches
        return
      }
    }
    duplicates.value = null
    const saved = props.customer
      ? await customersApi.update(props.customer.customer.id, payload)
      : await customersApi.create(payload)
    // Preferences are their own endpoint (validated against the definitions).
    if (props.preferenceDefs.length > 0) {
      await customersApi.updatePreferences(saved.customer.id, preferences.value)
    }
    open.value = false
    emit('saved')
  } catch (err) {
    setFormError(err)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="820">
    <v-card rounded="lg">
      <v-card-title class="text-h6 pt-4 px-6">
        {{ isEdit ? 'Edit customer' : 'New customer' }}
        <span v-if="customer" class="text-body-2 text-medium-emphasis ml-2">
          {{ customer.customer.customerCode }}
        </span>
      </v-card-title>

      <v-tabs v-model="tab" class="px-4">
        <v-tab value="identity">Identity</v-tab>
        <v-tab value="contacts">Phones & emails</v-tab>
        <v-tab value="addresses">Addresses</v-tab>
        <v-tab v-if="preferenceDefs.length" value="preferences">Preferences</v-tab>
      </v-tabs>
      <v-divider />

      <v-card-text class="px-6" style="max-height: 62vh; overflow-y: auto">
        <v-alert v-if="formError" type="error" variant="tonal" density="compact" class="mb-4">
          {{ formError }}
        </v-alert>

        <!-- Duplicate confirmation panel -->
        <v-alert v-if="duplicates" type="warning" variant="tonal" class="mb-4">
          <p class="font-weight-medium mb-2">Possible duplicate customers found:</p>
          <ul class="ml-4 mb-2">
            <li v-for="m in duplicates" :key="m.customerId">
              <strong>{{ m.customerCode }}</strong> — {{ m.displayName }}
              <span class="text-caption">({{ m.matchedOn.join(', ') }})</span>
            </li>
          </ul>
          <p class="text-body-2 mb-2">
            Consider merging with an existing record instead of creating a duplicate.
          </p>
          <v-btn size="small" color="warning" :loading="saving" class="mr-2" @click="submit(true)">
            Save anyway
          </v-btn>
          <v-btn size="small" variant="text" @click="duplicates = null">Back</v-btn>
        </v-alert>

        <v-window v-model="tab">
          <v-window-item value="identity">
            <v-row dense>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="form.displayName"
                  label="Display name *"
                  :error-messages="displayNameError"
                  maxlength="160"
                />
              </v-col>
              <v-col cols="12" sm="6">
                <v-select
                  v-model="form.typeId"
                  label="Type *"
                  :items="types.filter((t) => t.active)"
                  item-title="name"
                  item-value="id"
                  :error-messages="typeError"
                />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field v-model="form.firstName" label="First name" maxlength="80" />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field v-model="form.lastName" label="Last name" maxlength="80" />
              </v-col>
              <v-col cols="12" sm="6">
                <v-select
                  v-model="form.statusId"
                  label="Status"
                  :items="selectableStatuses"
                  item-title="name"
                  item-value="id"
                />
              </v-col>
              <v-col cols="12" sm="6">
                <v-select
                  v-model="form.sourceId"
                  label="Source"
                  :items="sources.filter((s) => s.active)"
                  item-title="name"
                  item-value="id"
                  clearable
                />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field v-model="form.nationalCode" label="National code" maxlength="32" />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field v-model="form.passportNumber" label="Passport number" maxlength="32" />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field v-model="form.birthDate" label="Birth date" type="date" clearable />
              </v-col>
              <v-col cols="12" sm="6">
                <v-select v-model="form.gender" label="Gender" :items="genderItems" clearable />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field v-model="form.occupation" label="Occupation" maxlength="120" />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field v-model="form.companyName" label="Company name" maxlength="160" />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field v-model="form.taxNumber" label="Tax number" maxlength="64" />
              </v-col>
              <v-col cols="12" sm="6">
                <v-autocomplete
                  v-model="form.tagIds"
                  label="Tags"
                  :items="tags.filter((t) => t.active)"
                  item-title="name"
                  item-value="id"
                  multiple
                  chips
                  closable-chips
                />
              </v-col>
            </v-row>
          </v-window-item>

          <v-window-item value="contacts">
            <div class="d-flex ga-2 mb-4">
              <v-btn size="small" variant="tonal" prepend-icon="mdi-phone-plus" @click="addContact('PHONE')">
                Add phone
              </v-btn>
              <v-btn size="small" variant="tonal" prepend-icon="mdi-email-plus" @click="addContact('EMAIL')">
                Add email
              </v-btn>
            </div>
            <p v-if="contacts.length === 0" class="text-body-2 text-medium-emphasis">
              No phones or emails yet.
            </p>
            <v-row v-for="(contact, i) in contacts" :key="i" dense align="center">
              <v-col cols="auto">
                <v-icon :icon="contact.kind === 'PHONE' ? 'mdi-phone' : 'mdi-email'" size="small" />
              </v-col>
              <v-col cols="4">
                <v-text-field
                  v-model="contact.value"
                  :label="contact.kind === 'PHONE' ? 'Phone number' : 'Email address'"
                  density="compact"
                  hide-details
                />
              </v-col>
              <v-col cols="3">
                <v-text-field
                  v-model="contact.label"
                  label="Label (mobile, work…)"
                  density="compact"
                  hide-details
                />
              </v-col>
              <v-col cols="auto">
                <v-chip
                  size="small"
                  :color="contact.isDefault ? 'primary' : undefined"
                  :variant="contact.isDefault ? 'flat' : 'outlined'"
                  @click="setDefaultContact(i)"
                >
                  default
                </v-chip>
              </v-col>
              <v-col cols="auto">
                <v-btn icon="mdi-close" size="x-small" variant="text" @click="contacts.splice(i, 1)" />
              </v-col>
            </v-row>
          </v-window-item>

          <v-window-item value="addresses">
            <v-btn size="small" variant="tonal" prepend-icon="mdi-map-marker-plus" class="mb-4" @click="addAddress">
              Add address
            </v-btn>
            <p v-if="addresses.length === 0" class="text-body-2 text-medium-emphasis">
              No addresses yet.
            </p>
            <v-card v-for="(address, i) in addresses" :key="i" variant="outlined" class="mb-3 pa-3">
              <v-row dense>
                <v-col cols="12" sm="8">
                  <v-text-field v-model="address.line" label="Address line *" density="compact" hide-details />
                </v-col>
                <v-col cols="12" sm="4">
                  <v-text-field v-model="address.label" label="Label (home, office…)" density="compact" hide-details />
                </v-col>
                <v-col cols="6" sm="4">
                  <v-text-field v-model="address.city" label="City" density="compact" hide-details />
                </v-col>
                <v-col cols="6" sm="4">
                  <v-text-field v-model="address.province" label="Province" density="compact" hide-details />
                </v-col>
                <v-col cols="6" sm="2">
                  <v-text-field v-model="address.postalCode" label="Postal code" density="compact" hide-details />
                </v-col>
                <v-col cols="6" sm="2" class="d-flex align-center justify-end ga-1">
                  <v-chip
                    size="small"
                    :color="address.isDefault ? 'primary' : undefined"
                    :variant="address.isDefault ? 'flat' : 'outlined'"
                    @click="setDefaultAddress(i)"
                  >
                    default
                  </v-chip>
                  <v-btn icon="mdi-close" size="x-small" variant="text" @click="addresses.splice(i, 1)" />
                </v-col>
              </v-row>
            </v-card>
          </v-window-item>
          <v-window-item value="preferences">
            <p class="text-body-2 text-medium-emphasis mb-4">
              Preference fields are configurable — fields added in configuration appear here
              automatically.
            </p>
            <v-row dense>
              <v-col v-for="def in preferenceDefs" :key="def.id" cols="12" sm="6">
                <v-select
                  v-if="def.fieldType === 'SELECT'"
                  v-model="preferences[def.prefKey] as string | undefined"
                  :label="def.label + (def.required ? ' *' : '')"
                  :items="def.options ?? []"
                  clearable
                />
                <v-switch
                  v-else-if="def.fieldType === 'BOOLEAN'"
                  v-model="preferences[def.prefKey] as boolean | undefined"
                  :label="def.label"
                  color="primary"
                  inset
                />
                <v-text-field
                  v-else
                  v-model="preferences[def.prefKey] as string | undefined"
                  :label="def.label + (def.required ? ' *' : '')"
                  :type="def.fieldType === 'NUMBER' ? 'number' : def.fieldType === 'DATE' ? 'date' : 'text'"
                />
              </v-col>
            </v-row>
          </v-window-item>
        </v-window>
      </v-card-text>

      <v-card-actions class="px-6 pb-4">
        <v-spacer />
        <v-btn variant="text" @click="open = false">Cancel</v-btn>
        <v-btn color="primary" :loading="saving" :disabled="!!duplicates" @click="submit()">
          Save
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
