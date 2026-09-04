import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// One markdown file per entry in src/content/pages/ — that is the whole
// content model. Dropping a file in there adds a row to the index, a route,
// a command at the prompt, and a tab-completion, with nothing else to edit.
const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: z.object({
    /** Typed at the prompt; also the URL slug. Lowercase, no spaces. */
    command: z.string(),
    /** Extra words that resolve to this entry at the prompt. */
    aliases: z.array(z.string()).default([]),
    /** Middle column of the index. Lowercase, no full stop. */
    blurb: z.string(),
    /** Right column of the index. A date range, a marker, or nothing. */
    note: z.string().optional(),
    /** Ascending. Ties fall back to alphabetical. */
    order: z.number().default(50),
    /** Set to link the row off-site; no page is built and the body is unused. */
    external: z.string().url().optional(),
    /** Absent from the index, from `ls`, and from tab-completion. */
    hidden: z.boolean().default(false),
    /** Page heading. Defaults to `command`. */
    title: z.string().optional(),
    /** A bespoke route already serves /<command>; do not generate one. */
    custom: z.boolean().default(false),
  }),
});

export const collections = { pages };
