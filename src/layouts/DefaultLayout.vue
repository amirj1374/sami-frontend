<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useDisplay } from 'vuetify'
import { useAuthStore } from '@/stores/auth'
import { useMenuStore } from '@/stores/menu'
import ChangePasswordDialog from '@/components/ChangePasswordDialog.vue'
import LanguageSwitcher from '@/components/LanguageSwitcher.vue'

const { t } = useI18n()
const { mobile } = useDisplay()
const auth = useAuthStore()
const menu = useMenuStore()
const router = useRouter()
const route = useRoute()
// Visible by default on desktop; hidden (opens as an overlay) on phones/tablets.
const drawer = ref(!mobile.value)
const changePasswordOpen = ref(false)

/**
 * Maps a route name to an existing i18n title key so the header can show the
 * current page and breadcrumb. Purely presentational — no routing change; keys
 * already exist in the locale files.
 */
const TITLE_KEYS: Record<string, string> = {
  dashboard: 'dashboard.title',
  products: 'products.title',
  suppliers: 'suppliers.title',
  purchases: 'purchases.title',
  customers: 'customers.title',
  users: 'users.title',
  roles: 'roles.title',
  permissions: 'permissions.title',
  modules: 'modules.title',
}

const isDashboard = computed(() => route.name === 'dashboard')

const pageTitle = computed(() => {
  const key = TITLE_KEYS[String(route.name ?? '')]
  return key ? t(key) : t('common.appName')
})

/** Breadcrumb trail: Dashboard › current page (collapses to just Dashboard). */
const breadcrumbs = computed(() => {
  const home = { title: t('dashboard.title'), to: { name: 'dashboard' }, disabled: false }
  if (isDashboard.value) return [{ ...home, disabled: true }]
  return [home, { title: pageTitle.value, disabled: true }]
})

/** Up to two initials for the avatar, e.g. "Ada Lovelace" -> "AL". */
const initials = computed(() => {
  const parts = (auth.user?.fullName ?? '').split(/\s+/).filter(Boolean)
  return (
    parts
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || '?'
  )
})

async function logout() {
  await auth.logout()
  await router.push({ name: 'login' })
}
</script>

<template>
  <v-navigation-drawer v-model="drawer" :temporary="mobile" class="app-drawer">
    <div class="app-brand d-flex align-center ga-3 px-4">
      <v-avatar rounded="lg" color="primary" size="36">
        <span class="text-subtitle-2 font-weight-bold">S</span>
      </v-avatar>
      <span class="text-subtitle-1 font-weight-bold">{{ t('common.appName') }}</span>
    </div>
    <v-divider />
    <v-list nav color="primary" class="px-3 py-3">
      <v-list-item
        v-for="item in menu.items"
        :key="item.code"
        :to="item.path"
        :prepend-icon="item.icon"
        :title="item.name"
        rounded="lg"
        class="app-nav-item mb-1"
      />
    </v-list>
  </v-navigation-drawer>

  <v-app-bar app flat border height="64">
    <v-app-bar-nav-icon :aria-label="t('layout.toggleMenu')" @click="drawer = !drawer" />

    <div class="app-topbar-title d-flex flex-column justify-center">
      <v-breadcrumbs :items="breadcrumbs" density="compact" divider="/" class="pa-0 app-breadcrumbs">
        <template #title="{ item }">
          <span :class="item.disabled ? 'text-high-emphasis font-weight-medium' : 'text-medium-emphasis'">
            {{ item.title }}
          </span>
        </template>
      </v-breadcrumbs>
      <span class="text-subtitle-1 font-weight-bold app-page-title">{{ pageTitle }}</span>
    </div>

    <v-spacer />

    <!-- Notifications (affordance with a clear empty state; no backend). -->
    <v-menu location="bottom end" :close-on-content-click="false">
      <template #activator="{ props: activatorProps }">
        <v-btn
          icon="mdi-bell-outline"
          variant="text"
          v-bind="activatorProps"
          :aria-label="t('layout.notifications')"
        />
      </template>
      <v-card min-width="300" max-width="360">
        <div class="px-4 py-3 text-subtitle-2 font-weight-bold">{{ t('layout.notifications') }}</div>
        <v-divider />
        <div class="pa-8 text-center">
          <v-icon icon="mdi-bell-sleep-outline" size="40" class="mb-2 text-disabled" />
          <div class="text-body-2 text-medium-emphasis">{{ t('layout.noNotifications') }}</div>
        </div>
      </v-card>
    </v-menu>

    <LanguageSwitcher />

    <!-- Profile -->
    <v-menu location="bottom end">
      <template #activator="{ props: activatorProps }">
        <v-btn icon variant="text" v-bind="activatorProps" class="ml-1" :aria-label="t('layout.account')">
          <v-avatar color="primary" size="34">
            <span class="text-body-2 font-weight-medium">{{ initials }}</span>
          </v-avatar>
        </v-btn>
      </template>
      <v-card min-width="260">
        <div class="d-flex align-center ga-3 px-4 py-3">
          <v-avatar color="primary" size="40">
            <span class="text-body-2 font-weight-medium">{{ initials }}</span>
          </v-avatar>
          <div class="d-flex flex-column overflow-hidden">
            <span class="text-body-2 font-weight-medium text-truncate">{{ auth.user?.fullName }}</span>
            <span class="text-caption text-medium-emphasis text-truncate">{{ auth.user?.email }}</span>
          </div>
        </div>
        <div class="px-4 pb-3">
          <v-chip size="x-small" color="primary" variant="tonal" class="font-weight-medium">
            {{ auth.user?.role.name }}
          </v-chip>
        </div>
        <v-divider />
        <v-list density="compact" nav class="pa-2">
          <v-list-item
            rounded="lg"
            prepend-icon="mdi-lock-reset"
            :title="t('layout.changePassword')"
            @click="changePasswordOpen = true"
          />
          <v-list-item
            rounded="lg"
            base-color="error"
            prepend-icon="mdi-logout"
            :title="t('layout.logout')"
            @click="logout"
          />
        </v-list>
      </v-card>
    </v-menu>
  </v-app-bar>

  <v-main>
    <v-container>
      <router-view />
    </v-container>
  </v-main>

  <ChangePasswordDialog v-model="changePasswordOpen" />
</template>
