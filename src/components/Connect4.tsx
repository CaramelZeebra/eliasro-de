import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import SolverWorker from './connect4Solver.worker?worker';
import { Position, rankMoves } from './connect4Solver';

// Connect 4 — 7 × 6 grid, two-player or vs CPU.  Board geometry constants
// (column / row centres, hole size) come from the design handoff and must
// match the painted board.png pixel-for-pixel.
//
// Internal board representation: `cells[row][col]` with row 0 = TOP and
// row 5 = BOTTOM (gravity drops to the highest row index).

const ROWS = 6;
const COLS = 7;
const BOARD_W = 825;
const BOARD_H = 716;
const COL_X_PCT = [18.06, 29.09, 40.12, 51.15, 62.06, 73.09, 84.24];
const ROW_Y_PCT = [12.15, 24.02, 36.03, 47.91, 59.92, 71.79];
const HOLE_PCT_W = (55 / BOARD_W) * 100;
const HOLE_PCT_H = (55 / BOARD_H) * 100;
const COL_W_PCT = COL_X_PCT[1] - COL_X_PCT[0];

type Cell = 0 | 1 | 2;
type Player = 1 | 2;
type Mode = 'twoPlayer' | 'vsAI';
type FirstPlayer = 'red' | 'green';

const emptyBoard = (): Cell[][] =>
  Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(0));

function dropRow(board: Cell[][], col: number): number {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r][col] === 0) return r;
  }
  return -1;
}

interface WinInfo {
  winner: Player;
  line: [number, number][];
}

function findWinLine(board: Cell[][]): WinInfo | null {
  const dirs: [number, number][] = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const v = board[r][c];
      if (!v) continue;
      for (const [dr, dc] of dirs) {
        const cells: [number, number][] = [[r, c]];
        for (let k = 1; k < 4; k++) {
          const nr = r + dr * k;
          const nc = c + dc * k;
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) break;
          if (board[nr][nc] !== v) break;
          cells.push([nr, nc]);
        }
        if (cells.length === 4) return { winner: v as Player, line: cells };
      }
    }
  }
  return null;
}

const isFull = (board: Cell[][]): boolean => board[0].every((c) => c !== 0);

// Map a solver score (red's perspective, raw) to a 0..1 bar fill.  Decisive
// short-circuit values (±1000) map to the rails; tactical wins (±21 area)
// also rail; everything else uses tanh compression so the bar still moves
// for small heuristic biases without overreacting.
function scoreToFill(redScore: number): number {
  if (redScore > 100) return 1;
  if (redScore < -100) return 0;
  if (redScore > 15) return 0.5 + 0.45 * Math.tanh(redScore / 6);
  if (redScore < -15) return 0.5 + 0.45 * Math.tanh(redScore / 6);
  // Heuristic range: gentle slope around the centre.
  return 0.5 + 0.45 * Math.tanh(redScore / 6);
}

// Weighted average of per-move quality (each move contributes
// `quality × weight`, normalised by total weight).  Returns null when
// the player has no recorded decisions yet — null pcts (forced moves)
// are skipped so the metric reflects positions where they actually
// chose between meaningfully different options.
function avgPct(
  moves: { p: 1 | 2; q: { quality: number; weight: number } | null }[],
  player: 1 | 2,
): number | null {
  let sumQW = 0;
  let sumW = 0;
  for (const m of moves) {
    if (m.p === player && m.q !== null) {
      sumQW += m.q.quality * m.q.weight;
      sumW += m.q.weight;
    }
  }
  return sumW > 0 ? (sumQW / sumW) * 100 : null;
}

// Subtitle below the bar when the position is provably won/lost/drawn.
function decisiveLabel(redScore: number, exhaustive: boolean): string | null {
  if (redScore > 100) return 'red wins';
  if (redScore < -100) return 'green wins';
  if (exhaustive) {
    if (redScore > 0) return 'red wins';
    if (redScore < 0) return 'green wins';
    return 'drawn';
  }
  return null;
}

interface Connect4Props {
  onClose: () => void;
}

export default function Connect4({ onClose }: Connect4Props) {
  const [mode, setMode] = useState<Mode>('twoPlayer');
  const [firstPlayer, setFirstPlayer] = useState<FirstPlayer>('red');
  const [showEval, setShowEval] = useState(false);
  const [showShotsOnTarget, setShowShotsOnTarget] = useState(false);

  const [board, setBoard] = useState<Cell[][]>(emptyBoard);
  const [turn, setTurn] = useState<Player>(firstPlayer === 'red' ? 1 : 2);
  const [hoverCol, setHoverCol] = useState<number | null>(null);
  const [falling, setFalling] = useState<{
    id: number;
    r: number;
    c: number;
    player: Player;
  } | null>(null);
  const [moves, setMoves] = useState<
    {
      p: Player;
      c: number;
      r: number;
      // Per-move quality used by the shots-on-target average.  null
      // when the position offered no real choice (every legal column
      // tied) — those moves don't contribute to the average at all.
      q: { quality: number; weight: number } | null;
    }[]
  >([]);
  const [winInfo, setWinInfo] = useState<WinInfo | null>(null);
  const [draw, setDraw] = useState(false);
  const [score, setScore] = useState<{ 1: number; 2: number }>({ 1: 0, 2: 0 });
  const [drawCount, setDrawCount] = useState(0);
  const [locked, setLocked] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  // Eval bar state.  `evalFill` is 0..1 (0 = green dominant, 1 = red).
  // `evalText` is shown below the bar when the position is solved.
  const [evalFill, setEvalFill] = useState(0.5);
  const [evalText, setEvalText] = useState<string | null>(null);

  const aiId: Player | null = mode === 'vsAI' ? 2 : null;
  const isAITurn = aiId !== null && turn === aiId && !winInfo && !draw;

  const playerNames: Record<Player, string> = { 1: 'Red', 2: 'Green' };

  const drop = useCallback(
    (col: number) => {
      if (winInfo || draw || locked) return;
      if (board[0][col] !== 0) return;
      const r = dropRow(board, col);
      if (r < 0) return;
      const player = turn;
      const nb = board.map((row) => row.slice()) as Cell[][];
      nb[r][col] = turn;

      // Rate the move synchronously: depth-5 negamax over each candidate
      // column, then express how close the played move was to the best
      // available — linear in score units rather than coarse percentile.
      //
      // Quality:  (played − worst) / (best − worst) ∈ [0, 1].
      // Weight:   min(1, (best − worst) / 30) — the score gap proxies
      //           how much choice the position offered.  Decisive
      //           positions (gap → 30+) count fully; close calls
      //           contribute proportionally less so they neither lift
      //           nor crater the average.
      //
      // Stays null when every legal column scored identically — those
      // positions don't reflect any real decision, so they're skipped
      // entirely (a forced-best column shouldn't tick the average up to
      // 100% any more than a forced-bad column should drag it to 0%).
      let q: { quality: number; weight: number } | null = null;
      const ranked = rankMoves(Position.fromCells(board, player), 5);
      if (ranked.length > 1) {
        let bestS = -Infinity;
        let worstS = Infinity;
        for (const m of ranked) {
          if (m.score > bestS) bestS = m.score;
          if (m.score < worstS) worstS = m.score;
        }
        if (bestS > worstS) {
          const played = ranked.find((m) => m.col === col);
          if (played) {
            q = {
              quality: (played.score - worstS) / (bestS - worstS),
              weight: Math.min(1, (bestS - worstS) / 30),
            };
          }
        }
      }

      setBoard(nb);
      setFalling({ id: Date.now() + Math.random(), r, c: col, player: turn });
      setMoves((m) => [...m, { p: turn, c: col, r, q }]);
      setLocked(true);

      const animMs = (0.4 + (r + 2) * 0.05) * 1000 + 60;
      window.setTimeout(() => {
        setFalling(null);
        const win = findWinLine(nb);
        if (win) {
          setWinInfo(win);
          setScore((s) => ({ ...s, [win.winner]: s[win.winner] + 1 }));
          window.setTimeout(() => setShowBanner(true), 700);
        } else if (isFull(nb)) {
          setDraw(true);
          setDrawCount((d) => d + 1);
          window.setTimeout(() => setShowBanner(true), 400);
        } else {
          setTurn(turn === 1 ? 2 : 1);
        }
        setLocked(false);
      }, animMs);
    },
    [board, turn, winInfo, draw, locked],
  );

  // CPU move: solver runs in a Web Worker (BigInt bitboard negamax with
  // transposition table, ~2s budget).  Off-thread keeps the modal's
  // hover preview / status caption painting while the search runs.
  const workerRef = useRef<Worker | null>(null);
  useEffect(() => {
    if (!isAITurn || locked) return;
    let cancelled = false;
    const worker = new SolverWorker();
    workerRef.current = worker;
    worker.onmessage = (e: MessageEvent<{ col: number }>) => {
      if (cancelled) return;
      worker.terminate();
      workerRef.current = null;
      if (e.data.col >= 0) drop(e.data.col);
    };
    worker.postMessage({ cells: board, turn: aiId, budgetMs: 2000 });
    return () => {
      cancelled = true;
      worker.terminate();
      workerRef.current = null;
    };
  }, [isAITurn, locked, board, aiId, drop]);

  // Live position evaluation.  Only re-evaluates after EVEN move counts,
  // i.e. after the second player completes a round-trip — keeps the bar
  // from snapping mid-exchange.  Skipped while `locked` because board
  // mutates BEFORE turn flips during the drop animation, so (board, turn)
  // are briefly inconsistent.
  const evalWorkerRef = useRef<Worker | null>(null);
  useEffect(() => {
    if (!showEval) return;
    if (winInfo) {
      setEvalFill(winInfo.winner === 1 ? 1 : 0);
      setEvalText(winInfo.winner === 1 ? 'red wins' : 'green wins');
      return;
    }
    if (draw) {
      setEvalFill(0.5);
      setEvalText('drawn');
      return;
    }
    if (locked) return;
    if (moves.length % 2 !== 0) {
      // Mid-round-trip — first player has moved, waiting for the
      // second's reply before re-evaluating.
      return;
    }

    let cancelled = false;
    const worker = new SolverWorker();
    evalWorkerRef.current = worker;
    worker.onmessage = (
      e: MessageEvent<{ score: number; exhaustive: boolean }>,
    ) => {
      if (cancelled) return;
      worker.terminate();
      evalWorkerRef.current = null;
      const fromRed = turn === 1 ? e.data.score : -e.data.score;
      setEvalFill(scoreToFill(fromRed));
      setEvalText(decisiveLabel(fromRed, e.data.exhaustive));
    };
    worker.postMessage({ cells: board, turn, budgetMs: 500 });
    return () => {
      cancelled = true;
      worker.terminate();
      evalWorkerRef.current = null;
    };
  }, [board, turn, showEval, winInfo, draw, locked, moves.length]);

  // Keyboard controls + Esc closes the modal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (locked || winInfo || draw) return;
      if (isAITurn) return;
      if (e.key >= '1' && e.key <= '7') {
        drop(parseInt(e.key, 10) - 1);
      } else if (e.key === 'ArrowLeft') {
        setHoverCol((h) => (h === null ? 3 : Math.max(0, h - 1)));
      } else if (e.key === 'ArrowRight') {
        setHoverCol((h) => (h === null ? 3 : Math.min(COLS - 1, h + 1)));
      } else if (e.key === 'Enter' || e.key === ' ') {
        if (hoverCol !== null) drop(hoverCol);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drop, hoverCol, locked, winInfo, draw, isAITurn, onClose]);

  const newRound = useCallback(
    (switchStarter = true) => {
      setBoard(emptyBoard());
      setMoves([]);
      setWinInfo(null);
      setDraw(false);
      setShowBanner(false);
      if (switchStarter && winInfo) {
        setTurn(winInfo.winner === 1 ? 2 : 1);
      } else if (switchStarter && draw) {
        setTurn(turn === 1 ? 2 : 1);
      } else {
        setTurn(firstPlayer === 'red' ? 1 : 2);
      }
    },
    [winInfo, draw, turn, firstPlayer],
  );

  const resetMatch = useCallback(() => {
    setBoard(emptyBoard());
    setMoves([]);
    setWinInfo(null);
    setDraw(false);
    setShowBanner(false);
    setScore({ 1: 0, 2: 0 });
    setDrawCount(0);
    setTurn(firstPlayer === 'red' ? 1 : 2);
  }, [firstPlayer]);

  const undo = useCallback(() => {
    if (locked || moves.length === 0) return;
    const popN =
      aiId !== null && moves.length >= 2 && moves[moves.length - 1].p === aiId
        ? 2
        : 1;
    const nb = board.map((r) => r.slice()) as Cell[][];
    let lastP: Player = turn;
    for (let i = 0; i < popN; i++) {
      const m = moves[moves.length - 1 - i];
      if (!m) break;
      nb[m.r][m.c] = 0;
      lastP = m.p;
    }
    setBoard(nb);
    setMoves(moves.slice(0, moves.length - popN));
    setWinInfo(null);
    setDraw(false);
    setShowBanner(false);
    setTurn(lastP);
  }, [locked, moves, aiId, board, turn]);

  // Sync turn with firstPlayer toggle when the match is empty.
  useEffect(() => {
    if (moves.length === 0 && !winInfo && !draw) {
      setTurn(firstPlayer === 'red' ? 1 : 2);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstPlayer]);

  const winSet = useMemo(() => {
    if (!winInfo) return new Set<string>();
    return new Set(winInfo.line.map(([r, c]) => `${r},${c}`));
  }, [winInfo]);

  const showPreview =
    hoverCol !== null &&
    !locked &&
    !isAITurn &&
    !winInfo &&
    !draw &&
    board[0][hoverCol] === 0;

  const status = (() => {
    if (winInfo) {
      const name = playerNames[winInfo.winner];
      return (
        <>
          <span className={`c4-who is-${winInfo.winner === 1 ? 'red' : 'green'}`}>
            {name}
          </span>{' '}
          wins this round.
        </>
      );
    }
    if (draw) return <>The board is full.</>;
    const cls = turn === 1 ? 'red' : 'green';
    if (isAITurn) {
      return (
        <>
          <span className={`c4-who is-${cls}`}>{playerNames[turn]}</span> is thinking…
        </>
      );
    }
    return (
      <>
        <span className={`c4-who is-${cls}`}>{playerNames[turn]}</span>
        {`'s turn.`}
      </>
    );
  })();

  return (
    <div className="account-modal-backdrop" role="presentation">
      <div
        className="account-modal c4-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Connect 4 — à la Elias"
      >
        <header className="account-modal-head">
          <h2 className="account-modal-title">
            Connect 4 <span className="c4-title-by"> &mdash; <i>à la Elias</i></span>
          </h2>
          <button
            type="button"
            className="account-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="c4-status">{status}</div>

        <div className="c4-game">
          <div className="c4-board-stage">
            <div className="c4-chip-rail">
              <div
                className={`c4-chip-ghost c4-coin is-${turn === 1 ? 'red' : 'green'}`}
                style={{
                  left: `${hoverCol !== null ? COL_X_PCT[hoverCol] : 50}%`,
                  opacity: showPreview ? 1 : 0,
                }}
              />
            </div>
            <div
              className="c4-board-frame"
              onMouseLeave={() => setHoverCol(null)}
            >
              {falling && (
                <div className="c4-drop-layer">
                  <div
                    key={falling.id}
                    className={`c4-falling is-${falling.player === 1 ? 'red' : 'green'}`}
                    style={{
                      left: `${COL_X_PCT[falling.c] - HOLE_PCT_W / 2}%`,
                      width: `${HOLE_PCT_W}%`,
                      top: `${ROW_Y_PCT[falling.r] - HOLE_PCT_H / 2}%`,
                      height: `${HOLE_PCT_H}%`,
                      ['--c4-from' as string]: `${-(falling.r + 4) * 130}%`,
                      ['--c4-dur' as string]: `${0.4 + (falling.r + 2) * 0.05}s`,
                    }}
                  />
                </div>
              )}
              <div className="c4-board-wrap">
                {hoverCol !== null && !locked && !winInfo && !draw && (
                  <div
                    className="c4-col-hover"
                    style={{
                      left: `${COL_X_PCT[hoverCol] - COL_W_PCT / 2}%`,
                      width: `${COL_W_PCT}%`,
                    }}
                  />
                )}
                {board.map((row, r) =>
                  row.map((v, c) => {
                    if (v === 0) return null;
                    const isFalling =
                      falling && falling.r === r && falling.c === c;
                    const isWin = winSet.has(`${r},${c}`);
                    return (
                      <div
                        key={`${r}-${c}`}
                        className="c4-hole"
                        style={{
                          left: `${COL_X_PCT[c] - HOLE_PCT_W / 2}%`,
                          width: `${HOLE_PCT_W}%`,
                          top: `${ROW_Y_PCT[r] - HOLE_PCT_H / 2}%`,
                          height: `${HOLE_PCT_H}%`,
                        }}
                      >
                        <div
                          className={`c4-coin-piece is-${v === 1 ? 'red' : 'green'} ${isFalling ? 'is-pending' : ''} ${isWin ? 'is-win-flash' : ''}`}
                        />
                      </div>
                    );
                  }),
                )}
                {Array.from({ length: COLS }).map((_, c) => (
                  <button
                    key={c}
                    type="button"
                    className="c4-col-btn"
                    aria-label={`Drop in column ${c + 1}`}
                    disabled={
                      locked ||
                      isAITurn ||
                      !!winInfo ||
                      draw ||
                      board[0][c] !== 0
                    }
                    style={{
                      left: `${COL_X_PCT[c] - COL_W_PCT / 2}%`,
                      width: `${COL_W_PCT}%`,
                    }}
                    onMouseEnter={() => setHoverCol(c)}
                    onFocus={() => setHoverCol(c)}
                    onClick={() => drop(c)}
                  />
                ))}
              </div>
            </div>
          </div>

          <div
            className={`c4-eval-bar ${showEval ? '' : 'is-hidden'}`}
            role={showEval ? 'img' : 'separator'}
            aria-label={
              showEval
                ? evalText ?? `red ${(evalFill * 100).toFixed(0)} percent`
                : undefined
            }
            aria-hidden={!showEval}
            title={showEval ? evalText ?? undefined : undefined}
          >
            {showEval && (
              <div className="c4-eval-track">
                <div
                  className="c4-eval-red"
                  style={{ height: `${evalFill * 100}%` }}
                />
                <div
                  className="c4-eval-green"
                  style={{ height: `${(1 - evalFill) * 100}%` }}
                />
              </div>
            )}
          </div>

          <aside className="c4-side">
            <div className="c4-players">
              <PlayerRow
                colour="red"
                name="Red"
                role={aiId === 1 ? 'Elias' : 'player one'}
                score={score[1]}
                draws={mode === 'vsAI' && drawCount > 0 ? drawCount : null}
                shotPct={showShotsOnTarget ? avgPct(moves, 1) : null}
                active={turn === 1 && !winInfo && !draw}
                winner={winInfo?.winner === 1}
              />
              <PlayerRow
                colour="green"
                name="Green"
                role={aiId === 2 ? 'Elias' : 'player two'}
                score={score[2]}
                draws={mode === 'vsAI' && drawCount > 0 ? drawCount : null}
                shotPct={showShotsOnTarget ? avgPct(moves, 2) : null}
                active={turn === 2 && !winInfo && !draw}
                winner={winInfo?.winner === 2}
              />
            </div>

            <div className="c4-controls">
              <button
                type="button"
                className="account-link"
                onClick={() => newRound(true)}
              >
                new round
              </button>
              <span className="c4-sep">·</span>
              <button
                type="button"
                className="account-link"
                onClick={undo}
                disabled={moves.length === 0 || locked}
              >
                undo
              </button>
              <span className="c4-sep">·</span>
              <button
                type="button"
                className="account-link"
                onClick={resetMatch}
              >
                reset match
              </button>
            </div>

            <dl className="c4-toggles">
              <div className="c4-toggle-row">
                <dt>mode</dt>
                <dd>
                  <Toggle
                    active={mode === 'twoPlayer'}
                    onClick={() => {
                      setMode('twoPlayer');
                      resetMatch();
                    }}
                  >
                    two players
                  </Toggle>
                  <span className="c4-sep">·</span>
                  <Toggle
                    active={mode === 'vsAI'}
                    onClick={() => {
                      setMode('vsAI');
                      resetMatch();
                    }}
                  >
                    vs Elias
                  </Toggle>
                </dd>
              </div>
              <div className="c4-toggle-row">
                <dt>first move</dt>
                <dd>
                  <Toggle
                    active={firstPlayer === 'red'}
                    onClick={() => setFirstPlayer('red')}
                  >
                    red
                  </Toggle>
                  <span className="c4-sep">·</span>
                  <Toggle
                    active={firstPlayer === 'green'}
                    onClick={() => setFirstPlayer('green')}
                  >
                    green
                  </Toggle>
                </dd>
              </div>
              <div className="c4-toggle-row">
                <dt>eval bar</dt>
                <dd>
                  <Toggle
                    active={showEval}
                    onClick={() => setShowEval(true)}
                  >
                    shown
                  </Toggle>
                  <span className="c4-sep">·</span>
                  <Toggle
                    active={!showEval}
                    onClick={() => setShowEval(false)}
                  >
                    hidden
                  </Toggle>
                </dd>
              </div>
              <div className="c4-toggle-row">
                <dt>shots on tgt</dt>
                <dd>
                  <Toggle
                    active={showShotsOnTarget}
                    onClick={() => setShowShotsOnTarget(true)}
                  >
                    shown
                  </Toggle>
                  <span className="c4-sep">·</span>
                  <Toggle
                    active={!showShotsOnTarget}
                    onClick={() => setShowShotsOnTarget(false)}
                  >
                    hidden
                  </Toggle>
                </dd>
              </div>
            </dl>

            <div className="c4-keys">
              click a column · keys 1–7 · ←/→ + space · esc to close
            </div>
          </aside>
        </div>

        {showBanner && (winInfo || draw) && (
          <div
            className="c4-win-banner"
            onClick={() => setShowBanner(false)}
            role="presentation"
          >
            <div
              className="c4-win-card"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <div className="c4-win-eyebrow">
                Round {score[1] + score[2]}
              </div>
              {winInfo ? (
                <h3 className={`c4-win-title is-${winInfo.winner === 1 ? 'red' : 'green'}`}>
                  {playerNames[winInfo.winner]} wins.
                </h3>
              ) : (
                <h3 className="c4-win-title">A draw.</h3>
              )}
              <div className="c4-win-actions">
                <button
                  type="button"
                  className="account-submit"
                  onClick={() => newRound(true)}
                >
                  Play again
                </button>
                <button
                  type="button"
                  className="account-link"
                  onClick={() => setShowBanner(false)}
                >
                  review board
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PlayerRow({
  colour,
  name,
  role,
  score,
  draws,
  shotPct,
  active,
  winner,
}: {
  colour: 'red' | 'green';
  name: string;
  role: string;
  score: number;
  draws: number | null;
  shotPct: number | null;
  active: boolean;
  winner: boolean;
}) {
  return (
    <div
      className={`c4-player ${active ? 'is-active' : ''} ${winner ? 'is-winner' : ''}`}
    >
      <div className={`c4-coin c4-player-coin is-${colour}`} />
      <div className="c4-player-meta">
        <div className="c4-player-name-line">
          <span className={`c4-player-name is-${colour}`}>{name}</span>
          {shotPct !== null && (
            <span className="c4-player-shot">({shotPct.toFixed(0)}%)</span>
          )}
        </div>
        <div className="c4-player-role">{role}</div>
      </div>
      <div className="c4-player-score">
        {score}
        {draws !== null && (
          <span className="c4-player-draws"> [{draws}d]</span>
        )}
      </div>
    </div>
  );
}

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`c4-toggle ${active ? 'is-active' : ''}`}
      onClick={onClick}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}
