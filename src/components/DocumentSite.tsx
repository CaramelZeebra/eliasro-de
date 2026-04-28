import { useState, useEffect, useRef, createContext, useContext } from 'react';
import { site } from '../content/site';
import type { BlogPost } from './App';
import type { Account } from './useAccount';
import { fibCost } from './useAccount';

type DocStyle = 'latex' | 'manuscript' | 'letter';
type Layout = 'single' | 'spread' | 'scroll';
type FlipDir = 'next' | 'prev' | null;

const PAGES = site.pages;
type PageId = (typeof PAGES)[number]['id'];

// Pages reachable only via in-app actions (account menu, store link),
// hidden from TOC, Contents, and natural-flow nav (arrow keys, swipe…).
const HIDDEN_IDS = new Set<string>(['merch', 'chat']);

interface DocumentSiteProps {
  docStyle?: DocStyle;
  layout?: Layout;
  onReturn?: () => void;
  posts?: BlogPost[];
  account?: Account;
}

// Context so deeply-nested page renderers can read posts without
// prop-drilling through PageContents.
const PostsContext = createContext<BlogPost[]>([]);
const usePosts = () => useContext(PostsContext);

const AccountContext = createContext<Account | null>(null);
const useAccountCtx = () => useContext(AccountContext);

// Inline HTML helper — content fields in site.ts are HTML strings.
const Html = ({ as: Tag = 'span', html, ...rest }: { as?: keyof JSX.IntrinsicElements; html: string } & Record<string, unknown>) => (
  // @ts-expect-error — dynamic tag
  <Tag {...rest} dangerouslySetInnerHTML={{ __html: html }} />
);

export default function DocumentSite({
  docStyle = 'latex',
  layout = 'single',
  onReturn,
  posts = [],
  account,
}: DocumentSiteProps) {
  const [current, setCurrent] = useState(0);
  const [flipping, setFlipping] = useState<FlipDir>(null);
  const [flipFromIdx, setFlipFromIdx] = useState(0);
  // The page we're flipping TO. Tracked so multi-page jumps (e.g. clicking
  // a TOC entry from page 1 to page 5) reveal the correct destination
  // underneath / on the back of the flap, instead of the +1 neighbour.
  const [target, setTarget] = useState(0);

  // goto handles four cases so rapid input feels responsive:
  //   1. i === current && idle      → no-op
  //   2. i === current && flipping  → cancel: stop the flap, stay put
  //                                   (the in-flight flip's destination is now
  //                                   our current page, ie user changed mind)
  //   3. same direction in flight   → retarget; back-face & under-page rerender
  //                                   to the new destination, animation continues
  //   4. fresh flip / reversal      → start (or restart) flip in the right dir
  const goto = (i: number) => {
    if (i === current && !flipping) return;
    if (i === current && flipping) {
      setFlipping(null);
      setTarget(current);
      return;
    }
    const dir: FlipDir = i > current ? 'next' : 'prev';
    if (flipping === dir) {
      setTarget(i);
      return;
    }
    setFlipFromIdx(current);
    setTarget(i);
    setFlipping(dir);
  };

  const onFlipEnd = (e: React.AnimationEvent<HTMLDivElement>) => {
    // The flip element has multiple animations (rotate + front/back shades);
    // only react to the rotation completing.
    if (e.animationName !== 'flipNext' && e.animationName !== 'flipPrev') return;
    setCurrent(target);
    setFlipping(null);
  };

  // (See HIDDEN_IDS at module scope.)
  const visibleIndices = PAGES.map((_, i) => i).filter(
    (i) => !HIDDEN_IDS.has(PAGES[i].id),
  );
  const lastVisibleIdx = visibleIndices[visibleIndices.length - 1];
  const isHidden = (i: number) => HIDDEN_IDS.has(PAGES[i]?.id);

  const next = () => {
    const baseline = flipping ? target : current;
    if (isHidden(baseline)) return;
    const pos = visibleIndices.indexOf(baseline);
    const nxt = visibleIndices[pos + 1];
    if (nxt !== undefined) goto(nxt);
  };
  const prev = () => {
    const baseline = flipping ? target : current;
    if (isHidden(baseline)) {
      goto(lastVisibleIdx);
      return;
    }
    const pos = visibleIndices.indexOf(baseline);
    const pv = visibleIndices[pos - 1];
    if (pv !== undefined) goto(pv);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') next();
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') prev();
      else if (e.key === 'Home') goto(visibleIndices[0]);
      else if (e.key === 'End') goto(lastVisibleIdx);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // External navigation requests (from AccountWidget — "merch store" link).
  useEffect(() => {
    const onNav = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail !== 'string') return;
      const idx = PAGES.findIndex((p) => p.id === detail);
      if (idx >= 0) goto(idx);
    };
    window.addEventListener('eliasro:navigate', onNav);
    return () => window.removeEventListener('eliasro:navigate', onNav);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });

  // Touch swipe: horizontal, > 60px, mostly horizontal, < 800ms.
  const touchRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchRef.current;
    touchRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const dt = Date.now() - start.t;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5 && dt < 800) {
      if (dx < 0) next();
      else prev();
    }
  };

  return (
    <AccountContext.Provider value={account ?? null}>
    <PostsContext.Provider value={posts}>
    <div
      className={`doc-site doc-style-${docStyle} doc-layout-${layout}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <button
        className="doc-side-btn doc-side-prev"
        onClick={prev}
        disabled={!flipping && current === 0}
        aria-label="Previous page"
        type="button"
      >&larr;</button>
      <button
        className="doc-side-btn doc-side-next"
        onClick={next}
        disabled={!flipping && (isHidden(current) || current === lastVisibleIdx)}
        aria-label="Next page"
        type="button"
      >&rarr;</button>
      <div className="doc-stage">
        {/* The under page only exists during a flip — it's the destination
            being revealed under the flap. Rendering it permanently created
            a second scroll surface stacked under the current page; you'd
            scroll the top one and the static duplicate underneath would
            show through gaps in the letterforms. */}
        {flipping && (
          <div className="doc-page doc-page-under">
            <PageContents page={PAGES[target]} />
          </div>
        )}

        {flipping && <div className={`flip-shadow flip-${flipping}`} />}

        {flipping && (
          <div
            className={`doc-page doc-page-flip flip-${flipping}`}
            onAnimationEnd={onFlipEnd}
          >
            <div className="flip-front">
              <PageContents page={PAGES[flipFromIdx]} />
            </div>
            <div className="flip-back">
              <PageContents page={PAGES[target]} />
            </div>
          </div>
        )}

        {!flipping && (
          <div className="doc-page doc-page-current">
            <PageContents page={PAGES[current]} onGoto={goto} />
          </div>
        )}
      </div>

      <nav className="doc-nav">
        <button
          className="doc-nav-arrow"
          onClick={prev}
          disabled={current === 0}
          aria-label="Previous page"
        >
          &larr;
        </button>
        {/* note: doc-nav is hidden when on merch via .doc-toc filter; the
            arrows still fire prev/next which know to handle merch correctly. */}
        <ol className="doc-toc">
          {PAGES.map((p, i) =>
            HIDDEN_IDS.has(p.id) ? null : (
              <li key={p.id}>
                <button
                  className={`doc-toc-item ${i === current ? 'is-current' : ''}`}
                  onClick={() => goto(i)}
                >
                  <span className="toc-num">{p.num}</span>
                  <span className="toc-label">{p.label}</span>
                </button>
              </li>
            ),
          )}
        </ol>
        <button
          className="doc-nav-arrow"
          onClick={next}
          disabled={isHidden(current) || current === lastVisibleIdx}
          aria-label="Next page"
        >
          &rarr;
        </button>
      </nav>

      {onReturn && (
        <button className="doc-return" onClick={onReturn} title="Return to library">
          <span>&#8682;</span> return to library
        </button>
      )}
    </div>
    </PostsContext.Provider>
    </AccountContext.Provider>
  );
}

function PageContents({
  page,
  onGoto,
}: {
  page: { id: PageId; num: string; label: string };
  onGoto?: (i: number) => void;
}) {
  return (
    <div className="latex-page latex-page-full">
      <div className="latex-scroll">
        {page.id === 'title' && <PageTitle onGoto={onGoto} />}
        {page.id === 'about' && <PageAbout />}
        {page.id === 'works' && <PageWorks />}
        {page.id === 'writing' && <PageWriting />}
        {page.id === 'reading' && <PageReading />}
        {page.id === 'now' && <PageNow />}
        {page.id === 'studies' && <PageStudies />}
        {page.id === 'cv' && <PageCV />}
        {page.id === 'blog' && <PageBlog />}
        {page.id === 'links' && <PageLinks />}
        {page.id === 'contact' && <PageContact />}
        {page.id === 'merch' && <PageMerch />}
        {page.id === 'chat' && <PageChat />}
      </div>
      <div className="latex-foot">
        <div>{page.num}</div>
        <Html as="div" className="latex-foot-meta" html={`compiled ${site.meta.compiledDate}`} />
      </div>
    </div>
  );
}

// ───────────────────────── page renderers ─────────────────────────

function Section({ num, title }: { num: string; title: string }) {
  return (
    <div className="latex-section">
      <span className="latex-num">{num}</span> {title}
    </div>
  );
}

function PageTitle({ onGoto }: { onGoto?: (i: number) => void }) {
  const { meta } = site;
  return (
    <>
      <div className="latex-title">{meta.name}</div>
      <Html as="div" className="latex-subtitle" html={`<i>${meta.subtitle}</i>`} />
      <div className="latex-author">{meta.name}</div>
      <Html as="div" className="latex-affiliation" html={`<i>${meta.affiliation}</i>`} />

      <div className="latex-abstract-head">Abstract</div>
      <Html as="div" className="latex-abstract" html={`<i>${meta.abstract}</i>`} />

      <div className="latex-toc-head">Contents</div>
      <ol className="latex-toc">
        {site.pages.map((p, idx) =>
          p.id === 'title' || HIDDEN_IDS.has(p.id) ? null : (
            <li key={p.id}>
              <button
                className="latex-toc-link"
                onClick={() => onGoto?.(idx)}
                type="button"
              >
                <span className="t-num">{p.num}</span>
                <span className="t-name">{p.label}</span>
                <span className="t-dot" />
                <span className="t-pg">{idx + 1}</span>
              </button>
            </li>
          ),
        )}
      </ol>
    </>
  );
}

function PageAbout() {
  const { about } = site;
  return (
    <>
      <Section num="1" title="About" />
      {about.intro.map((p, i) => (
        <Html key={i} as="div" className="latex-body" html={p} />
      ))}

      <Section num={about.inhabitations.num} title={about.inhabitations.title} />
      <Html as="div" className="latex-body" html={about.inhabitations.body} />

      <Section num={about.pursuits.num} title={about.pursuits.title} />
      {about.pursuits.paragraphs.map((p, i) => (
        <Html key={i} as="div" className="latex-body" html={p} />
      ))}
    </>
  );
}

function PageWorks() {
  const { works } = site;
  return (
    <>
      <Section num="2" title="Works" />
      <Html as="div" className="latex-body" html={works.intro} />
      {works.items.map((w) => (
        <div className="latex-work" key={w.num}>
          <div className="latex-work-head">
            <span className="latex-work-num">{w.num}</span>
            <span className="latex-work-title">{w.title}</span>
            <span className="latex-work-meta">{w.meta}</span>
          </div>
          <Html as="div" className="latex-work-body" html={w.body} />
        </div>
      ))}
    </>
  );
}

function PageWriting() {
  const { writing } = site;
  return (
    <>
      <Section num="3" title="Writing &amp; Announcements" />
      <Html as="div" className="latex-body" html={writing.intro} />

      {writing.items.length > 0 && (
        <ul className="latex-bibitems">
          {writing.items.map((w) => (
            <li key={w.num}>
              <span className="bib-num">{w.num}</span>
              <span className="bib-body">
                <span className="bib-title">{w.title}</span>
                <Html as="span" className="bib-meta" html={w.meta} />
                <Html as="span" className="bib-blurb" html={w.blurb} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function PageReading() {
  const { reading } = site;
  return (
    <>
      <Section num="4" title="Reading" />
      <Html as="div" className="latex-body" html={reading.intro} />
      <table className="latex-bib-tab">
        <thead>
          <tr><th>Date</th><th>Year</th><th>Title</th><th>Rating</th><th>Note</th></tr>
        </thead>
        <tbody>
          {reading.items.map((row, i) => (
            <tr key={i}>
              <td className="mono">{row[0]}</td>
              <td className="mono">{row[1]}</td>
              <td><i>{row[2]}</i></td>
              <td>{row[3]}</td>
              <td className="muted">{row[4]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="latex-marginalia">
        <Html as="div" className="margin-note" html={reading.marginNote} />
      </div>
    </>
  );
}

function PageNow() {
  const { now } = site;
  return (
    <>
      <Section num="5" title="Now" />
      <Html as="div" className="latex-body" html={now.intro} />

      <div className="latex-now-grid">
        {now.blocks.map((b) => (
          <div className="now-block" key={b.num}>
            <div className="now-head">{b.num} — {b.label}</div>
            <Html as="div" className="now-body" html={b.body} />
          </div>
        ))}
      </div>
    </>
  );
}

function PageStudies() {
  const { studies } = site;
  return (
    <>
      <Section num="6" title="Studies" />
      <Html as="div" className="latex-body" html={studies.intro} />
      {studies.blocks.map((b) => (
        <div key={b.num}>
          <Section num={b.num} title={b.title} />
          <Html
            as="div"
            className="latex-modules"
            html={b.modules.join(' &middot; ') + '.'}
          />
        </div>
      ))}
    </>
  );
}

function PageCV() {
  const { cv } = site;
  const renderRow = (
    when: string,
    body: React.ReactNode,
    loc?: string,
  ) => (
    <div className="latex-cv-row" key={when + (loc ?? '')}>
      <div className="cv-when">
        <Html as="span" html={when} />
        {loc && <span className="cv-loc">{loc}</span>}
      </div>
      <div className="cv-what">{body}</div>
    </div>
  );

  return (
    <>
      <Section num="7" title="Curriculum Vitæ" />
      <Html as="div" className="latex-body" html={cv.intro} />

      <Section num={cv.education.num} title={cv.education.title} />
      {cv.education.rows.map((r, i) =>
        renderRow(
          r.when,
          <>
            <Html as="div" className="cv-place" html={r.place} />
            <Html as="div" className="cv-role" html={r.role} />
            {r.detail && <Html as="div" className="cv-detail muted" html={r.detail} />}
          </>,
          r.loc,
        ),
      )}

      <Section num={cv.experience.num} title={cv.experience.title} />
      {cv.experience.rows.map((r) =>
        renderRow(
          r.when,
          <>
            <Html as="div" className="cv-place" html={r.place} />
            <Html as="div" className="cv-role" html={r.role} />
          </>,
        ),
      )}

      <Section num={cv.skills.num} title={cv.skills.title} />
      {cv.skills.rows.map((r) =>
        renderRow(r.when, <Html as="span" className="muted" html={r.value} />),
      )}

      <Section num={cv.languages.num} title={cv.languages.title} />
      {cv.languages.rows.map((r) =>
        renderRow(r.when, <Html as="span" className="muted" html={r.value} />),
      )}
    </>
  );
}

function PageBlog() {
  const posts = usePosts();
  return (
    <>
      <Section num="8" title="Blog" />
      {posts.length === 0 ? (
        <div className="latex-body">
          <i>No entries yet.</i> New posts live in <code>src/content/blog/</code>;
          run <code>new-blog-post</code> from the launcher to start one.
        </div>
      ) : (
        posts.map((p) => (
          <article key={p.slug} className="blog-post">
            <header className="blog-post-head">
              <h3 className="blog-post-title">{p.title}</h3>
              <a
                className="blog-post-reply"
                href={`mailto:elias.rode@gmail.com?subject=${encodeURIComponent('Re: ' + p.title)}`}
              >
                [reply by email]
              </a>
              <time className="blog-post-date">{p.date}</time>
            </header>
            {p.summary && (
              <p className="blog-post-summary"><i>{p.summary}</i></p>
            )}
            <div
              className="blog-post-body"
              dangerouslySetInnerHTML={{ __html: p.bodyHtml }}
            />
            {p.gallery && p.gallery.length > 0 && (
              <div className="blog-gallery">
                {p.gallery.map((src) => (
                  <a key={src} href={src} target="_blank" rel="noopener">
                    <img src={src} alt="" loading="lazy" />
                  </a>
                ))}
              </div>
            )}
          </article>
        ))
      )}
    </>
  );
}

function PageLinks() {
  const { links } = site;
  return (
    <>
      <Section num="9" title="Links" />
      <Html as="div" className="latex-body" html={links.intro} />
      {links.items.length === 0 ? (
        <div className="latex-body"><i>No entries yet.</i></div>
      ) : (
        <ul className="links-list">
          {links.items.map((l) => (
            <li key={l.url}>
              <a className="latex-link" href={l.url} target="_blank" rel="noopener">
                {l.title}
              </a>
              {l.description && (
                <span className="links-desc"> &mdash; {l.description}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

// ───────────────────────── §M Merch store ─────────────────────────
//
// Hidden page (filtered from TOC and Contents). Reachable only from the
// account menu when signed in. Items consume Elias Points and the result
// is persisted as `account-purchases-<username>` in localStorage. Sign-out
// clears that key.

interface StaticItem {
  id: string;
  label: string;
  cost: number;
  description: string;
  /** True if the item should not even appear given current state. */
  hidden?: boolean;
  /** True if the buy action is blocked (sold OR pre-condition fails). */
  disabled?: boolean;
}

function PageMerch() {
  const account = useAccountCtx();

  if (!account || !account.username) {
    return (
      <>
        <Section num="M" title="Merch store" />
        <div className="latex-body">
          <i>Signed-in customers only. Please return after creating an account.</i>
        </div>
      </>
    );
  }

  const owned = (id: string) => account.purchases.has(id);

  // Highest-owned Fibonacci badge index (0 if none).
  let maxFib = 0;
  account.purchases.forEach((p) => {
    const m = /^fib-(\d+)$/.exec(p);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > maxFib) maxFib = n;
    }
  });

  // Fixed-price items. Once-and-done purchases; once SOLD they remain
  // visible but greyed out with the diagonal "SOLD" ribbon.
  const items: StaticItem[] = [
    {
      id: 'green-mode',
      label: 'Green mode',
      cost: 15,
      description:
        'Toggle the entire site to a verdant hue. Toggles off automatically on page load.',
    },
    {
      id: 'account-deletion',
      label: 'Account deletion',
      cost: 99,
      description:
        'Permanently removes your account from this device and reloads the page. Cannot be undone (you may, however, sign up again).',
    },
    {
      id: 'decline-cookies',
      label: 'Decline cookies',
      cost: 100,
      description: 'Disables the accrual of further Elias Points on this account.',
    },
    {
      id: 'accept-cookies',
      label: 'Accept cookies',
      cost: 100,
      description: 'Re-enables Elias-Point accrual on this account.',
    },
  ];

  // Fibonacci badges: all owned + the next purchasable. Labels carry the
  // cost (i.e. the badge's Fibonacci value) rather than the sequence index.
  const fibItems: StaticItem[] = [];
  const lastVisible = Math.max(maxFib + 1, 1);
  for (let n = 1; n <= lastVisible; n++) {
    const cost = fibCost(n);
    fibItems.push({
      id: `fib-${n}`,
      label: `Fibonacci Badge ${cost}`,
      cost,
      description: 'A small commemorative badge of negligible practical value.',
    });
  }

  const tryBuy = (id: string, cost: number) => {
    account.buy(id, cost);
  };

  const renderTile = (it: StaticItem) => {
    const isOwned = owned(it.id);
    const canAfford = account.isDev || account.points >= it.cost;
    return (
      <div
        key={it.id}
        className={`store-tile${isOwned ? ' is-sold' : ''}`}
      >
        <div className="store-tile-head">
          <span className="store-tile-name">{it.label}</span>
          <span className="store-tile-cost">
            {it.cost.toLocaleString()} pt{it.cost === 1 ? '' : 's'}
          </span>
        </div>
        <div className="store-tile-body">{it.description}</div>
        <div className="store-tile-action">
          {it.id === 'green-mode' && isOwned ? (
            <button
              type="button"
              className="store-tile-toggle"
              onClick={() => account.setGreenMode(!account.greenMode)}
            >
              {account.greenMode ? 'turn off' : 'turn on'}
            </button>
          ) : isOwned ? null : (
            <button
              type="button"
              className="store-tile-buy"
              disabled={!canAfford}
              onClick={() => {
                if (it.id === 'account-deletion') {
                  account.buy(it.id, it.cost);
                  // Defer slightly so the buy state persists, then wipe.
                  window.setTimeout(() => account.deleteAccount(), 60);
                  return;
                }
                if (it.id === 'decline-cookies') {
                  if (account.buy(it.id, it.cost)) account.setPointsConsent(false);
                  return;
                }
                if (it.id === 'accept-cookies') {
                  if (account.buy(it.id, it.cost)) account.setPointsConsent(true);
                  return;
                }
                tryBuy(it.id, it.cost);
              }}
            >
              {canAfford ? 'buy' : 'insufficient points'}
            </button>
          )}
        </div>
        {isOwned && <div className="store-tile-sold">SOLD</div>}
      </div>
    );
  };

  return (
    <>
      <Section num="M" title="Merch store" />
      <div className="latex-body">
        Items below are paid for in <strong>Elias Points</strong>. Purchases
        are permanent, non&#8209;transferable, and bound to your current
        account. Trading derivatives based on these collectibles is strictly
        against the{' '}
        <a
          className="latex-link"
          href="/more"
          target="_blank"
          rel="noopener noreferrer"
        >
          TOS
        </a>
        . Any fraudulent behaviour will result in account deletion and a
        complete reset of any purchased commodities.
      </div>
      <div className="store-meta">
        Balance: <strong>{account.isDev ? '∞' : account.points}</strong> Elias
        Points
      </div>
      <div className="store-grid">
        {items.map(renderTile)}
        {fibItems.map(renderTile)}
      </div>
      <div className="store-footer">
        <button
          type="button"
          className="store-footer-link"
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent('eliasro:navigate', { detail: 'chat' }),
            )
          }
        >
          → speak with the customer assistant
        </button>
      </div>
    </>
  );
}

// ─────────────────────── §C Chat (joke chatbot) ───────────────────────
//
// Hidden page reachable only from PageMerch's footer link. The bot
// "thinks" for 60s on every question and then declares "Out of Usage",
// offering an upgrade prompt. Buying Pro shows a debit-card form which
// stalls 15s and reports failure. If the typed card number passes Luhn,
// a small toast warns the user against entering real card details on
// random websites.

type ChatPhase =
  | 'idle'
  | 'thinking'
  | 'out-of-usage'
  | 'buying'
  | 'transaction-pending'
  | 'transaction-failed';

interface ChatMessage {
  from: 'bot' | 'user';
  text: string;
}

function luhnValid(num: string): boolean {
  const digits = num.replace(/\D/g, '');
  if (digits.length < 12 || digits.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function formatCardNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 19);
  return digits.replace(/(.{4})/g, '$1 ').trim();
}

function PageChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { from: 'bot', text: 'Welcome to the Customer Assistant. How may I help you today?' },
  ]);
  const [input, setInput] = useState('');
  const [phase, setPhase] = useState<ChatPhase>('idle');
  const [showLuhnTip, setShowLuhnTip] = useState(false);
  const luhnTipFiredRef = useRef(false);

  // Card form state
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  const thinkTimer = useRef<number | null>(null);
  const txTimer = useRef<number | null>(null);
  const tipTimer = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Cleanup all running timers on unmount.
  useEffect(() => {
    return () => {
      if (thinkTimer.current) window.clearTimeout(thinkTimer.current);
      if (txTimer.current) window.clearTimeout(txTimer.current);
      if (tipTimer.current) window.clearTimeout(tipTimer.current);
    };
  }, []);

  // Auto-scroll to the latest message whenever the list grows.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, phase]);

  const submitMsg = (e: React.FormEvent) => {
    e.preventDefault();
    if (phase !== 'idle' || !input.trim()) return;
    const q = input.trim();
    setInput('');
    setMessages((m) => [
      ...m,
      { from: 'user', text: q },
      { from: 'bot', text: 'Thinking…' },
    ]);
    setPhase('thinking');
    thinkTimer.current = window.setTimeout(() => {
      setMessages((m) => [
        ...m.slice(0, -1),
        { from: 'bot', text: 'Out of Usage.' },
      ]);
      setPhase('out-of-usage');
    }, 60_000);
  };

  const onBuyPro = () => setPhase('buying');
  const onWait = () => {
    setMessages((m) => [
      ...m,
      {
        from: 'bot',
        text: 'Free-tier usage will resume in approximately 4 hours. Please return then.',
      },
    ]);
    setPhase('idle');
  };

  const onCardNumberChange = (raw: string) => {
    const formatted = formatCardNumber(raw);
    setCardNumber(formatted);
    if (!luhnTipFiredRef.current && luhnValid(formatted)) {
      luhnTipFiredRef.current = true;
      setShowLuhnTip(true);
      tipTimer.current = window.setTimeout(() => setShowLuhnTip(false), 5000);
    }
  };

  const submitCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (phase !== 'buying') return;
    setPhase('transaction-pending');
    txTimer.current = window.setTimeout(() => {
      setPhase('transaction-failed');
    }, 15_000);
  };

  const closeBuyModal = () => {
    // Locked while a transaction is "processing" — clicking the backdrop or
    // close × during the 15s wait would otherwise silently cancel the
    // failure prompt.
    if (phase === 'transaction-pending') return;
    if (phase === 'buying' || phase === 'transaction-failed') {
      if (txTimer.current) window.clearTimeout(txTimer.current);
      setCardName(''); setCardNumber(''); setCardExpiry(''); setCardCvv('');
      setPhase('out-of-usage');
    }
  };

  const buyModalOpen =
    phase === 'buying' || phase === 'transaction-pending' || phase === 'transaction-failed';

  return (
    <>
      <Section num="C" title="Customer Assistant" />
      <div className="chatbot">
        <div className="chat-window">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`chat-msg ${m.from === 'bot' ? 'is-bot' : 'is-user'} ${
                m.text === 'Thinking…' ? 'is-thinking' : ''
              }`}
            >
              {m.text === 'Thinking…' ? (
                <span className="chat-thinking">
                  <span></span><span></span><span></span>
                </span>
              ) : (
                m.text
              )}
            </div>
          ))}
          {phase === 'out-of-usage' && (
            <div className="chat-prompt">
              <button
                type="button"
                className="chat-prompt-btn is-primary"
                onClick={onBuyPro}
              >
                Buy Pro
              </button>
              <button
                type="button"
                className="chat-prompt-btn"
                onClick={onWait}
              >
                Wait 4 hours
              </button>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <form className="chat-input" onSubmit={submitMsg}>
          <input
            className="chat-input-field"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              phase === 'thinking'
                ? 'Thinking…'
                : phase === 'out-of-usage'
                ? 'Out of Usage'
                : 'Type a question…'
            }
            disabled={phase !== 'idle'}
          />
          <button
            type="submit"
            className="chat-input-send"
            disabled={phase !== 'idle' || !input.trim()}
          >
            Send
          </button>
        </form>
      </div>

      {buyModalOpen && (
        <div
          className="account-modal-backdrop"
          onClick={closeBuyModal}
          role="presentation"
        >
          <div
            className="account-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <header className="account-modal-head">
              <h2 className="account-modal-title">Upgrade to Pro</h2>
              <button
                type="button"
                className="account-modal-close"
                onClick={closeBuyModal}
                disabled={phase === 'transaction-pending'}
                aria-label="Close"
              >
                ×
              </button>
            </header>
            {phase === 'buying' && (
              <form className="account-form" onSubmit={submitCard} autoComplete="off">
                <p className="account-prompt-body">
                  Enter your debit card details to continue. Your card will be
                  charged €19.99 today and renewed monthly until cancelled.
                </p>
                <label className="account-field">
                  <span className="account-field-label">Cardholder name</span>
                  <input
                    className="account-input"
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                    required
                  />
                </label>
                <label className="account-field">
                  <span className="account-field-label">Card number</span>
                  <input
                    className="account-input"
                    inputMode="numeric"
                    autoComplete="off"
                    spellCheck={false}
                    value={cardNumber}
                    onChange={(e) => onCardNumberChange(e.target.value)}
                    placeholder="0000 0000 0000 0000"
                    required
                  />
                </label>
                <div className="chat-card-row">
                  <label className="account-field">
                    <span className="account-field-label">Expiry</span>
                    <input
                      className="account-input"
                      inputMode="numeric"
                      autoComplete="off"
                      value={cardExpiry}
                      onChange={(e) => {
                        const d = e.target.value.replace(/\D/g, '').slice(0, 4);
                        setCardExpiry(d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d);
                      }}
                      placeholder="MM/YY"
                      required
                    />
                  </label>
                  <label className="account-field">
                    <span className="account-field-label">CVV</span>
                    <input
                      className="account-input"
                      type="password"
                      inputMode="numeric"
                      autoComplete="off"
                      value={cardCvv}
                      onChange={(e) =>
                        setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))
                      }
                      placeholder="•••"
                      required
                    />
                  </label>
                </div>
                <div className="account-actions">
                  <button type="submit" className="account-submit">
                    Pay €19.99
                  </button>
                  <button
                    type="button"
                    className="account-link"
                    onClick={closeBuyModal}
                  >
                    cancel
                  </button>
                </div>
              </form>
            )}
            {phase === 'transaction-pending' && (
              <div className="account-form">
                <p className="account-prompt-body">
                  Processing your payment…
                </p>
                <div className="chat-thinking chat-thinking-modal">
                  <span></span><span></span><span></span>
                </div>
              </div>
            )}
            {phase === 'transaction-failed' && (
              <div className="account-form">
                <div className="account-error">
                  ✗ Transaction failed. Please verify your details and try again.
                </div>
                <div className="account-actions">
                  <button
                    type="button"
                    className="account-submit"
                    onClick={() => setPhase('buying')}
                  >
                    Try again
                  </button>
                  <button
                    type="button"
                    className="account-link"
                    onClick={closeBuyModal}
                  >
                    close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showLuhnTip && (
        <div className="luhn-tip" role="status" aria-live="polite">
          <button
            type="button"
            className="luhn-tip-close"
            aria-label="Dismiss"
            onClick={() => setShowLuhnTip(false)}
          >
            ×
          </button>
          <strong>Tip: </strong>
          the author does not encourage sharing your actual card details with
          random websites.
        </div>
      )}
    </>
  );
}

function PageContact() {
  const { contact } = site;
  return (
    <>
      <Section num="10" title="Correspondence" />
      <div className="latex-body">{contact.intro}</div>

      <div className="latex-contact-grid">
        {contact.items.map((c, i) => (
          <div className="contact-row" key={`${c.key}-${i}`}>
            <Html as="div" className="contact-key" html={c.key} />
            <Html
              as="div"
              className={c.mono ? 'contact-val mono' : 'contact-val'}
              html={c.value}
            />
          </div>
        ))}
      </div>

      <Section num={contact.mailingList.num} title={contact.mailingList.title} />
      <Html as="div" className="latex-body" html={contact.mailingList.body} />

      <div className="latex-signoff">
        <div className="signoff-text">{contact.signoff.line}</div>
        <div className="signoff-name">{contact.signoff.name}</div>
      </div>

      <div className="latex-marginalia">
        <Html as="div" className="margin-note" html={contact.colophon} />
      </div>
    </>
  );
}
