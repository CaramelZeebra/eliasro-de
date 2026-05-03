import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  applyMove,
  findMove,
  initialState,
  legalMoves,
  moveToSan,
  promotionsFor,
  squareName,
  status,
  type GameState,
  type Move,
  type Piece,
  type Side,
  type Square,
} from './chessLogic';

// Piece sprites extracted from public/chess/. Uppercase = white, lowercase
// = black. Files are PNG with transparent backgrounds so they sit cleanly
// on either light or dark squares.
const SPRITE: Record<string, string> = {
  K: '/chess/K-white.png', Q: '/chess/Q-white.png', R: '/chess/R-white.png',
  B: '/chess/B-white.png', N: '/chess/N-white.png', P: '/chess/P-white.png',
  k: '/chess/K-black.png', q: '/chess/Q-black.png', r: '/chess/R-black.png',
  b: '/chess/B-black.png', n: '/chess/N-black.png', p: '/chess/P-black.png',
};

const PIECE_NAME: Record<string, string> = {
  K: 'White king', Q: 'White queen', R: 'White rook',
  B: 'White bishop', N: 'White knight', P: 'White pawn',
  k: 'Black king', q: 'Black queen', r: 'Black rook',
  b: 'Black bishop', n: 'Black knight', p: 'Black pawn',
};

type Mode = 'twoPlayer' | 'vsElias';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

export default function Chess() {
  const [mode, setMode] = useState<Mode>('twoPlayer');
  const [history, setHistory] = useState<GameState[]>(() => [initialState()]);
  const [moveLog, setMoveLog] = useState<string[]>([]);
  const [selected, setSelected] = useState<Square | null>(null);
  const [orientation, setOrientation] = useState<Side>('w');
  const [pendingPromotion, setPendingPromotion] = useState<{
    moves: Move[]; from: Square; to: Square;
  } | null>(null);

  const state = history[history.length - 1];
  const moves = useMemo(() => legalMoves(state), [state]);
  const gameStatus = useMemo(() => status(state), [state]);
  const isOver =
    gameStatus === 'checkmate' ||
    gameStatus === 'stalemate' ||
    gameStatus === 'fifty-move' ||
    gameStatus === 'threefold' ||
    gameStatus === 'insufficient';

  const lastMoveSquares = useMemo(() => {
    if (history.length < 2) return null;
    // Reconstruct the from/to of the last move by diffing boards.
    const prev = history[history.length - 2].board;
    const cur = state.board;
    const changed: Square[] = [];
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        if (prev[r][f] !== cur[r][f]) changed.push([r, f]);
      }
    }
    if (changed.length < 2) return null;
    return changed;
  }, [history, state]);

  const lastMoveSet = useMemo(() => {
    const s = new Set<string>();
    for (const sq of lastMoveSquares ?? []) s.add(`${sq[0]},${sq[1]}`);
    return s;
  }, [lastMoveSquares]);

  // Captured pieces: derived from move log... easier to count from current
  // board vs the initial census.
  const captured = useMemo(() => {
    const start: Record<Piece, number> = {
      K: 1, Q: 1, R: 2, B: 2, N: 2, P: 8,
      k: 1, q: 1, r: 2, b: 2, n: 2, p: 8,
      '': 0,
    };
    const cur: Record<Piece, number> = {
      K: 0, Q: 0, R: 0, B: 0, N: 0, P: 0,
      k: 0, q: 0, r: 0, b: 0, n: 0, p: 0,
      '': 0,
    };
    for (const row of state.board) for (const p of row) cur[p]++;
    const list = (side: Side) => {
      const order: Piece[] = side === 'w'
        ? ['Q', 'R', 'B', 'N', 'P']
        : ['q', 'r', 'b', 'n', 'p'];
      const out: Piece[] = [];
      // Promotions can grow a side's pool above the starting census; treat
      // negative deltas (extra pieces) as 0 captures of that type, and add
      // the *opposing* pawn loss to compensate isn't worth it here — the
      // visible tray is just a rough trophy display, not a material count.
      for (const p of order) {
        const lost = Math.max(0, start[p] - cur[p]);
        for (let i = 0; i < lost; i++) out.push(p);
      }
      return out;
    };
    return { w: list('w'), b: list('b') };
  }, [state]);

  // Click a square: select / deselect / move.
  const onSquareClick = useCallback(
    (r: number, f: number) => {
      if (isOver) return;
      if (pendingPromotion) return;
      const piece = state.board[r][f];

      // Selecting one of our own pieces.
      if (piece && (piece === piece.toUpperCase()) === (state.toMove === 'w')) {
        setSelected([r, f]);
        return;
      }

      if (!selected) return;

      const target: Square = [r, f];
      const promos = promotionsFor(moves, selected, target);
      if (promos.length > 0) {
        setPendingPromotion({ moves: promos, from: selected, to: target });
        return;
      }

      const m = findMove(moves, selected, target);
      if (!m) {
        // Click on empty/enemy that isn't a legal target → deselect.
        setSelected(null);
        return;
      }

      const san = moveToSan(state, m);
      const next = applyMove(state, m);
      setHistory((h) => [...h, next]);
      setMoveLog((l) => [...l, san]);
      setSelected(null);
    },
    [state, selected, moves, isOver, pendingPromotion],
  );

  const choosePromotion = useCallback(
    (m: Move) => {
      const san = moveToSan(state, m);
      const next = applyMove(state, m);
      setHistory((h) => [...h, next]);
      setMoveLog((l) => [...l, san]);
      setSelected(null);
      setPendingPromotion(null);
    },
    [state],
  );

  const undo = useCallback(() => {
    if (history.length <= 1) return;
    setHistory((h) => h.slice(0, h.length - 1));
    setMoveLog((l) => l.slice(0, l.length - 1));
    setSelected(null);
    setPendingPromotion(null);
  }, [history.length]);

  const newGame = useCallback(() => {
    setHistory([initialState()]);
    setMoveLog([]);
    setSelected(null);
    setPendingPromotion(null);
  }, []);

  // Esc clears selection / promotion picker.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (pendingPromotion) setPendingPromotion(null);
      else setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pendingPromotion]);

  // Squares the selected piece can legally move to.
  const targets = useMemo(() => {
    const set = new Set<string>();
    if (!selected) return set;
    for (const m of moves) {
      if (m.from[0] === selected[0] && m.from[1] === selected[1]) {
        set.add(`${m.to[0]},${m.to[1]}`);
      }
    }
    return set;
  }, [selected, moves]);

  // Where the king-in-check sits, for highlight.
  const checkSquare = useMemo(() => {
    if (gameStatus !== 'check' && gameStatus !== 'checkmate') return null;
    const side = state.toMove;
    const target: Piece = side === 'w' ? 'K' : 'k';
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        if (state.board[r][f] === target) return [r, f] as const;
      }
    }
    return null;
  }, [gameStatus, state]);

  const ranks = orientation === 'w'
    ? [7, 6, 5, 4, 3, 2, 1, 0]
    : [0, 1, 2, 3, 4, 5, 6, 7];
  const files = orientation === 'w'
    ? [0, 1, 2, 3, 4, 5, 6, 7]
    : [7, 6, 5, 4, 3, 2, 1, 0];

  const statusText = (() => {
    const who = state.toMove === 'w' ? 'White' : 'Black';
    if (gameStatus === 'checkmate') {
      const winner = state.toMove === 'w' ? 'Black' : 'White';
      return `${winner} wins by checkmate.`;
    }
    if (gameStatus === 'stalemate') return 'Stalemate — drawn.';
    if (gameStatus === 'fifty-move') return 'Drawn — 50-move rule.';
    if (gameStatus === 'threefold') return 'Drawn — threefold repetition.';
    if (gameStatus === 'insufficient') return 'Drawn — insufficient material.';
    if (gameStatus === 'check') return `${who} is in check.`;
    return `${who} to move.`;
  })();

  // Move log paired by full move (white, black).
  const movePairs = useMemo(() => {
    const pairs: { num: number; w: string; b?: string }[] = [];
    for (let i = 0; i < moveLog.length; i += 2) {
      pairs.push({
        num: i / 2 + 1,
        w: moveLog[i],
        b: moveLog[i + 1],
      });
    }
    return pairs;
  }, [moveLog]);

  return (
    <div className="chess-shell">
      <header className="chess-head">
        <a className="chess-home" href="/">&larr; eliasro.de</a>
        <h1 className="chess-title">
          Chess <span className="chess-title-by"> &mdash; <i>à la Elias</i></span>
        </h1>
      </header>

      <div className="chess-status">{statusText}</div>

      <div className="chess-layout">
        <div className="chess-stage">
          <CapturedRow
            pieces={orientation === 'w' ? captured.b : captured.w}
            label={orientation === 'w' ? 'Black captures' : 'White captures'}
          />

          <div className="chess-board-wrap">
            <div className="chess-board" role="grid" aria-label="Chess board">
              {ranks.map((r) => (
                <div className="chess-rank" role="row" key={r}>
                  {files.map((f) => {
                    const dark = (r + f) % 2 === 0;
                    const piece = state.board[r][f];
                    const isSelected =
                      selected && selected[0] === r && selected[1] === f;
                    const isTarget = targets.has(`${r},${f}`);
                    const isLast = lastMoveSet.has(`${r},${f}`);
                    const isCheck =
                      checkSquare && checkSquare[0] === r && checkSquare[1] === f;
                    const targetCapture = isTarget && piece;
                    const className = [
                      'chess-square',
                      dark ? 'is-dark' : 'is-light',
                      isSelected ? 'is-selected' : '',
                      isLast ? 'is-last' : '',
                      isCheck ? 'is-check' : '',
                    ].filter(Boolean).join(' ');
                    const showFile = orientation === 'w' ? r === 0 : r === 7;
                    const showRank = orientation === 'w' ? f === 0 : f === 7;
                    return (
                      <button
                        type="button"
                        role="gridcell"
                        key={`${r}-${f}`}
                        className={className}
                        aria-label={`${squareName([r, f])}${piece ? ` ${piece}` : ''}`}
                        onClick={() => onSquareClick(r, f)}
                      >
                        {showFile && (
                          <span className="chess-coord chess-coord-file">
                            {FILES[f]}
                          </span>
                        )}
                        {showRank && (
                          <span className="chess-coord chess-coord-rank">
                            {r + 1}
                          </span>
                        )}
                        {piece && (
                          <img
                            className={`chess-piece is-${piece === piece.toUpperCase() ? 'white' : 'black'}`}
                            src={SPRITE[piece]}
                            alt={PIECE_NAME[piece]}
                            draggable={false}
                          />
                        )}
                        {isTarget && !targetCapture && (
                          <span className="chess-target-dot" aria-hidden="true" />
                        )}
                        {targetCapture && (
                          <span className="chess-target-ring" aria-hidden="true" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <CapturedRow
            pieces={orientation === 'w' ? captured.w : captured.b}
            label={orientation === 'w' ? 'White captures' : 'Black captures'}
          />
        </div>

        <aside className="chess-side">
          <dl className="chess-toggles">
            <div className="chess-toggle-row">
              <dt>mode</dt>
              <dd>
                <Toggle
                  active={mode === 'twoPlayer'}
                  onClick={() => { setMode('twoPlayer'); newGame(); }}
                >
                  two players
                </Toggle>
                <span className="chess-sep">&middot;</span>
                <Toggle
                  active={mode === 'vsElias'}
                  onClick={() => { setMode('vsElias'); newGame(); }}
                  disabled
                  title="Coming soon"
                >
                  vs Elias
                </Toggle>
              </dd>
            </div>
            <div className="chess-toggle-row">
              <dt>orientation</dt>
              <dd>
                <Toggle
                  active={orientation === 'w'}
                  onClick={() => setOrientation('w')}
                >
                  white
                </Toggle>
                <span className="chess-sep">&middot;</span>
                <Toggle
                  active={orientation === 'b'}
                  onClick={() => setOrientation('b')}
                >
                  black
                </Toggle>
              </dd>
            </div>
          </dl>

          <div className="chess-controls">
            <button type="button" className="account-link" onClick={newGame}>
              new game
            </button>
            <span className="chess-sep">&middot;</span>
            <button
              type="button"
              className="account-link"
              onClick={undo}
              disabled={history.length <= 1}
            >
              undo
            </button>
            <span className="chess-sep">&middot;</span>
            <button
              type="button"
              className="account-link"
              onClick={() => setOrientation((o) => (o === 'w' ? 'b' : 'w'))}
            >
              flip
            </button>
          </div>

          <div className="chess-movelist" aria-label="Move list">
            {movePairs.length === 0 ? (
              <div className="chess-movelist-empty">No moves yet.</div>
            ) : (
              <ol>
                {movePairs.map((p) => (
                  <li key={p.num}>
                    <span className="chess-move-num">{p.num}.</span>
                    <span className="chess-move-w">{p.w}</span>
                    {p.b && <span className="chess-move-b">{p.b}</span>}
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="chess-keys">
            click to select &middot; click again to move &middot; esc to deselect
          </div>
        </aside>
      </div>

      {pendingPromotion && (
        <div
          className="chess-promo-backdrop"
          onClick={() => setPendingPromotion(null)}
          role="presentation"
        >
          <div
            className="chess-promo-card"
            role="dialog"
            aria-modal="true"
            aria-label="Choose promotion piece"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="chess-promo-eyebrow">Promote to:</div>
            <div className="chess-promo-row">
              {pendingPromotion.moves.map((m) => (
                <button
                  key={m.promotion}
                  type="button"
                  className="chess-promo-btn"
                  onClick={() => choosePromotion(m)}
                  aria-label={`Promote to ${m.promotion}`}
                >
                  <img
                    className={`chess-piece is-${m.piece === m.piece.toUpperCase() ? 'white' : 'black'}`}
                    src={SPRITE[m.promotion!]}
                    alt={PIECE_NAME[m.promotion!]}
                    draggable={false}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CapturedRow({ pieces, label }: { pieces: Piece[]; label: string }) {
  return (
    <div
      className="chess-captured"
      aria-label={label}
      data-empty={pieces.length === 0 ? 'true' : undefined}
    >
      {pieces.length === 0 ? (
        <span className="chess-captured-placeholder">&nbsp;</span>
      ) : (
        pieces.map((p, i) => (
          <img
            key={i}
            className={`chess-piece is-${p === p.toUpperCase() ? 'white' : 'black'} is-small`}
            src={SPRITE[p]}
            alt={PIECE_NAME[p]}
            draggable={false}
          />
        ))
      )}
    </div>
  );
}

function Toggle({
  active,
  onClick,
  children,
  disabled,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      className={`c4-toggle ${active ? 'is-active' : ''}`}
      onClick={onClick}
      aria-pressed={active}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
}
