import { http, HttpResponse } from 'msw'
import { mockUser } from './data/auth'
import { mockMenu } from './data/menu'

/** Standard API envelope used by the backend. */
function ok<T>(data: T) {
  return HttpResponse.json({ success: true, data, error: null, timestamp: new Date().toISOString() })
}

function emptyPage() {
  return ok({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0, first: true, last: true })
}

/**
 * MSW request handlers for Mock Mode. Covers the endpoints the shell needs to
 * boot (current user, menu) and returns empty pages for list endpoints so every
 * screen renders without a backend. Extend as needed for richer demos.
 */
export const handlers = [
  http.get('/api/v1/users/me', () => ok(mockUser)),
  http.get('/api/v1/menu', () => ok(mockMenu)),
  http.get('*/api/v1/dashboards', () => emptyPage()),
  http.get('*/api/v1/kpis', () => emptyPage()),
  // Generic fallbacks so unhandled list/detail calls don't error the UI.
  http.get('*/api/v1/*', () => emptyPage()),
]
