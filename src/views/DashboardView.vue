<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { usePermission } from '@/composables/usePermission'
import { useFormat } from '@/composables/useFormat'

const { t } = useI18n()
const auth = useAuthStore()
const { canAny, isSuperAdmin } = usePermission()
const { formatNumber } = useFormat()

/**
 * Presentational demo figures for the dashboard widgets. These are static
 * illustrative values (no backend / business logic) — the charts use Vuetify's
 * built-in sparklines and an inline SVG donut, styled from the theme palette.
 */
interface Kpi {
  key: 'products' | 'customers' | 'suppliers' | 'purchases'
  icon: string
  value: number
  trend: number
  spark: number[]
  accent?: boolean
}

const kpis: Kpi[] = [
  { key: 'products', icon: 'mdi-package-variant', value: 1248, trend: 12.5, spark: [8, 10, 9, 12, 14, 13, 16, 18, 17, 20, 22, 24] },
  { key: 'customers', icon: 'mdi-account-group-outline', value: 356, trend: 8.2, spark: [5, 6, 8, 7, 9, 11, 10, 13, 12, 15, 16, 18] },
  { key: 'suppliers', icon: 'mdi-truck-outline', value: 84, trend: 3.1, spark: [3, 4, 4, 5, 5, 6, 6, 7, 7, 7, 8, 8], accent: true },
  { key: 'purchases', icon: 'mdi-cart-outline', value: 192, trend: -2.4, spark: [22, 20, 24, 19, 21, 18, 20, 17, 19, 16, 18, 15] },
]

const salesTrend = [18, 22, 20, 27, 25, 31, 29, 34, 33, 38, 36, 42]
const purchasesByMonth = [12, 18, 15, 22, 19, 24, 21, 26, 23, 28, 25, 30]

// --- Customer distribution donut -------------------------------------------
const donut = computed(() => [
  { label: t('dashboard.charts.individual'), value: 62, color: 'primary' },
  { label: t('dashboard.charts.corporate'), value: 28, color: 'secondary' },
  { label: t('dashboard.charts.other'), value: 10, color: 'accent' },
])
const R = 42
const C = 2 * Math.PI * R
const donutSegments = computed(() => {
  let acc = 0
  return donut.value.map((d) => {
    const len = (d.value / 100) * C
    const seg = { ...d, dash: `${len} ${C - len}`, offset: -(acc / 100) * C }
    acc += d.value
    return seg
  })
})
const donutTotal = computed(() => donut.value.reduce((s, d) => s + d.value, 0))
</script>

<template>
  <div>
    <h1 class="text-h4 font-weight-bold mb-1">{{ t('dashboard.title') }}</h1>
    <p class="text-body-2 text-medium-emphasis mb-6">
      <i18n-t keypath="dashboard.welcome" tag="span">
        <template #name>
          <strong class="text-high-emphasis">{{ auth.user?.fullName }}</strong>
        </template>
      </i18n-t>
    </p>

    <!-- KPI stat cards -->
    <v-row>
      <v-col v-for="kpi in kpis" :key="kpi.key" cols="12" sm="6" lg="3">
        <v-card rounded="lg" border flat class="kpi-card h-100">
          <v-card-text class="d-flex flex-column ga-3">
            <div class="d-flex align-center justify-space-between">
              <span :class="['kpi-icon', { 'kpi-icon--accent': kpi.accent }]">
                <v-icon :icon="kpi.icon" />
              </span>
              <span
                class="d-inline-flex align-center text-caption font-weight-medium"
                :class="kpi.trend >= 0 ? 'text-success' : 'text-error'"
              >
                <v-icon :icon="kpi.trend >= 0 ? 'mdi-trending-up' : 'mdi-trending-down'" size="16" class="me-1" />
                {{ formatNumber(Math.abs(kpi.trend), { minimumFractionDigits: 1, maximumFractionDigits: 1 }) }}٪
              </span>
            </div>
            <div>
              <div class="text-h5 font-weight-bold">{{ formatNumber(kpi.value) }}</div>
              <div class="text-body-2 text-medium-emphasis">{{ t(`dashboard.kpi.${kpi.key}`) }}</div>
            </div>
            <v-sparkline
              :model-value="kpi.spark"
              type="trend"
              :line-width="2.5"
              :smooth="8"
              :color="kpi.accent ? 'accent' : 'primary'"
              height="34"
              auto-draw
              :auto-draw-duration="900"
            />
            <div class="text-caption text-disabled">{{ t('dashboard.vsLastMonth') }}</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Charts -->
    <v-row class="mt-2">
      <v-col cols="12" lg="8">
        <v-card rounded="lg" border flat class="h-100">
          <v-card-item>
            <v-card-title class="text-subtitle-1 font-weight-bold">{{ t('dashboard.charts.salesTrend') }}</v-card-title>
          </v-card-item>
          <v-card-text>
            <v-sparkline
              :model-value="salesTrend"
              type="trend"
              fill
              :line-width="1.5"
              :smooth="12"
              color="primary"
              height="120"
              auto-draw
              :auto-draw-duration="1000"
            />
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" lg="4">
        <v-card rounded="lg" border flat class="h-100">
          <v-card-item>
            <v-card-title class="text-subtitle-1 font-weight-bold">{{ t('dashboard.charts.customerTypes') }}</v-card-title>
          </v-card-item>
          <v-card-text class="d-flex flex-column align-center">
            <div class="donut-wrap">
              <svg viewBox="0 0 100 100" class="donut">
                <g transform="rotate(-90 50 50)">
                  <circle cx="50" cy="50" :r="R" fill="none" class="donut-track" stroke-width="11" />
                  <circle
                    v-for="seg in donutSegments"
                    :key="seg.label"
                    cx="50"
                    cy="50"
                    :r="R"
                    fill="none"
                    stroke-width="11"
                    stroke-linecap="butt"
                    :stroke-dasharray="seg.dash"
                    :stroke-dashoffset="seg.offset"
                    :style="{ stroke: `rgb(var(--v-theme-${seg.color}))` }"
                  />
                </g>
              </svg>
              <div class="donut-center">
                <div class="text-h6 font-weight-bold">{{ formatNumber(donutTotal) }}٪</div>
              </div>
            </div>
            <div class="mt-4 w-100 d-flex flex-column ga-2">
              <div v-for="seg in donut" :key="seg.label" class="d-flex align-center justify-space-between">
                <span class="d-inline-flex align-center text-body-2">
                  <span class="donut-dot" :style="{ background: `rgb(var(--v-theme-${seg.color}))` }" />
                  {{ seg.label }}
                </span>
                <span class="text-body-2 font-weight-medium">{{ formatNumber(seg.value) }}٪</span>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Purchases bar + access summary -->
    <v-row class="mt-2">
      <v-col cols="12" lg="8">
        <v-card rounded="lg" border flat class="h-100">
          <v-card-item>
            <v-card-title class="text-subtitle-1 font-weight-bold">{{ t('dashboard.charts.purchasesByMonth') }}</v-card-title>
          </v-card-item>
          <v-card-text>
            <v-sparkline
              :model-value="purchasesByMonth"
              type="bar"
              color="secondary"
              height="120"
              :padding="6"
              auto-draw
              :auto-draw-duration="900"
            />
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" lg="4">
        <v-card rounded="lg" border flat class="h-100">
          <v-card-item>
            <template #prepend>
              <span class="kpi-icon"><v-icon icon="mdi-shield-account-outline" /></span>
            </template>
            <v-card-title class="text-subtitle-1 font-weight-bold">{{ t('dashboard.yourRole') }}</v-card-title>
            <v-card-subtitle>{{ auth.user?.role.name }}</v-card-subtitle>
          </v-card-item>
          <v-card-text class="text-medium-emphasis">
            <template v-if="isSuperAdmin">{{ t('dashboard.superAdminAccess') }}</template>
            <template v-else-if="canAny(['products:create', 'products:edit', 'products:delete'])">
              {{ t('dashboard.productManagerAccess') }}
            </template>
            <template v-else>{{ t('dashboard.readAccess') }}</template>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>

<style scoped>
.kpi-card {
  transition: box-shadow 0.18s ease, transform 0.18s ease;
}
.kpi-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--app-shadow-md);
}
.donut-wrap {
  position: relative;
  width: 160px;
  height: 160px;
}
.donut {
  width: 160px;
  height: 160px;
}
.donut-track {
  stroke: rgba(var(--v-theme-on-surface), 0.08);
}
.donut-center {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.donut-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 3px;
  margin-inline-end: 8px;
}
</style>
