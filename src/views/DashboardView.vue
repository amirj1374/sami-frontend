<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import { usePermission } from '@/composables/usePermission'

const auth = useAuthStore()
const { canAny, isSuperAdmin } = usePermission()
</script>

<template>
  <div>
    <h1 class="text-h4 mb-2">Dashboard</h1>
    <p class="text-body-1 mb-6">
      Welcome back, <strong>{{ auth.user?.fullName }}</strong>.
    </p>

    <v-row>
      <v-col cols="12" md="4">
        <v-card rounded="lg" border flat>
          <v-card-item>
            <v-card-title>Your role</v-card-title>
            <v-card-subtitle>{{ auth.user?.role.name }}</v-card-subtitle>
          </v-card-item>
          <v-card-text>
            <template v-if="isSuperAdmin"> You have unrestricted access to every module. </template>
            <template v-else-if="canAny(['products:create', 'products:edit', 'products:delete'])">
              You can manage the product catalogue.
            </template>
            <template v-else> You have read access to the modules in your menu. </template>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="4">
        <v-card rounded="lg" border flat :to="{ name: 'products' }" hover>
          <v-card-item>
            <v-card-title>Products</v-card-title>
            <v-card-subtitle>Browse the catalogue</v-card-subtitle>
          </v-card-item>
          <v-card-text>Open the product list with search, filters and pagination.</v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>
