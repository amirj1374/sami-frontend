import type { MenuItem } from '@/types/models'

/** The navigation menu used in Mock Mode (mirrors the seeded backend modules). */
export const mockMenu: MenuItem[] = [
  { code: 'dashboards', name: 'Dashboards', icon: 'mdi-view-dashboard-variant', path: '/dashboards', displayOrder: 15 },
  { code: 'customers', name: 'Customers', icon: 'mdi-account-heart', path: '/customers', displayOrder: 20 },
  { code: 'suppliers', name: 'Suppliers', icon: 'mdi-truck', path: '/suppliers', displayOrder: 22 },
  { code: 'products', name: 'Products', icon: 'mdi-package-variant-closed', path: '/products', displayOrder: 30 },
  { code: 'purchasing', name: 'Purchasing', icon: 'mdi-cart-arrow-down', path: '/purchases', displayOrder: 35 },
  { code: 'users', name: 'Users', icon: 'mdi-account-group', path: '/users', displayOrder: 40 },
  { code: 'roles', name: 'Roles', icon: 'mdi-shield-account', path: '/roles', displayOrder: 50 },
  { code: 'permissions', name: 'Permissions', icon: 'mdi-key', path: '/permissions', displayOrder: 60 },
  { code: 'modules', name: 'Modules', icon: 'mdi-view-module', path: '/modules', displayOrder: 70 },
]
