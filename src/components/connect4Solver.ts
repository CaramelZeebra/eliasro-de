// Bitboard-based Connect 4 solver.  Adapted from Pascal Pons'
// reference implementation (github.com/PascalPons/connect4) into
// TypeScript using BigInt for the 49-bit position representation.
//
// The 7 × 6 playable grid plus a one-row sentinel at the top of each
// column packs into 7 × 7 = 49 bits.  Bit (c, r) lives at index
// `c*H1 + r` where row 0 is the BOTTOM of the playable area.
//
// Two state words:
//   `current` — bits where the player TO MOVE has stones
//   `mask`    — bits where ANY stone exists
// The opponent's stones are `current XOR mask`.  Switching player and
// applying a column drop is one XOR + one ADD.

const WIDTH = 7;
const HEIGHT = 6;
const H1 = HEIGHT + 1; // 7
const TOTAL = WIDTH * HEIGHT; // 42
const MIN_SCORE = -((TOTAL / 2) | 0) + 3; // -18
const MAX_SCORE = ((TOTAL + 1) / 2) | 0 - 3; // 18

// Centre-out move ordering (3 first, then 4/2, then 5/1, then 6/0).
const COLUMN_ORDER = [3, 4, 2, 5, 1, 6, 0];

const BIG = (n: number): bigint => BigInt(n);

const bottomMaskBit = (col: number): bigint => 1n << BIG(col * H1);
const topMaskBit = (col: number): bigint => 1n << BIG(HEIGHT - 1 + col * H1);
const columnMaskBit = (col: number): bigint =>
  ((1n << BIG(HEIGHT)) - 1n) << BIG(col * H1);

let BOARD_MASK = 0n;
let BOTTOM_MASK = 0n;
for (let c = 0; c < WIDTH; c++) {
  BOARD_MASK |= columnMaskBit(c);
  BOTTOM_MASK |= bottomMaskBit(c);
}

type Cell = 0 | 1 | 2;
type Player = 1 | 2;

export class Position {
  current: bigint;
  mask: bigint;
  moves: number;

  constructor(current = 0n, mask = 0n, moves = 0) {
    this.current = current;
    this.mask = mask;
    this.moves = moves;
  }

  // Build a Position from the 2D game board.  In the React game,
  // `cells[row][col]` uses row 0 = TOP, row 5 = BOTTOM.  The bitboard
  // wants row 0 = BOTTOM, so we flip vertically while transcribing.
  static fromCells(cells: Cell[][], turn: Player): Position {
    let countP1 = 0;
    let countP2 = 0;
    let mask = 0n;
    for (let c = 0; c < WIDTH; c++) {
      for (let r = 0; r < HEIGHT; r++) {
        const cell = cells[HEIGHT - 1 - r][c];
        if (cell !== 0) {
          mask |= 1n << BIG(c * H1 + r);
          if (cell === 1) countP1++;
          else countP2++;
        }
      }
    }
    let current = 0n;
    for (let c = 0; c < WIDTH; c++) {
      for (let r = 0; r < HEIGHT; r++) {
        const cell = cells[HEIGHT - 1 - r][c];
        if (cell === turn) {
          current |= 1n << BIG(c * H1 + r);
        }
      }
    }
    return new Position(current, mask, countP1 + countP2);
  }

  clone(): Position {
    return new Position(this.current, this.mask, this.moves);
  }

  canPlay(col: number): boolean {
    return (this.mask & topMaskBit(col)) === 0n;
  }

  play(col: number): void {
    this.current ^= this.mask;
    this.mask |= this.mask + bottomMaskBit(col);
    this.moves++;
  }

  // Apply a precomputed bit move (a single bit on a playable cell).
  playMove(move: bigint): void {
    this.current ^= this.mask;
    this.mask |= move;
    this.moves++;
  }

  isWinningMove(col: number): boolean {
    return (this.winningPositions() & this.possible() & columnMaskBit(col)) !== 0n;
  }

  // Transposition-table key: current + mask collapses to a unique value
  // because mask isolates positions and current is a subset of mask.
  key(): bigint {
    return this.current + this.mask;
  }

  // Bitmask of all cells where dropping a stone is legal right now.
  possible(): bigint {
    return (this.mask + BOTTOM_MASK) & BOARD_MASK;
  }

  // Cells where the player to move would complete four-in-a-row.
  winningPositions(): bigint {
    return Position.computeWinningPositions(this.current, this.mask);
  }

  // Cells where the OPPONENT would win on their next turn.
  opponentWinningPositions(): bigint {
    return Position.computeWinningPositions(this.current ^ this.mask, this.mask);
  }

  // Subset of legal moves that don't immediately give the opponent a
  // winning reply.  Returns 0 if every legal move loses.
  possibleNonLosingMoves(): bigint {
    let possible = this.possible();
    const oppWin = this.opponentWinningPositions();
    const forced = possible & oppWin;
    if (forced !== 0n) {
      // Multiple forced blocks → cannot block them all → lost.
      if ((forced & (forced - 1n)) !== 0n) return 0n;
      possible = forced;
    }
    // Don't fill a cell directly below an opponent winning cell.
    return possible & ~(oppWin >> 1n);
  }

  // Pascal Pons' four-direction alignment scan: returns the bitmask of
  // empty cells that, if filled by `position`'s player, would create
  // four-in-a-row.  Restricted to currently empty cells via `mask`.
  static computeWinningPositions(position: bigint, mask: bigint): bigint {
    // Vertical.
    let r = (position << 1n) & (position << 2n) & (position << 3n);

    // Horizontal.
    let p = (position << BIG(H1)) & (position << BIG(2 * H1));
    r |= p & (position << BIG(3 * H1));
    r |= p & (position >> BIG(H1));
    p = (position >> BIG(H1)) & (position >> BIG(2 * H1));
    r |= p & (position << BIG(H1));
    r |= p & (position >> BIG(3 * H1));

    // Diagonal /.
    p = (position << BIG(H1 - 1)) & (position << BIG(2 * (H1 - 1)));
    r |= p & (position << BIG(3 * (H1 - 1)));
    r |= p & (position >> BIG(H1 - 1));
    p = (position >> BIG(H1 - 1)) & (position >> BIG(2 * (H1 - 1)));
    r |= p & (position << BIG(H1 - 1));
    r |= p & (position >> BIG(3 * (H1 - 1)));

    // Diagonal \.
    p = (position << BIG(H1 + 1)) & (position << BIG(2 * (H1 + 1)));
    r |= p & (position << BIG(3 * (H1 + 1)));
    r |= p & (position >> BIG(H1 + 1));
    p = (position >> BIG(H1 + 1)) & (position >> BIG(2 * (H1 + 1)));
    r |= p & (position << BIG(H1 + 1));
    r |= p & (position >> BIG(3 * (H1 + 1)));

    return r & (BOARD_MASK ^ mask);
  }
}

// Count winning cells a candidate move would create — used for ordering.
function moveScore(p: Position, move: bigint): number {
  const wins = Position.computeWinningPositions(p.current | move, p.mask);
  return popcount(wins);
}

// Bounded positional heuristic for depth-limit leaves.  Implements
// Allis's "claim even" parity rule (Connect-Four solution, 1988):
//
//   In zugzwang, columns fill naturally in order — the 1st, 3rd, 5th
//   stones in any column go to the first player, and the 2nd, 4th, 6th
//   to the second.  In 0-indexed rows (bottom-up):
//     - first player claims threats on EVEN rows  (0, 2, 4)
//     - second player claims threats on ODD rows  (1, 3, 5)
//   A threat on your claim-parity will eventually be played by you;
//   a threat on the wrong parity is mostly decorative because the
//   opponent can fill below it.
//
// The current player to move is the original first player iff the
// total move count is even.
//
// Implementation: precomputed parity masks let us count claim-parity
// vs wrong-parity threats with two `popcount(... & mask)` calls per
// side instead of a 42-cell loop.
//
// Threats are weighted by claim-parity match.  An additional defensive
// bias (opp's claim-parity threats hurt more than mine help) keeps the
// solver cautious.  Fork bonus when ≥ 2 claim threats exist — the
// opponent only gets one block per turn.  Centre-column control adds
// a small symmetry-breaker for near-empty positions.
//
// Score clamped to ±18 so the heuristic can never outrank a real
// ±21-area tactical win/loss returned by the negamax recursion.
const CENTRE_MASK = columnMaskBit(3);
const ROW_EVEN_MASK = (() => {
  let m = 0n;
  for (let c = 0; c < WIDTH; c++) {
    for (const r of [0, 2, 4]) m |= 1n << BIG(c * H1 + r);
  }
  return m;
})();
const ROW_ODD_MASK = BOARD_MASK ^ ROW_EVEN_MASK;

function leafEval(p: Position): number {
  const firstToMove = (p.moves & 1) === 0;
  const myClaimMask = firstToMove ? ROW_EVEN_MASK : ROW_ODD_MASK;
  const oppClaimMask = BOARD_MASK ^ myClaimMask;

  const myWins = p.winningPositions();
  const oppWins = p.opponentWinningPositions();

  const myClaim = popcount(myWins & myClaimMask);
  const myWrong = popcount(myWins) - myClaim;
  const oppClaim = popcount(oppWins & oppClaimMask);
  const oppWrong = popcount(oppWins) - oppClaim;

  let score =
    myClaim * 2 + myWrong * 1 - oppClaim * 3 - oppWrong * 1;

  if (myClaim >= 2) score += 3;
  if (oppClaim >= 2) score -= 4;

  const myCentre = popcount(p.current & CENTRE_MASK);
  const oppCentre = popcount((p.current ^ p.mask) & CENTRE_MASK);
  score += myCentre - oppCentre;

  return Math.max(-18, Math.min(18, score));
}

// Constant-time popcount via SWAR.  The bitboard fits in 49 bits, so
// split into two `Number` halves and run a 32-bit SWAR popcount on each.
// Cheaper than Brian-Kernighan's loop for dense bitfields and roughly
// equivalent for sparse ones — uniformly fast across the game arc.
function popcount(b: bigint): number {
  const lo = Number(b & 0xFFFFFFFFn) | 0;
  const hi = Number(b >> 32n) | 0;
  return popcount32(lo) + popcount32(hi);
}
function popcount32(x: number): number {
  x = x | 0;
  x = x - ((x >>> 1) & 0x55555555);
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  x = (x + (x >>> 4)) & 0x0F0F0F0F;
  return Math.imul(x, 0x01010101) >>> 24;
}

// Transposition-table entry packs:  flag (2 bits) + value (signed int).
// flag: 0 = exact, 1 = lower bound, 2 = upper bound.
interface TTEntry {
  value: number;
  flag: 0 | 1 | 2;
  depth: number;
}

class TimeBudgetExceeded extends Error {
  constructor() {
    super('time-budget');
  }
}

export interface SolveResult {
  col: number;
  score: number;
  /** Whether the search completed without exhausting the time budget. */
  exhaustive: boolean;
}

const DEFAULT_BUDGET_MS = 2200;
const TT_MAX = 400_000;

// Iterative-deepening negamax with alpha-beta + TT + null-window probes.
// Returns the best column to play.  If `budgetMs` runs out, returns the
// best move found at the deepest fully-completed iteration.
export function solve(
  position: Position,
  budgetMs = DEFAULT_BUDGET_MS,
): SolveResult {
  const deadline = performance.now() + budgetMs;

  // Immediate win — short-circuit.
  for (const c of COLUMN_ORDER) {
    if (position.canPlay(c) && position.isWinningMove(c)) {
      return { col: c, score: 1000, exhaustive: true };
    }
  }

  const possible = position.possibleNonLosingMoves();
  if (possible === 0n) {
    // Every legal move loses — block the most central one to drag it out.
    for (const c of COLUMN_ORDER) {
      if (position.canPlay(c)) {
        return { col: c, score: -1000, exhaustive: true };
      }
    }
  }

  const candidates: { col: number; bit: bigint; score: number }[] = [];
  for (const c of COLUMN_ORDER) {
    const colBits = columnMaskBit(c) & possible;
    if (colBits !== 0n) {
      candidates.push({ col: c, bit: colBits, score: moveScore(position, colBits) });
    }
  }
  candidates.sort((a, b) => b.score - a.score);

  const tt = new Map<bigint, TTEntry>();

  function negamax(p: Position, alpha: number, beta: number, depth: number): number {
    if (performance.now() > deadline) throw new TimeBudgetExceeded();

    if (p.moves >= TOTAL) return 0;

    if (depth <= 0) return leafEval(p);

    const possible = p.possibleNonLosingMoves();
    if (possible === 0n) {
      return -((TOTAL - p.moves) >> 1);
    }

    if (p.moves >= TOTAL - 2) {
      // Filling final 2 cells: it's a draw.
      return 0;
    }

    let max = ((TOTAL - 1 - p.moves) >> 1);
    const k = p.key();
    const cached = tt.get(k);
    if (cached !== undefined && cached.depth >= depth) {
      if (cached.flag === 0) return cached.value;
      if (cached.flag === 1 && cached.value > alpha) alpha = cached.value;
      else if (cached.flag === 2 && cached.value < beta) beta = cached.value;
      if (alpha >= beta) return cached.value;
    }
    if (beta > max) {
      beta = max;
      if (alpha >= beta) return beta;
    }

    const localCandidates: { bit: bigint; col: number; score: number }[] = [];
    for (const c of COLUMN_ORDER) {
      const colBits = columnMaskBit(c) & possible;
      if (colBits !== 0n) {
        localCandidates.push({ col: c, bit: colBits, score: moveScore(p, colBits) });
      }
    }
    localCandidates.sort((a, b) => b.score - a.score);

    const origAlpha = alpha;
    let bestVal = -Infinity;
    for (const m of localCandidates) {
      const next = p.clone();
      next.playMove(m.bit);
      const score = -negamax(next, -beta, -alpha, depth - 1);
      if (score > bestVal) bestVal = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) {
        if (tt.size < TT_MAX) {
          tt.set(k, { value: alpha, flag: 1, depth });
        }
        return alpha;
      }
    }

    if (tt.size < TT_MAX) {
      const flag: 0 | 1 | 2 = bestVal <= origAlpha ? 2 : 0;
      tt.set(k, { value: bestVal, flag, depth });
    }
    return bestVal;
  }

  let bestCol = candidates[0].col;
  let bestScore = -Infinity;
  let exhaustive = false;

  // Iterative deepening: each pass refines the answer; a complete pass at
  // depth >= remaining-moves is exhaustive (true game-theoretic value).
  const remaining = TOTAL - position.moves;
  for (let depth = 4; depth <= remaining; depth += 2) {
    if (performance.now() > deadline) break;
    let depthBest = bestCol;
    let depthScore = -Infinity;
    let timedOut = false;

    try {
      for (const m of candidates) {
        const next = position.clone();
        next.playMove(m.bit);
        const score = -negamax(next, -1000, 1000, depth - 1);
        if (score > depthScore) {
          depthScore = score;
          depthBest = m.col;
        }
      }
    } catch (e) {
      if (e instanceof TimeBudgetExceeded) timedOut = true;
      else throw e;
    }

    if (!timedOut) {
      bestCol = depthBest;
      bestScore = depthScore;
      // Re-sort top-level candidates so the strongest move is searched
      // first next iteration — a meaningful speedup with TT.
      candidates.sort((a, b) =>
        a.col === depthBest ? -1 : b.col === depthBest ? 1 : b.score - a.score,
      );
      if (depth >= remaining) {
        exhaustive = true;
        break;
      }
    } else {
      break;
    }
  }

  return { col: bestCol, score: bestScore, exhaustive };
}

// Shallow per-move ranking for the "shots on target" stat.  Evaluates
// every legal column at a fixed depth and returns the resulting score
// from the player-to-move's perspective — caller computes percentile
// rank of whatever column was actually played.  Pure heuristic at the
// leaves keeps the cost in the low milliseconds even for the start
// position, fast enough to call synchronously after each move.
export function rankMoves(p: Position, depth = 5): { col: number; score: number }[] {
  const out: { col: number; score: number }[] = [];
  const winScore = (TOTAL + 1 - p.moves) >> 1;
  for (let c = 0; c < WIDTH; c++) {
    if (!p.canPlay(c)) continue;
    let score: number;
    if (p.isWinningMove(c)) {
      // Immediate win — never recurse into the opponent's lost position
      // (recursion has no terminal-state check and would just return the
      // heuristic from a dead board).
      score = winScore;
    } else {
      const next = p.clone();
      next.play(c);
      score = -shallowNegamax(next, depth - 1, -100000, 100000);
    }
    out.push({ col: c, score });
  }
  return out;
}

function shallowNegamax(p: Position, depth: number, alpha: number, beta: number): number {
  if (p.moves >= TOTAL) return 0;

  // Immediate-win short-circuit for the player to move.
  for (let c = 0; c < WIDTH; c++) {
    if (p.canPlay(c) && p.isWinningMove(c)) {
      return ((TOTAL + 1 - p.moves) >> 1);
    }
  }

  if (depth <= 0) return leafEval(p);

  const possible = p.possibleNonLosingMoves();
  if (possible === 0n) return -((TOTAL - p.moves) >> 1);
  if (p.moves >= TOTAL - 2) return 0;

  let best = -Infinity;
  for (const c of COLUMN_ORDER) {
    const colBits = columnMaskBit(c) & possible;
    if (colBits === 0n) continue;
    const next = p.clone();
    next.playMove(colBits);
    const score = -shallowNegamax(next, depth - 1, -beta, -alpha);
    if (score > best) best = score;
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }
  return best;
}
