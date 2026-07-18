import { defineStore } from 'pinia'
import { ref } from 'vue'
import { menuApi } from '@/api/menu'
import { router } from '@/router'
import type { MenuItem } from '@/types/models'

/**
 * Navigation menu state.
 *
 * `load()` fetches the permission-filtered menu and, for each item whose path
 * the router does not already know, registers a dynamic child route of the
 * layout pointing at the placeholder view — a module created in the admin
 * panel becomes navigable without a code change. `reset()` (called on logout)
 * clears the items and removes those dynamic routes again.
 */
export const useMenuStore = defineStore('menu', () => {
  const items = ref<MenuItem[]>([])
  const loaded = ref(false)

  /** Names of dynamically registered routes, so reset() can remove them. */
  const dynamicRouteNames: string[] = []

  // Single-flight: concurrent guard runs share one in-flight load.
  let loadPromise: Promise<void> | null = null

  async function load(): Promise<void> {
    loadPromise ??= fetchAndRegister().finally(() => {
      loadPromise = null
    })
    return loadPromise
  }

  async function fetchAndRegister(): Promise<void> {
    const menuItems = await menuApi.list()
    items.value = menuItems
    for (const item of menuItems) {
      registerDynamicRoute(item)
    }
    loaded.value = true
  }

  /** Adds a placeholder route for a menu path no static route covers. */
  function registerDynamicRoute(item: MenuItem): void {
    const resolved = router.resolve(item.path)
    if (resolved.name && resolved.name !== 'not-found') {
      return // A static (or previously registered) route already covers it.
    }
    const name = `module:${item.code}`
    router.addRoute('layout', {
      path: item.path.replace(/^\//, ''),
      name,
      component: () => import('@/views/PlaceholderView.vue'),
      meta: { requiresAuth: true, permission: `${item.code}:view` },
    })
    dynamicRouteNames.push(name)
  }

  function reset(): void {
    items.value = []
    loaded.value = false
    for (const name of dynamicRouteNames) {
      if (router.hasRoute(name)) {
        router.removeRoute(name)
      }
    }
    dynamicRouteNames.length = 0
  }

  return { items, loaded, load, reset }
})
