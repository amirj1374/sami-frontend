import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import { vuetify } from './plugins/vuetify'
import { registerAuthFailureHandler, registerAuthRefreshHandler } from './api/http'
import { permissionDirective } from './directives/permission'
import { useAuthStore } from './stores/auth'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(vuetify)

// `v-can="'users:create'"` / `v-can.disable`: declarative permission checks.
app.directive('can', permissionDirective)

// When a token refresh fails, log out and bounce to the login page.
registerAuthFailureHandler(() => {
  const auth = useAuthStore(pinia)
  void auth.logout()
  void router.push({ name: 'login' })
})

// A successful refresh returns a fresh profile; keep permissions current.
registerAuthRefreshHandler((user) => {
  const auth = useAuthStore(pinia)
  auth.setUser(user)
})

app.mount('#app')
