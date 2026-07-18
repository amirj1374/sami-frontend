<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useMenuStore } from '@/stores/menu'

/**
 * Target of dynamically registered module routes: a module created in the
 * admin panel is navigable immediately, even before its screens are built.
 * The module is looked up by the current route's path.
 */
const route = useRoute()
const menu = useMenuStore()

const moduleItem = computed(() => menu.items.find((item) => item.path === route.path) ?? null)
const moduleName = computed(() => moduleItem.value?.name ?? 'Module')
const moduleIcon = computed(() => moduleItem.value?.icon ?? 'mdi-view-module')
</script>

<template>
  <div>
    <h1 class="text-h4 mb-4">{{ moduleName }}</h1>

    <v-card rounded="lg" border flat>
      <v-card-text class="text-center py-12">
        <v-icon :icon="moduleIcon" size="64" color="primary" class="mb-4" />
        <div class="text-h6 mb-2">{{ moduleName }} is scaffolded</div>
        <p class="text-body-1 text-medium-emphasis mx-auto" style="max-width: 480px">
          This module does not have its screens built yet, but it is already wired into the
          navigation and its permissions already apply — only users who may view it can open
          this page.
        </p>
      </v-card-text>
    </v-card>
  </div>
</template>
