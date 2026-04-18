import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: ({ image }) => z.object({
    title: z.string(),
    description: z.string(),
    publishDate: z.date(),
    modifiedDate: z.date().optional(),
    author: z.string(),
    heroImage: image().optional(),
    tags: z.array(z.string()).default([]),
  }),
});

export const collections = { blog };
