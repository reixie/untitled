import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const text = z.string().trim().min(1, 'Provide non-empty text.');
const publicationDate = z.iso
  .date({ error: 'Use a real calendar date in quoted YYYY-MM-DD format.' })
  .transform((value) => new Date(`${value}T00:00:00.000Z`));

const articles = defineCollection({
  loader: glob({ base: './src/content/articles', pattern: '**/*.{md,mdx}' }),
  schema: z.discriminatedUnion('status', [
    z.object({
      status: z.literal('draft'),
      title: text.optional(),
      description: text.optional(),
      publishedAt: publicationDate.optional(),
    }),
    z.object({
      status: z.literal('published'),
      title: text,
      description: text,
      publishedAt: publicationDate,
    }),
  ]),
});

// Selected work has its own editorial contract; project dates are not required.
const work = defineCollection({
  loader: glob({ base: './src/content/work', pattern: '**/*.mdx' }),
  schema: z.object({ title: text, subtitle: text, description: text }),
});

export const collections = { articles, work };
