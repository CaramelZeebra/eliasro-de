import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    summary: z.string().optional(),
    // Optional picture-bundle: paths under public/, displayed as a grid below the body.
    gallery: z.array(z.string()).optional(),
  }),
});

export const collections = { blog };
