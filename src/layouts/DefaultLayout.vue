<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useMenuStore } from '@/stores/menu'
import ChangePasswordDialog from '@/components/ChangePasswordDialog.vue'

const auth = useAuthStore()
const menu = useMenuStore()
const router = useRouter()
const drawer = ref(true)
const changePasswordOpen = ref(false)

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
  <v-navigation-drawer v-model="drawer" app>
    <v-list nav>
      <v-list-item
        v-for="item in menu.items"
        :key="item.code"
        :to="item.path"
        :prepend-icon="item.icon"
        :title="item.name"
      />
    </v-list>
  </v-navigation-drawer>

  <v-app-bar app flat border>
    <v-app-bar-nav-icon @click="drawer = !drawer" />
    <v-app-bar-title>Sami</v-app-bar-title>
    <v-spacer />
    <span v-if="auth.user" class="text-body-2 mr-2">
      {{ auth.user.fullName }}
      <v-chip size="x-small" class="ml-1">{{ auth.user.role.name }}</v-chip>
    </span>
    <v-menu location="bottom end">
      <template #activator="{ props: activatorProps }">
        <v-btn icon v-bind="activatorProps" class="mr-2">
          <v-avatar color="primary" size="36">
            <span class="text-body-2">{{ initials }}</span>
          </v-avatar>
        </v-btn>
      </template>
      <v-list density="compact" nav min-width="220">
        <v-list-item :title="auth.user?.fullName" :subtitle="auth.user?.email" />
        <v-divider class="my-1" />
        <v-list-item
          prepend-icon="mdi-lock-reset"
          title="Change password"
          @click="changePasswordOpen = true"
        />
        <v-list-item prepend-icon="mdi-logout" title="Logout" @click="logout" />
      </v-list>
    </v-menu>
  </v-app-bar>

  <v-main>
    <v-container>
      <router-view />
    </v-container>
  </v-main>

  <ChangePasswordDialog v-model="changePasswordOpen" />
</template>
