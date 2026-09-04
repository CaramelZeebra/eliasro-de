# eliasro.de

A small index. Astro, static, no framework JavaScript except on one route.

## Adding a page

Drop a markdown file into `src/content/pages/`:

```markdown
---
command: publications     # the URL slug, and the word typed at the prompt
blurb: things written     # middle column of the index
note: 2027—               # right column; optional
order: 25                 # ascending; ties break alphabetically
---

Body, in markdown. Set in Computer Modern Roman.
```

That is the whole step. The file adds a row to the index, a route at
`/publications`, a command at the prompt, an entry in `ls`, and a
tab-completion. There is nothing else to register.

Optional frontmatter:

| Field      | Effect                                                        |
| ---------- | ------------------------------------------------------------- |
| `external` | Row links off-site; no page is built and the body is ignored.  |
| `hidden`   | Absent from the index, from `ls`, and from tab-completion.     |
| `aliases`  | Extra words that resolve to this entry at the prompt.          |
| `title`    | Page heading. Defaults to `command`.                           |
| `custom`   | A hand-written page already serves this route; skip generation.|

## Typography

Everything is Computer Modern, in two cuts: **CMU Typewriter** for the frame
(index, rules, labels, prompt) and **CMU Serif** for prose. Both are subsetted
to the ranges actually used — about 105 KB in total.

The typewriter cut is a true monospace whose box-drawing glyphs share the
letter advance width exactly, so every horizontal rule on the site is the
character `─` rather than a CSS border. Rules are typeset, not drawn. If you
change the frame, keep it that way — it is the whole look.

Subsetting, if the fonts are ever regenerated:

```sh
pyftsubset FONT.woff2 --flavor=woff2 --output-file=OUT.woff2 \
  --unicodes='U+0020-007E,U+00A0-00FF,U+2010-2015,U+2018-201A,U+201C-201E,U+2020-2022,U+2026,U+2190-2193,U+2500-257F' \
  --layout-features='kern,liga' --no-hinting
```

## Connect 4

`/connect4` is preserved verbatim from the previous version of the site,
including its solver, its opening book and its original palette. It is
quarantined in `src/legacy/connect4/` with a self-contained stylesheet that
carries its own fonts and tokens; nothing it uses leaks into the rest of the
site, and no other route loads any of it. It is the only route that ships
React.

It is unlisted on purpose. Type `c4` at the prompt.

## Commands

```sh
npm install
npm run dev      # localhost:4321
npm run build
npm run preview
```

Deployed to GitHub Pages on push to `main`.
