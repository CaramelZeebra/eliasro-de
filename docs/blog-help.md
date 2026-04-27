# Blog post — quick reference

This file opens automatically alongside every new post created via the
"New blog post" launcher entry. Treat it as a cheat sheet; close it when
you're done (`:q` in the right-hand split if you're in nvim).

## Where things live

```
src/content/blog/<slug>.md          ← the post itself (markdown + frontmatter)
public/blog/<slug>/                  ← images for that post (jpg, png, webp, …)
```

The slug is derived from the title; reference images using the public path,
e.g. `/blog/<slug>/sunset.jpg`.

## Frontmatter

```yaml
---
title: Some title in plain text
date: 2026-04-27           # YYYY-MM-DD
summary: Optional one-line italic summary above the body.
gallery:                    # Optional picture-bundle, rendered as a grid
  - /blog/<slug>/photo-1.jpg
  - /blog/<slug>/photo-2.jpg
---
```

`summary` and `gallery` are both optional. Drop the keys entirely if unused.

## Body

Standard CommonMark Markdown:

- **bold**, *italic*, `inline code`
- [links](https://eliasro.de) — open in same tab by default
- Lists, both bulleted and numbered
- `## Heading 2`, `### Heading 3` for sections within the post
- Block quotes with `>`
- Code blocks with triple backticks

Inline images:

```markdown
![alt text](/blog/<slug>/file.jpg)
```

Drop the file in `public/blog/<slug>/` before committing.

## Workflow

1. Edit the post (this file is read-only by convention; the new post is in
   the *left* split).
2. Drop any images you reference into `public/blog/<slug>/`.
3. `:wq` (or close your editor). The launcher will ask whether to publish.
4. Choose **Yes** to commit + push; the deploy runs automatically.

## Editing or deleting an existing post

Open the source file directly:

```bash
nvim ~/Projects/eliasro-de/src/content/blog/<slug>.md
```

…edit, save. Then from the repo:

```bash
git add -A
git commit -m "Blog: edit <slug>"
git push
```

To delete: `rm src/content/blog/<slug>.md`, optionally also `rm -r public/blog/<slug>`, commit + push.

## Things you don't need to do

- No build step. CI runs `astro build` on push.
- No content registration. Any `*.md` file under `src/content/blog/` is
  picked up automatically.
- No image processing. Files served as-is from `public/`.

## If something looks wrong

Run `npm run dev` from the repo root and visit `http://localhost:4321`.
Edits hot-reload. The browser console will show frontmatter validation
errors (e.g. invalid `date`).
