import { useMemo, type CSSProperties } from 'react';
import { site } from '../content/site';

// Over-the-shoulder view of a writer's study.
// Composition (back → front): ceiling, teal wainscot wall, built-in bookshelf
// (left), framed pictures (right), mahogany desk, paper / pen / inkwell.
// Camera dolly: parent <App/> animates a single transform on `.lib-camera`
// so the whole scene scales + lifts toward the page.

type Vibe = 'study' | 'modernist' | 'attic' | 'monastic';

interface Palette {
  ceiling: string;
  wall: string;
  wall2: string;
  wallDark: string;
  floor: string;
  floor2: string;
  rug: string;
  rug2: string;
  desk: string;
  desk2: string;
  deskEdge: string;
  shelf: string;
  shelf2: string;
  lamp: string;
  lampShade: string;
  accent: string;
  ink: string;
  frame: string;
  mat: string;
  leather: string;
  leather2: string;
  skin: string;
  hair: string;
}

interface LibraryProps {
  vibe?: Vibe;
  onPaperEnter?: () => void;
  progress?: number;
}

export default function LibraryScene({
  vibe = 'study',
  onPaperEnter,
  progress = 0,
}: LibraryProps) {
  const palette = scenePalette(vibe);

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const scale = lerp(1, 3.0, progress);
  const ty = lerp(0, 14, progress);
  const cameraStyle: CSSProperties = {
    transform: `translate(-50%, calc(-50% + ${ty}%)) scale(${scale})`,
  };

  const sceneVars = {
    '--floor': palette.floor,
    '--floor2': palette.floor2,
    '--wall': palette.wall,
    '--wall2': palette.wall2,
    '--wall-dark': palette.wallDark,
    '--rug': palette.rug,
    '--rug2': palette.rug2,
    '--desk': palette.desk,
    '--desk2': palette.desk2,
    '--desk-edge': palette.deskEdge,
    '--shelf': palette.shelf,
    '--shelf2': palette.shelf2,
    '--lamp': palette.lamp,
    '--lamp-shade': palette.lampShade,
    '--accent': palette.accent,
    '--ink': palette.ink,
    '--ceiling': palette.ceiling,
    '--frame': palette.frame,
    '--mat': palette.mat,
    '--leather': palette.leather,
    '--leather2': palette.leather2,
    '--skin': palette.skin,
    '--hair': palette.hair,
  } as CSSProperties;

  return (
    <div className="lib-scene" style={sceneVars}>
      <div className="lib-camera" style={cameraStyle}>
        <div className="lib-ceiling">
          <div className="lib-ceiling-beam" />
        </div>

        <div className="lib-wall">
          <div className="lib-wall-paneling" />
          <div className="lib-chair-rail" />
        </div>

        <div className="lib-shelfwall">
          <div className="lib-shelfwall-frame" />
          <BackshelfBank vibe={vibe} />
        </div>

        <FrameCluster />

        <Desk onPaperEnter={onPaperEnter} />
      </div>

      <div className="lib-vignette" />
      <Motes />
    </div>
  );
}

function scenePalette(vibe: Vibe): Palette {
  const base: Record<Vibe, Palette> = {
    study: {
      ceiling: '#3a2818',
      wall: '#365c54', wall2: '#264742', wallDark: '#1a2e2a',
      floor: '#3a2418', floor2: '#1f1108',
      rug: '#8a2818', rug2: '#5a1810',
      desk: '#7a4828', desk2: '#4a2a18', deskEdge: '#a06840',
      shelf: '#4a2c1a', shelf2: '#2a1810',
      lamp: '#ffe5a0', lampShade: '#1f5240',
      accent: '#c98b3a', ink: '#0a0805',
      frame: '#3a2818', mat: '#e8dfc8',
      leather: '#3a1f12', leather2: '#1f0f08',
      skin: '#5a3a28', hair: '#1a0f08',
    },
    modernist: {
      ceiling: '#d2c8b4',
      wall: '#dcd6c6', wall2: '#c0bba9', wallDark: '#a59e8a',
      floor: '#c9a781', floor2: '#a98660',
      rug: '#7a8276', rug2: '#525c50',
      desk: '#d4b08c', desk2: '#9a7b58', deskEdge: '#c9a781',
      shelf: '#a98660', shelf2: '#8a6648',
      lamp: '#fff3d9', lampShade: '#3a4a3a',
      accent: '#3a4a3a', ink: '#1a1a1a',
      frame: '#2a2a2a', mat: '#f0eadc',
      leather: '#7a5a3a', leather2: '#4a3522',
      skin: '#c89980', hair: '#3a2a1a',
    },
    attic: {
      ceiling: '#1a1208',
      wall: '#2a2218', wall2: '#1a140c', wallDark: '#100a06',
      floor: '#2a1d12', floor2: '#15100a',
      rug: '#7a3818', rug2: '#4a2010',
      desk: '#583720', desk2: '#2c1a10', deskEdge: '#6a4628',
      shelf: '#15100a', shelf2: '#241810',
      lamp: '#ffce5c', lampShade: '#3a2818',
      accent: '#d4a04a', ink: '#0a0805',
      frame: '#1a0f08', mat: '#d6c8a8',
      leather: '#3a1810', leather2: '#1f0a06',
      skin: '#5a3a28', hair: '#100806',
    },
    monastic: {
      ceiling: '#5d503e',
      wall: '#7a6a52', wall2: '#5d503e', wallDark: '#4a3f30',
      floor: '#7a6b56', floor2: '#5d503e',
      rug: '#8a3320', rug2: '#5e2516',
      desk: '#6a4a30', desk2: '#4a3220', deskEdge: '#7a5a3a',
      shelf: '#5d503e', shelf2: '#3a3026',
      lamp: '#ffe0a0', lampShade: '#3a3024',
      accent: '#a86a32', ink: '#1d1006',
      frame: '#3a2a18', mat: '#e8dcb6',
      leather: '#4a2818', leather2: '#2a1408',
      skin: '#a87a58', hair: '#2a1810',
    },
  };
  return base[vibe] || base.study;
}

interface BookSpine {
  w: number;
  h: number;
  tilt: number;
  color: string;
  band: boolean;
}

function BackshelfBank({ vibe }: { vibe: Vibe }) {
  const colors = paletteBookColors(vibe);
  const shelves = useMemo<BookSpine[][]>(() => {
    let s = 13;
    const rng = () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
    return Array.from({ length: 5 }, () =>
      Array.from({ length: 9 + Math.floor(rng() * 3) }, () => ({
        w: 6 + rng() * 5,
        h: 70 + rng() * 26,
        tilt: rng() < 0.08 ? (rng() - 0.5) * 14 : 0,
        color: colors[Math.floor(rng() * colors.length)],
        band: rng() < 0.3,
      })),
    );
  }, [vibe]);
  return (
    <div className="lib-bookbank">
      {shelves.map((row, i) => (
        <div key={i} className="lib-bookshelf-row">
          <div className="lib-bookshelf-board" />
          <div className="lib-bookshelf-books">
            {row.map((b, j) => (
              <div
                key={j}
                className="lib-bb-book"
                style={{
                  width: b.w + '%',
                  height: b.h + '%',
                  background: b.color,
                  transform: b.tilt ? `rotate(${b.tilt}deg)` : undefined,
                }}
              >
                {b.band && <span className="lib-bb-band" />}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function paletteBookColors(vibe: Vibe): string[] {
  return vibe === 'modernist'
    ? ['#7c8a78', '#a89274', '#b8a485', '#5a6e5a', '#8a7560', '#c9b08a', '#9aa898']
    : vibe === 'attic'
    ? ['#6a3022', '#3d2416', '#5a4020', '#7a5020', '#3a2a18', '#5d3018', '#4a2818']
    : vibe === 'monastic'
    ? ['#5a3826', '#7a4a32', '#8a5a3a', '#6a3826', '#4a2e1e', '#9a6a3a', '#5d3a24']
    : ['#7d3a2e', '#3a2a4a', '#1f3a4d', '#5a4020', '#2d2018', '#6a2818', '#c08840', '#4a2a2a', '#3d2418'];
}

function FrameCluster() {
  return (
    <div className="lib-frames">
      <div className="lib-frame f-large" style={{ left: '8%', top: '8%', width: '44%', height: '55%' }}>
        <div className="lib-frame-mat"><span className="lib-frame-label">portrait</span></div>
      </div>
      <div className="lib-frame f-med" style={{ left: '60%', top: '10%', width: '32%', height: '30%' }}>
        <div className="lib-frame-mat"><span className="lib-frame-label">landscape</span></div>
      </div>
      <div className="lib-frame f-small" style={{ left: '60%', top: '44%', width: '20%', height: '22%' }}>
        <div className="lib-frame-mat"><span className="lib-frame-label">photo</span></div>
      </div>
      <div className="lib-frame f-small" style={{ left: '82%', top: '44%', width: '14%', height: '22%' }}>
        <div className="lib-frame-mat"><span className="lib-frame-label">sketch</span></div>
      </div>
    </div>
  );
}

function Desk({ onPaperEnter }: { onPaperEnter?: () => void }) {
  return (
    <div className="lib-desk">
      <div className="lib-desk-back-edge" />
      <div className="lib-desk-top">
        <div className="lib-desk-grain" />

        <div className="lib-ink">
          <div className="lib-ink-body" />
          <div className="lib-ink-top" />
        </div>

        <div className="lib-paper" id="paper-target" onMouseEnter={onPaperEnter}>
          <PaperContents />
        </div>

        <div className="lib-pen">
          <div className="lib-pen-body" />
          <div className="lib-pen-nib" />
        </div>
      </div>
      <div className="lib-desk-front" />
    </div>
  );
}

interface Mote {
  x: number;
  y: number;
  s: number;
  d: number;
  o: number;
}

function Motes() {
  const motes = useMemo<Mote[]>(
    () =>
      Array.from({ length: 22 }, () => ({
        x: Math.random() * 100,
        y: Math.random() * 60,
        s: 1 + Math.random() * 1.6,
        d: 6 + Math.random() * 14,
        o: 0.18 + Math.random() * 0.4,
      })),
    [],
  );
  return (
    <div className="lib-motes">
      {motes.map((m, i) => (
        <div
          key={i}
          className="lib-mote"
          style={{
            left: m.x + '%',
            top: m.y + '%',
            width: m.s + 'px',
            height: m.s + 'px',
            animationDuration: m.d + 's',
            opacity: m.o,
          }}
        />
      ))}
    </div>
  );
}

function PaperContents() {
  const { meta, paperPreview } = site;
  const html = (s: string) => ({ __html: s });
  return (
    <div className="latex-page">
      <div className="latex-title">{meta.name}</div>
      <div className="latex-subtitle" dangerouslySetInnerHTML={html(`<i>${meta.subtitle}</i>`)} />
      <div className="latex-author">{meta.name}</div>
      <div className="latex-affiliation"><i>Trinity College Dublin</i></div>
      <div className="latex-abstract-head">Abstract</div>
      <div className="latex-abstract" dangerouslySetInnerHTML={html(`<i>${meta.abstract.split('. ')[0]}.</i>`)} />
      <div className="latex-section"><span className="latex-num">{paperPreview.section1.num}</span> {paperPreview.section1.title}</div>
      <div className="latex-body" dangerouslySetInnerHTML={html(paperPreview.section1.body)} />
      <div className="latex-section"><span className="latex-num">{paperPreview.section2.num}</span> {paperPreview.section2.title}</div>
      <div className="latex-body" dangerouslySetInnerHTML={html(paperPreview.section2.body)} />
      <div className="latex-prompt"><span>Hover to read &rarr;</span></div>
      <div className="latex-foot"><div>1</div></div>
    </div>
  );
}
