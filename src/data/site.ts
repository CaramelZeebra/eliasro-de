// The only hard-coded strings on the site. Everything else is content files.
export const site = {
  name: 'elias rode',
  place: 'dublin',
  /** Used for <title>, OG tags, and the description meta. */
  tagline: 'a small index',
  description:
    'Elias Rode — a small index of things built, things cooked, and things worth keeping.',
  /** Footer colophon. Set in the typewriter cut; keep it to one line. */
  colophon: 'set in computer modern',
  year: 'mmxxvi',
} as const;
