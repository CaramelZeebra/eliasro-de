import { getCollection, type CollectionEntry } from 'astro:content';

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

/** The shape the prompt's client script needs. Kept deliberately small. */
export interface CommandSpec {
  command: string;
  aliases: string[];
  blurb: string;
  href: string;
  external: boolean;
  hidden: boolean;
}

export async function commandSpecs(): Promise<CommandSpec[]> {
  return (await allEntries()).map((e) => ({
    command: e.data.command,
    aliases: [...e.data.aliases],
    blurb: e.data.blurb,
    href: e.data.external ?? `/${e.data.command}`,
    external: Boolean(e.data.external),
    hidden: e.data.hidden,
  }));
}
