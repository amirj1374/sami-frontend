import { z } from 'zod'

/**
 * Zod schema for the admin user form (create + edit share one shape so the
 * typed form stays uniform). Email/password only exist at creation; their
 * presence in create mode is enforced by the dialog on submit, their format
 * here.
 */
export const userFormSchema = z.object({
  email: z.string().email('Enter a valid email').optional().or(z.literal('')),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password is too long')
    .optional()
    .or(z.literal('')),
  fullName: z.string().min(1, 'Full name is required').max(120),
  roleId: z
    .number({ required_error: 'Role is required', invalid_type_error: 'Role is required' })
    .int()
    .positive('Role is required'),
  statusId: z
    .number({ required_error: 'Status is required', invalid_type_error: 'Status is required' })
    .int()
    .positive('Status is required'),
})

export type UserForm = z.infer<typeof userFormSchema>
