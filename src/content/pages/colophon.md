---
command: colophon
blurb: how this is set
order: 50
---
An account of how this site is put together, for the two or three people who
wonder about such things.

## type

Everything here is Computer Modern, which Donald Knuth drew for TeX in 1978
after seeing what had been done to the second edition of his own book. It
comes in cuts; this site uses two. The typewriter cut sets the frame — the
index, the labels, the prompt, and every rule on the page. The roman cut sets
prose, including this sentence.

## rules

Every horizontal line here is the character `─`, typed. Not one of them is a
border, a background, or a one-pixel div.


Most monospaced faces omit box-drawing glyphs altogether, and several that do
include them get the widths wrong. This one does not, which is the only
reason the site looks the way it does.

## weight

Both cuts were subsetted to the characters actually used and nothing further:
Latin, punctuation, arrows, and the box-drawing range. That took them from
1.06 MB to 94 KB. Nothing is fetched from anyone else's server, and no page
but one ships a line of framework JavaScript.

## the prompt

The line at the foot of the page is convenient however everything it can reach is an ordinary link as well, the page is finished
before it runs, and it removes itself entirely where JavaScript is
unavailable.

## what is not here

No cookies, no analytics, no consent notice. An earlier version of this site
made an elaborate and long-running joke about biscuits, which did not survive
the edit.

One room did, but it is unlisted.

## the rest

Built with Astro, compiled to static files on push, and served by GitHub
Pages. Written in one draft, as is the custom around these parts.
