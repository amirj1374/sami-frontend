<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { productSchema } from '@/schemas/product'
import { productsApi } from '@/api/products'
import { useApiError } from '@/composables/useApiError'
import type { Product } from '@/types/models'

const { t } = useI18n()

const props = defineProps<{
  modelValue: boolean
  /** When set, the dialog edits this product; otherwise it creates a new one. */
  product: Product | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: []
}>()

const { message: errorMessage, set: setError, clear: clearError } = useApiError()
const loading = ref(false)

const { handleSubmit, defineField, errors, resetForm } = useForm({
  validationSchema: toTypedSchema(productSchema(t)),
  initialValues: {
    name: '',
    sku: '',
    description: '',
    price: 0,
    stockQuantity: 0,
    active: true,
  },
})

const [name, nameProps] = defineField('name')
const [sku, skuProps] = defineField('sku')
const [description, descriptionProps] = defineField('description')
const [price, priceProps] = defineField('price')
const [stockQuantity, stockProps] = defineField('stockQuantity')
const [active, activeProps] = defineField('active')

// Re-seed the form whenever the dialog opens (create vs edit).
watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    clearError()
    const p = props.product
    resetForm({
      values: p
        ? {
            name: p.name,
            sku: p.sku,
            description: p.description ?? '',
            price: p.price,
            stockQuantity: p.stockQuantity,
            active: p.active,
          }
        : { name: '', sku: '', description: '', price: 0, stockQuantity: 0, active: true },
    })
  },
)

function close() {
  emit('update:modelValue', false)
}

const onSubmit = handleSubmit(async (values) => {
  loading.value = true
  clearError()
  try {
    if (props.product) {
      await productsApi.update(props.product.id, {
        name: values.name,
        description: values.description || undefined,
        price: values.price,
        stockQuantity: values.stockQuantity,
        active: values.active,
      })
    } else {
      await productsApi.create({
        name: values.name,
        sku: values.sku,
        description: values.description || undefined,
        price: values.price,
        stockQuantity: values.stockQuantity,
        active: values.active,
      })
    }
    emit('saved')
    close()
  } catch (err) {
    setError(err)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="560"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card rounded="lg">
      <v-card-title class="text-h6 pt-4 px-6">
        {{ product ? t('products.editTitle') : t('products.newProduct') }}
      </v-card-title>

      <v-card-text class="px-6">
        <v-alert v-if="errorMessage" type="error" variant="tonal" density="compact" class="mb-4">
          {{ errorMessage }}
        </v-alert>

        <v-form @submit.prevent="onSubmit">
          <v-text-field
            v-model="name"
            v-bind="nameProps"
            :error-messages="errors.name"
            :label="t('products.fieldName')"
          />
          <v-text-field
            v-model="sku"
            v-bind="skuProps"
            :error-messages="errors.sku"
            :label="t('products.fieldSku')"
            :disabled="!!product"
            :hint="t('products.skuHint')"
            persistent-hint
          />
          <v-textarea
            v-model="description"
            v-bind="descriptionProps"
            :error-messages="errors.description"
            :label="t('products.fieldDescription')"
            rows="2"
            auto-grow
          />
          <v-row>
            <v-col cols="6">
              <v-text-field
                v-model="price"
                v-bind="priceProps"
                :error-messages="errors.price"
                :label="t('products.fieldPrice')"
                type="number"
                step="0.01"
                prefix="$"
              />
            </v-col>
            <v-col cols="6">
              <v-text-field
                v-model="stockQuantity"
                v-bind="stockProps"
                :error-messages="errors.stockQuantity"
                :label="t('products.fieldStock')"
                type="number"
              />
            </v-col>
          </v-row>
          <v-switch
            v-model="active"
            v-bind="activeProps"
            :label="t('products.fieldActive')"
            color="primary"
            inset
          />
        </v-form>
      </v-card-text>

      <v-card-actions class="px-6 pb-4">
        <v-spacer />
        <v-btn variant="text" @click="close">{{ t('common.cancel') }}</v-btn>
        <v-btn color="primary" :loading="loading" @click="onSubmit">{{ t('common.save') }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
