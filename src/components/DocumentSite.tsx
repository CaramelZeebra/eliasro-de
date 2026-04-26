import { useState, useEffect } from 'react';
import { site } from '../content/site';

type DocStyle = 'latex' | 'manuscript' | 'letter';
type Layout = 'single' | 'spread' | 'scroll';
type FlipDir = 'next' | 'prev' | null;

const PAGES = site.pages;
type PageId = (typeof PAGES)[number]['id'];

interface DocumentSiteProps {
  docStyle?: DocStyle;
  layout?: Layout;
  onReturn?: () => void;
}

// Inline HTML helper — content fields in site.ts are HTML strings.
const Html = ({ as: Tag = 'span', html, ...rest }: { as?: keyof JSX.IntrinsicElements; html: string } & Record<string, unknown>) => (
  // @ts-expect-error — dynamic tag
  <Tag {...rest} dangerouslySetInnerHTML={{ __html: html }} />
);

export default function DocumentSite({
  docStyle = 'latex',
  layout = 'single',
  onReturn,
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

  // next/prev step from the in-flight target if there is one — so two rapid
  // → presses go to current+2, not current+1.
  const next = () => {
    const baseline = flipping ? target : current;
    goto(Math.min(baseline + 1, PAGES.length - 1));
  };
  const prev = () => {
    const baseline = flipping ? target : current;
    goto(Math.max(baseline - 1, 0));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') next();
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') prev();
      else if (e.key === 'Home') goto(0);
      else if (e.key === 'End') goto(PAGES.length - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className={`doc-site doc-style-${docStyle} doc-layout-${layout}`}>
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
        <ol className="doc-toc">
          {PAGES.map((p, i) => (
            <li key={p.id}>
              <button
                className={`doc-toc-item ${i === current ? 'is-current' : ''}`}
                onClick={() => goto(i)}
              >
                <span className="toc-num">{p.num}</span>
                <span className="toc-label">{p.label}</span>
              </button>
            </li>
          ))}
        </ol>
        <button
          className="doc-nav-arrow"
          onClick={next}
          disabled={current === PAGES.length - 1}
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
        {page.id === 'cv' && <PageCV />}
        {page.id === 'contact' && <PageContact />}
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
          p.id === 'title' ? null : (
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
      <Section num="6" title="Curriculum Vitæ" />
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
    </>
  );
}

function PageContact() {
  const { contact } = site;
  return (
    <>
      <Section num="7" title="Correspondence" />
      <div className="latex-body">{contact.intro}</div>

      <div className="latex-contact-grid">
        {contact.items.map((c) => (
          <div className="contact-row" key={c.key}>
            <Html as="div" className="contact-key" html={c.key} />
            <Html
              as="div"
              className={c.mono ? 'contact-val mono' : 'contact-val'}
              html={c.value}
            />
          </div>
        ))}
      </div>

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
