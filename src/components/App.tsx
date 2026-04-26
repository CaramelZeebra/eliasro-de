import { useState, useEffect, useCallback, useRef } from 'react';
import LibraryScene from './LibraryScene';
import DocumentSite from './DocumentSite';

// Canonical configuration. The handoff prototype exposed these as a Tweaks
// panel; in production we pin them and let the user re-enable tweaks later
// if desired.
const CONFIG = {
  vibe: 'study' as const,
  palette: 'warm' as const,
  docStyle: 'latex' as const,
  layout: 'single' as const,
  cameraSpeed: 2400,
  cameraEase: 'cinematic' as const,
  showInstructions: true,
};

const PALETTES = {
  warm: { paper: '#f3ead2', ink: '#2a2218', accent: '#7a2818' },
  cool: { paper: '#e9eaec', ink: '#1c2230', accent: '#1f3a5a' },
  sepia: { paper: '#ead7b3', ink: '#3a2a18', accent: '#8a4a1a' },
  parchment: { paper: '#ecdcb6', ink: '#2a1d10', accent: '#7a4020' },
  ash: { paper: '#dcd8cf', ink: '#1a1a1a', accent: '#6a6a6a' },
};

const easings: Record<string, (t: number) => number> = {
  cinematic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  snap: (t) => 1 - Math.pow(1 - t, 4),
  drift: (t) => 1 - Math.pow(1 - t, 2),
  linear: (t) => t,
};

type Stage = 'library' | 'zooming' | 'document';

// The library scene is composition-tuned for ≥900px (per the design's own
// README). On phones it clips; the paper-hover trigger also doesn't translate
// well to touch. Skip straight to the document on narrow viewports.
const initialStage = (): Stage =>
  typeof window !== 'undefined' && window.innerWidth < 900
    ? 'document'
    : 'library';

export default function App() {
  const [stage, setStage] = useState<Stage>(initialStage);
  const [progress, setProgress] = useState(0);
  const stageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const p = PALETTES[CONFIG.palette];
    document.documentElement.style.setProperty('--paper', p.paper);
    document.documentElement.style.setProperty('--ink', p.ink);
    document.documentElement.style.setProperty('--accent', p.accent);
  }, []);

  const triggerZoom = useCallback(() => {
    if (stage !== 'library') return;
    setStage('zooming');
    const dur = CONFIG.cameraSpeed;
    const start = performance.now();
    const ease = easings[CONFIG.cameraEase] ?? easings.cinematic;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      setProgress(ease(t));
      if (t < 1) raf = requestAnimationFrame(tick);
      else setTimeout(() => setStage('document'), 60);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [stage]);

  const onPaperEnter = () => triggerZoom();

  const t = stage === 'zooming' ? progress : 0;
  const sceneOpacity =
    stage === 'document'
      ? 0
      : stage === 'zooming'
      ? 1 - Math.max(0, (progress - 0.85) / 0.15) * 0.7
      : 1;

  const returnToLibrary = () => {
    setStage('library');
    setProgress(0);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="app-root">
      <div ref={stageRef} className="app-stage">
        {stage !== 'document' && (
          <div className="scene-camera" style={{ opacity: sceneOpacity }}>
            <LibraryScene
              vibe={CONFIG.vibe}
              onPaperEnter={onPaperEnter}
              progress={t}
            />
          </div>
        )}

        {stage === 'library' && CONFIG.showInstructions && (
          <div className="hint">
            <div className="hint-line">hover the page to read</div>
            <div className="hint-arrow">&darr;</div>
          </div>
        )}

        {stage === 'document' && (
          <div className="doc-mount">
            <DocumentSite
              docStyle={CONFIG.docStyle}
              layout={CONFIG.layout}
              onReturn={returnToLibrary}
            />
          </div>
        )}

        {stage !== 'library' && (
          <div
            className="paper-bg-fade"
            style={{
              opacity:
                stage === 'document' ? 1 : Math.max(0, (progress - 0.7) / 0.3),
            }}
          />
        )}
      </div>
    </div>
  );
}
