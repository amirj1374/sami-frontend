<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { suppliersApi } from '@/api/suppliers'
import { useApiError } from '@/composables/useApiError'
import type {
  SupBankAccount,
  SupCategory,
  SupChannel,
  SupContactPerson,
  SupAddressItem,
  SupPaymentTerm,
  SupStatus,
  SupTag,
  SupType,
  SupplierDetail,
  SupplierPayload,
} from '@/types/models'

/**
 * Create/edit supplier: company/identity, phones & emails, addresses, contact
 * persons and bank accounts (each list with a single default/primary).
 * Configured duplicate identifiers trigger a confirmation before saving.
 */
const props = defineProps<{
  modelValue: boolean
  supplier: SupplierDetail | null
  types: SupType[]
  statuses: SupStatus[]
  categories: SupCategory[]
  tags: SupTag[]
  paymentTerms: SupPaymentTerm[]
}>()

const emit = defineEmits<{ 'update:modelValue': [boolean]; saved: [] }>()

const open = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})
const isEdit = computed(() => props.supplier !== null)
const tab = ref<'company' | 'channels' | 'contacts' | 'banking'>('company')
const saving = ref(false)
const duplicateWarning = ref<string | null>(null)
const { message: formError, set: setFormError, clear: clearFormError } = useApiError()

const selectableStatuses = computed(() =>
  props.statuses.filter((s) => !s.isArchivedState && !s.isDeletedState),
)

interface FormState {
  companyName: string
  displayName: string
  legalName: string
  nationalId: string
  economicCode: string
  taxNumber: string
  registrationNumber: string
  ownerName: string
  website: string
  country: string
  province: string
  city: string
  postalCode: string
  description: string
  typeId: number | null
  statusId: number | null
  paymentTermId: number | null
  creditLimit: number | null
  tagIds: number[]
  categoryIds: number[]
}

function emptyForm(): FormState {
  return {
    companyName: '', displayName: '', legalName: '', nationalId: '', economicCode: '',
    taxNumber: '', registrationNumber: '', ownerName: '', website: '', country: '',
    province: '', city: '', postalCode: '', description: '',
    typeId: null, statusId: null, paymentTermId: null, creditLimit: null,
    tagIds: [], categoryIds: [],
  }
}

const form = reactive<FormState>(emptyForm())
const channels = ref<Omit<SupChannel, 'id'>[]>([])
const addresses = ref<Omit<SupAddressItem, 'id'>[]>([])
const contacts = ref<Omit<SupContactPerson, 'id'>[]>([])
const banks = ref<Omit<SupBankAccount, 'id'>[]>([])

watch(open, (isOpen) => {
  if (!isOpen) return
  clearFormError()
  duplicateWarning.value = null
  tab.value = 'company'
  const d = props.supplier
  Object.assign(form, emptyForm(), d
    ? {
        companyName: d.supplier.companyName,
        displayName: d.supplier.displayName,
        legalName: d.legalName ?? '',
        nationalId: d.nationalId ?? '',
        economicCode: d.economicCode ?? '',
        taxNumber: d.taxNumber ?? '',
        registrationNumber: d.registrationNumber ?? '',
        ownerName: d.ownerName ?? '',
        website: d.website ?? '',
        country: d.country ?? '',
        province: d.province ?? '',
        city: d.supplier.city ?? '',
        postalCode: d.postalCode ?? '',
        description: d.description ?? '',
        typeId: d.supplier.type.id,
        statusId: d.supplier.status.id,
        paymentTermId: d.supplier.paymentTerm?.id ?? null,
        creditLimit: d.supplier.creditLimit,
        tagIds: d.supplier.tags.map((t) => t.id),
        categoryIds: d.supplier.categories.map((c) => c.id),
      }
    : {
        typeId: props.types.find((t) => t.isDefault)?.id ?? null,
        statusId: props.statuses.find((s) => s.isDefault)?.id ?? null,
      })
  channels.value = (d?.channels ?? []).map(({ id: _i, ...rest }) => ({ ...rest }))
  addresses.value = (d?.addresses ?? []).map(({ id: _i, ...rest }) => ({ ...rest }))
  contacts.value = (d?.contacts ?? []).map(({ id: _i, ...rest }) => ({ ...rest }))
  banks.value = (d?.bankAccounts ?? []).map(({ id: _i, ...rest }) => ({ ...rest }))
})

// --- list editors -----------------------------------------------------------
function addChannel(kind: 'PHONE' | 'EMAIL') {
  channels.value.push({
    kind, value: '', label: '',
    isDefault: !channels.value.some((c) => c.kind === kind && c.isDefault),
  })
}

function setDefaultChannel(index: number) {
  const kind = channels.value[index].kind
  channels.value.forEach((c, i) => {
    if (c.kind === kind) c.isDefault = i === index
  })
}

function addAddress() {
  addresses.value.push({
    label: '', line: '', city: '', province: '', postalCode: '',
    isDefault: !addresses.value.some((a) => a.isDefault),
  })
}

function addContact() {
  contacts.value.push({
    fullName: '', position: '', department: '', phone: '', mobile: '', email: '',
    preferredMethod: '', notes: '',
    isPrimary: !contacts.value.some((c) => c.isPrimary),
  })
}

function addBank() {
  banks.value.push({
    bankName: '', accountNumber: '', iban: '', cardNumber: '', accountHolder: '',
    isDefault: !banks.value.some((b) => b.isDefault),
  })
}

function single<T>(list: T[], index: number, key: keyof T) {
  list.forEach((item, i) => ((item[key] as unknown as boolean) = i === index))
}

async function submit(ignoreDuplicates = false) {
  if (!form.companyName.trim() || !form.displayName.trim() || !form.typeId) {
    setFormError({ code: 'VALIDATION', message: 'Company name, display name and type are required' })
    tab.value = 'company'
    return
  }
  saving.value = true
  clearFormError()
  const clean = (s: string) => (s.trim() ? s.trim() : undefined)
  const payload: SupplierPayload = {
    companyName: form.companyName.trim(),
    displayName: form.displayName.trim(),
    legalName: clean(form.legalName),
    nationalId: clean(form.nationalId),
    economicCode: clean(form.economicCode),
    taxNumber: clean(form.taxNumber),
    registrationNumber: clean(form.registrationNumber),
    ownerName: clean(form.ownerName),
    website: clean(form.website),
    country: clean(form.country),
    province: clean(form.province),
    city: clean(form.city),
    postalCode: clean(form.postalCode),
    description: clean(form.description),
    typeId: form.typeId,
    statusId: form.statusId ?? undefined,
    paymentTermId: form.paymentTermId ?? undefined,
    creditLimit: form.creditLimit ?? undefined,
    tagIds: form.tagIds,
    categoryIds: form.categoryIds,
    channels: channels.value.filter((c) => c.value.trim()),
    addresses: addresses.value.filter((a) => a.line.trim()),
    contacts: contacts.value.filter((c) => c.fullName.trim()),
    bankAccounts: banks.value.filter((b) => b.bankName.trim()),
    ignoreDuplicates,
    expectedVersion: props.supplier?.supplier.version,
  }
  try {
    if (props.supplier) {
      await suppliersApi.update(props.supplier.supplier.id, payload)
    } else {
      await suppliersApi.create(payload)
    }
    open.value = false
    emit('saved')
  } catch (err: unknown) {
    const apiErr = err as { code?: string; message?: string }
    if (!ignoreDuplicates && apiErr.code === 'RESOURCE_CONFLICT'
        && apiErr.message?.includes('already exists')) {
      duplicateWarning.value = apiErr.message
    } else {
      setFormError(err)
    }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="880">
    <v-card rounded="lg">
      <v-card-title class="text-h6 pt-4 px-6">
        {{ isEdit ? 'Edit supplier ' + supplier?.supplier.supplierCode : 'New supplier' }}
      </v-card-title>

      <v-tabs v-model="tab" class="px-4">
        <v-tab value="company">Company</v-tab>
        <v-tab value="channels">Phones, emails & addresses</v-tab>
        <v-tab value="contacts">Contact persons</v-tab>
        <v-tab value="banking">Banking</v-tab>
      </v-tabs>
      <v-divider />

      <v-card-text class="px-6" style="max-height: 62vh; overflow-y: auto">
        <v-alert v-if="formError" type="error" variant="tonal" density="compact" class="mb-4">
          {{ formError }}
        </v-alert>
        <v-alert v-if="duplicateWarning" type="warning" variant="tonal" class="mb-4">
          <p class="mb-2">{{ duplicateWarning }}</p>
          <v-btn size="small" color="warning" :loading="saving" class="mr-2" @click="submit(true)">
            Save anyway
          </v-btn>
          <v-btn size="small" variant="text" @click="duplicateWarning = null">Back</v-btn>
        </v-alert>

        <v-window v-model="tab">
          <v-window-item value="company">
            <v-row dense>
              <v-col cols="12" sm="6"><v-text-field v-model="form.companyName" label="Company name *" maxlength="160" /></v-col>
              <v-col cols="12" sm="6"><v-text-field v-model="form.displayName" label="Display name *" maxlength="160" /></v-col>
              <v-col cols="12" sm="6"><v-text-field v-model="form.legalName" label="Legal name" maxlength="160" /></v-col>
              <v-col cols="12" sm="6"><v-text-field v-model="form.ownerName" label="Owner name" maxlength="120" /></v-col>
              <v-col cols="6" sm="3">
                <v-select v-model="form.typeId" label="Type *" :items="types.filter((t) => t.active)" item-title="name" item-value="id" />
              </v-col>
              <v-col cols="6" sm="3">
                <v-select v-model="form.statusId" label="Status" :items="selectableStatuses" item-title="name" item-value="id" />
              </v-col>
              <v-col cols="6" sm="3">
                <v-select v-model="form.paymentTermId" label="Payment term" :items="paymentTerms.filter((t) => t.active)" item-title="name" item-value="id" clearable />
              </v-col>
              <v-col cols="6" sm="3">
                <v-text-field v-model.number="form.creditLimit" label="Credit limit" type="number" min="0" clearable />
              </v-col>
              <v-col cols="6" sm="3"><v-text-field v-model="form.nationalId" label="National ID" maxlength="32" /></v-col>
              <v-col cols="6" sm="3"><v-text-field v-model="form.economicCode" label="Economic code" maxlength="32" /></v-col>
              <v-col cols="6" sm="3"><v-text-field v-model="form.taxNumber" label="Tax number" maxlength="64" /></v-col>
              <v-col cols="6" sm="3"><v-text-field v-model="form.registrationNumber" label="Registration no." maxlength="64" /></v-col>
              <v-col cols="6" sm="3"><v-text-field v-model="form.country" label="Country" maxlength="100" /></v-col>
              <v-col cols="6" sm="3"><v-text-field v-model="form.province" label="Province" maxlength="100" /></v-col>
              <v-col cols="6" sm="3"><v-text-field v-model="form.city" label="City" maxlength="100" /></v-col>
              <v-col cols="6" sm="3"><v-text-field v-model="form.postalCode" label="Postal code" maxlength="20" /></v-col>
              <v-col cols="12" sm="6"><v-text-field v-model="form.website" label="Website" maxlength="255" /></v-col>
              <v-col cols="12" sm="6">
                <v-autocomplete v-model="form.categoryIds" label="Categories" :items="categories.filter((c) => c.active)" item-title="name" item-value="id" multiple chips closable-chips />
              </v-col>
              <v-col cols="12">
                <v-autocomplete v-model="form.tagIds" label="Tags" :items="tags.filter((t) => t.active)" item-title="name" item-value="id" multiple chips closable-chips />
              </v-col>
              <v-col cols="12"><v-textarea v-model="form.description" label="Description" rows="2" maxlength="2000" /></v-col>
            </v-row>
          </v-window-item>

          <v-window-item value="channels">
            <div class="d-flex ga-2 mb-3">
              <v-btn size="small" variant="tonal" prepend-icon="mdi-phone-plus" @click="addChannel('PHONE')">Add phone</v-btn>
              <v-btn size="small" variant="tonal" prepend-icon="mdi-email-plus" @click="addChannel('EMAIL')">Add email</v-btn>
              <v-btn size="small" variant="tonal" prepend-icon="mdi-map-marker-plus" @click="addAddress">Add address</v-btn>
            </div>
            <v-row v-for="(channel, i) in channels" :key="'c' + i" dense align="center">
              <v-col cols="auto"><v-icon :icon="channel.kind === 'PHONE' ? 'mdi-phone' : 'mdi-email'" size="small" /></v-col>
              <v-col cols="4"><v-text-field v-model="channel.value" :label="channel.kind === 'PHONE' ? 'Phone' : 'Email'" density="compact" hide-details /></v-col>
              <v-col cols="3"><v-text-field v-model="channel.label" label="Label" density="compact" hide-details /></v-col>
              <v-col cols="auto">
                <v-chip size="small" :color="channel.isDefault ? 'primary' : undefined" :variant="channel.isDefault ? 'flat' : 'outlined'" @click="setDefaultChannel(i)">default</v-chip>
              </v-col>
              <v-col cols="auto"><v-btn icon="mdi-close" size="x-small" variant="text" @click="channels.splice(i, 1)" /></v-col>
            </v-row>

            <v-card v-for="(address, i) in addresses" :key="'a' + i" variant="outlined" class="mt-3 pa-3">
              <v-row dense>
                <v-col cols="12" sm="8"><v-text-field v-model="address.line" label="Address line *" density="compact" hide-details /></v-col>
                <v-col cols="12" sm="4"><v-text-field v-model="address.label" label="Label" density="compact" hide-details /></v-col>
                <v-col cols="6" sm="4"><v-text-field v-model="address.city" label="City" density="compact" hide-details /></v-col>
                <v-col cols="6" sm="4"><v-text-field v-model="address.province" label="Province" density="compact" hide-details /></v-col>
                <v-col cols="6" sm="2"><v-text-field v-model="address.postalCode" label="Postal code" density="compact" hide-details /></v-col>
                <v-col cols="6" sm="2" class="d-flex align-center justify-end ga-1">
                  <v-chip size="small" :color="address.isDefault ? 'primary' : undefined" :variant="address.isDefault ? 'flat' : 'outlined'" @click="single(addresses, i, 'isDefault')">default</v-chip>
                  <v-btn icon="mdi-close" size="x-small" variant="text" @click="addresses.splice(i, 1)" />
                </v-col>
              </v-row>
            </v-card>
          </v-window-item>

          <v-window-item value="contacts">
            <v-btn size="small" variant="tonal" prepend-icon="mdi-account-plus" class="mb-3" @click="addContact">Add contact</v-btn>
            <v-card v-for="(contact, i) in contacts" :key="i" variant="outlined" class="mb-3 pa-3">
              <v-row dense>
                <v-col cols="12" sm="4"><v-text-field v-model="contact.fullName" label="Full name *" density="compact" hide-details /></v-col>
                <v-col cols="6" sm="4"><v-text-field v-model="contact.position" label="Position" density="compact" hide-details /></v-col>
                <v-col cols="6" sm="4"><v-text-field v-model="contact.department" label="Department" density="compact" hide-details /></v-col>
                <v-col cols="6" sm="3"><v-text-field v-model="contact.phone" label="Phone" density="compact" hide-details /></v-col>
                <v-col cols="6" sm="3"><v-text-field v-model="contact.mobile" label="Mobile" density="compact" hide-details /></v-col>
                <v-col cols="6" sm="3"><v-text-field v-model="contact.email" label="Email" density="compact" hide-details /></v-col>
                <v-col cols="6" sm="3">
                  <v-select v-model="contact.preferredMethod" label="Preferred contact" :items="['phone', 'mobile', 'email', 'whatsapp', 'telegram']" density="compact" hide-details clearable />
                </v-col>
                <v-col cols="12" sm="9"><v-text-field v-model="contact.notes" label="Notes" density="compact" hide-details /></v-col>
                <v-col cols="12" sm="3" class="d-flex align-center justify-end ga-1">
                  <v-chip size="small" :color="contact.isPrimary ? 'primary' : undefined" :variant="contact.isPrimary ? 'flat' : 'outlined'" @click="single(contacts, i, 'isPrimary')">primary</v-chip>
                  <v-btn icon="mdi-close" size="x-small" variant="text" @click="contacts.splice(i, 1)" />
                </v-col>
              </v-row>
            </v-card>
          </v-window-item>

          <v-window-item value="banking">
            <v-btn size="small" variant="tonal" prepend-icon="mdi-bank-plus" class="mb-3" @click="addBank">Add bank account</v-btn>
            <v-card v-for="(bank, i) in banks" :key="i" variant="outlined" class="mb-3 pa-3">
              <v-row dense>
                <v-col cols="12" sm="4"><v-text-field v-model="bank.bankName" label="Bank name *" density="compact" hide-details /></v-col>
                <v-col cols="6" sm="4"><v-text-field v-model="bank.accountNumber" label="Account number" density="compact" hide-details /></v-col>
                <v-col cols="6" sm="4"><v-text-field v-model="bank.accountHolder" label="Account holder" density="compact" hide-details /></v-col>
                <v-col cols="6" sm="5"><v-text-field v-model="bank.iban" label="IBAN" density="compact" hide-details /></v-col>
                <v-col cols="6" sm="4"><v-text-field v-model="bank.cardNumber" label="Card number (16 digits)" density="compact" hide-details /></v-col>
                <v-col cols="12" sm="3" class="d-flex align-center justify-end ga-1">
                  <v-chip size="small" :color="bank.isDefault ? 'primary' : undefined" :variant="bank.isDefault ? 'flat' : 'outlined'" @click="single(banks, i, 'isDefault')">default</v-chip>
                  <v-btn icon="mdi-close" size="x-small" variant="text" @click="banks.splice(i, 1)" />
                </v-col>
              </v-row>
            </v-card>
          </v-window-item>
        </v-window>
      </v-card-text>

      <v-card-actions class="px-6 pb-4">
        <v-spacer />
        <v-btn variant="text" @click="open = false">Cancel</v-btn>
        <v-btn color="primary" :loading="saving" :disabled="!!duplicateWarning" @click="submit()">Save</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
