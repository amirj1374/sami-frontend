<script setup lang="ts">
import { ref } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { authApi } from '@/api/auth'
import { useApiError } from '@/composables/useApiError'
import { forgotPasswordSchema } from '@/schemas/auth'

const { message: errorMessage, set: setError, clear: clearError } = useApiError()
const loading = ref(false)
const sent = ref(false)

const { handleSubmit, defineField, errors } = useForm({
  validationSchema: toTypedSchema(forgotPasswordSchema),
  initialValues: { email: '' },
})
const [email, emailProps] = defineField('email')

const onSubmit = handleSubmit(async (values) => {
  loading.value = true
  clearError()
  try {
    await authApi.forgotPassword(values)
    sent.value = true
  } catch (err) {
    setError(err)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <v-card elevation="4" rounded="lg">
    <v-card-title class="text-h5 pt-6 px-6">Forgot password</v-card-title>
    <v-card-subtitle class="px-6">We will email you a reset link</v-card-subtitle>

    <v-card-text class="px-6">
      <v-alert v-if="sent" type="success" variant="tonal" density="compact" class="mb-4">
        If an account exists for that email, a password reset link has been sent. Check your
        inbox.
      </v-alert>

      <template v-else>
        <v-alert v-if="errorMessage" type="error" variant="tonal" density="compact" class="mb-4">
          {{ errorMessage }}
        </v-alert>

        <v-form @submit.prevent="onSubmit">
          <v-text-field
            v-model="email"
            v-bind="emailProps"
            :error-messages="errors.email"
            label="Email"
            type="email"
            autocomplete="email"
            prepend-inner-icon="mdi-email-outline"
          />

          <v-btn type="submit" color="primary" block size="large" :loading="loading" class="mt-2">
            Send reset link
          </v-btn>
        </v-form>
      </template>
    </v-card-text>

    <v-card-actions class="justify-center pb-6">
      <v-btn variant="text" :to="{ name: 'login' }" color="primary">Back to sign in</v-btn>
    </v-card-actions>
  </v-card>
</template>
