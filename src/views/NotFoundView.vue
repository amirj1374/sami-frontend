<script setup lang="ts">
// Fallback 404 view.
</script>

<template>
  <v-main>
    <v-container class="fill-height" fluid>
      <v-row justify="center" align="center">
        <v-col cols="12" class="text-center">
          <div class="text-h2 font-weight-bold mb-2">404</div>
          <p class="text-body-1 mb-6">The page you are looking for does not exist.</p>
          <v-btn color="primary" :to="{ name: 'dashboard' }">Go home</v-btn>
        </v-col>
      </v-row>
    </v-container>
  </v-main>
</template>
