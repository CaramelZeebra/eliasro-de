import { getCollection, type CollectionEntry } from 'astro:content';
import fs from 'node:fs';

export type PageEntry = CollectionEntry<'pages'>;

/** Every entry, in index order: `order` ascending, then alphabetical. */
export async function allEntries(): Promise<PageEntry[]> {
  const entries = await getCollection('pages');
  return entries.sort(
    (a, b) =>
      a.data.order - b.data.order ||
      a.data.command.localeCompare(b.data.command),
  );
}

/** Entries shown in the index, in `ls`, and in tab-completion. */
export async function visibleEntries(): Promise<PageEntry[]> {
  return (await allEntries()).filter((e) => !e.data.hidden);
}

/** Entries this collection generates a route for. External rows are links,
 *  not pages; `custom` rows are served by a hand-written page instead. */
export async function routedEntries(): Promise<PageEntry[]> {
  return (await allEntries()).filter((e) => !e.data.external && !e.data.custom);
}

/** First paragraph of a body, as plain text — markdown stripped. */
function excerptOf(body: string): string {
  const block = body
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .find((b) => b.length > 0 && !b.startsWith('#') && !b.startsWith('---'));
  if (!block) return '';
  return block
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // links → their text
    .replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, '$1') // emphasis
    .replace(/`([^`]*)`/g, '$1') // inline code
    .replace(/\s+/g, ' ')
    .trim();
}

/** Last modification date of the source file, falling back to the build. */
function dateOf(entry: PageEntry): string {
  const path = (entry as { filePath?: string }).filePath;
  if (path) {
    try {
      return fs.statSync(path).mtime.toISOString().slice(0, 10);
    } catch {
      /* fall through */
    }
  }
  return new Date().toISOString().slice(0, 10);
}

/** The shape the prompt's client script needs. Kept deliberately small. */
export interface CommandSpec {
  command: string;
  aliases: string[];
  blurb: string;
  href: string;
  external: boolean;
  hidden: boolean;
  /** Bytes of the markdown body; for a link, the length of its target. */
  size: number;
  /** YYYY-MM-DD. */
  date: string;
  /** First paragraph, plain text. Empty for links. */
  excerpt: string;
}

export async function commandSpecs(): Promise<CommandSpec[]> {
  return (await allEntries()).map((e) => {
    const body = e.body ?? '';
    const external = Boolean(e.data.external);
    return {
      command: e.data.command,
      aliases: [...e.data.aliases],
      blurb: e.data.blurb,
      href: e.data.external ?? `/${e.data.command}`,
      external,
      hidden: e.data.hidden,
      size: external
        ? (e.data.external as string).length
        : Buffer.byteLength(body, 'utf8'),
      date: dateOf(e),
      excerpt: external ? '' : excerptOf(body),
    };
  });
}
