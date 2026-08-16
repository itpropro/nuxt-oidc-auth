import { defineCollection, defineContentConfig, z } from '@nuxt/content'

const buttonLink = z.object({
  label: z.string(),
  icon: z.string().optional(),
  trailing: z.boolean().optional(),
  trailingIcon: z.string().optional(),
  color: z.literal('neutral').optional(),
  to: z.string(),
  target: z.literal('_blank').optional(),
  size: z.literal('lg').optional(),
})

export default defineContentConfig({
  collections: {
    docs: defineCollection({
      type: 'page',
      source: '**',
      schema: z.object({
        hero: z.object({
          title: z.string(),
          description: z.string(),
          orientation: z.literal('horizontal'),
          links: z.array(buttonLink),
        }).optional(),
        features: z.object({
          title: z.string(),
          links: z.array(buttonLink),
          items: z.array(z.object({
            title: z.string(),
            description: z.string(),
            icon: z.string(),
            to: z.string(),
          })),
        }).optional(),
        to: z.string().optional(),
        external: z.boolean().optional(),
        target: z.literal('_blank').optional(),
      }),
    }),
  },
})
