import type { ApiResponse, PageQuery, PageResponse } from '@/types/api'
import type {
  AppModule,
  CreateModulePayload,
  UpdateModulePayload,
  UpdateModuleStatusPayload,
} from '@/types/models'
import { http, unwrap, unwrapVoid } from './http'

/** Module administration API calls ("module" in API wording). */
export const modulesApi = {
  list: (params: PageQuery = {}): Promise<PageResponse<AppModule>> =>
    unwrap(http.get<ApiResponse<PageResponse<AppModule>>>('/v1/modules', { params })),

  create: (payload: CreateModulePayload): Promise<AppModule> =>
    unwrap(http.post<ApiResponse<AppModule>>('/v1/modules', payload)),

  /** Code is immutable; enabled changes go through {@link updateStatus}. */
  update: (id: number, payload: UpdateModulePayload): Promise<AppModule> =>
    unwrap(http.put<ApiResponse<AppModule>>(`/v1/modules/${id}`, payload)),

  updateStatus: (id: number, payload: UpdateModuleStatusPayload): Promise<void> =>
    unwrapVoid(http.patch<ApiResponse<unknown>>(`/v1/modules/${id}/status`, payload)),

  remove: (id: number): Promise<void> => http.delete(`/v1/modules/${id}`).then(() => undefined),
}
