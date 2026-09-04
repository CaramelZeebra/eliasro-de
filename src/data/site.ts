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
  /** Index epigraph. A statement of method, not of biography. */
  epigraph:
    'Anything I do I insist on doing correctly, and so everything I engage ' +
    'with that sees the light of day is properly typeset, organised, and has ' +
    'received my stamp of approval. I will, however, never write a second ' +
    'draft. My thoughts are received in their most natural state.',
  year: 'mmxxvi',
} as const;
