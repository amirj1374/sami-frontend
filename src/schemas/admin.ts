import { z } from 'zod'

/** Zod schemas for the role / module / permission admin forms. */

/** Lowercase slug used for module codes and permission actions. */
const slugPattern = /^[a-z][a-z0-9-]{1,63}$/
const slugMessage = 'Lowercase letters, digits and dashes; must start with a letter (2-64 chars)'

// --- Roles -----------------------------------------------------------------

/** Validation for the role create/edit form. */
export const roleSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional().or(z.literal('')),
})

/** Validation for the duplicate-role name prompt. */
export const duplicateRoleSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
})

// --- Modules ---------------------------------------------------------------

/**
 * Validation for the module create/edit form. The edit dialog omits the code
 * field (it is immutable) and seeds it from the module being edited.
 */
export const moduleSchema = z.object({
  code: z.string().min(1, 'Code is required').regex(slugPattern, slugMessage),
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional().or(z.literal('')),
  icon: z.string().min(1, 'Icon is required').max(100),
  path: z
    .string()
    .min(1, 'Path is required')
    .max(255)
    .regex(/^\//, 'Path must start with /'),
  displayOrder: z.coerce
    .number({ invalid_type_error: 'Display order must be a number' })
    .int('Display order must be a whole number')
    .min(0, 'Display order must be zero or positive'),
  enabled: z.boolean(),
  createDefaultPermissions: z.boolean(),
})

// --- Permissions -----------------------------------------------------------

/**
 * Validation for the permission create/edit form. The edit dialog only submits
 * name/description (module and action are immutable) but keeps the immutable
 * fields seeded so the full schema still validates.
 */
export const permissionSchema = z.object({
  moduleId: z.number({ required_error: 'Module is required' }).int().positive('Module is required'),
  action: z.string().min(1, 'Action is required').regex(slugPattern, slugMessage),
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional().or(z.literal('')),
})

export type RoleForm = z.infer<typeof roleSchema>
export type DuplicateRoleForm = z.infer<typeof duplicateRoleSchema>
export type ModuleForm = z.infer<typeof moduleSchema>
export type PermissionForm = z.infer<typeof permissionSchema>
