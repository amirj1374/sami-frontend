<script setup lang="ts">
// Minimal centered shell for the login/register screens.
</script>

<template>
  <v-main>
    <v-container class="fill-height" fluid>
      <v-row justify="center" align="center">
        <v-col cols="12" sm="8" md="5" lg="4">
          <router-view />
        </v-col>
      </v-row>
    </v-container>
  </v-main>
</template>
