import { z } from 'zod'

/** Validation for the product create/edit form. */
export const productSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  sku: z.string().min(1, 'SKU is required').max(64),
  description: z.string().max(2000).optional().or(z.literal('')),
  price: z.coerce
    .number({ invalid_type_error: 'Price must be a number' })
    .min(0, 'Price must be zero or positive'),
  stockQuantity: z.coerce
    .number({ invalid_type_error: 'Stock must be a number' })
    .int('Stock must be a whole number')
    .min(0, 'Stock must be zero or positive'),
  active: z.boolean(),
})

export type ProductForm = z.infer<typeof productSchema>
