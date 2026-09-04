// Connect 4 bitboard solver — Number-split implementation.
//
// Same algorithm as connect4Solver.ts (Pascal Pons-style negamax with
// alpha-beta + transposition table + null-window probes + Allis-parity
// leaf eval), but the 49-bit position state is split into two 32-bit
// JS Numbers instead of a single BigInt.  BigInt ops in V8 are ~5–10×
// slower than Number bit ops; this rewrite trades some code complexity
// for that constant factor and lets the search reach a few plies deeper
// at the same time budget.
//
// Bit layout (per Pons): bit (col, row) lives at index `col*H1 + row`
// where row 0 is the BOTTOM of the playable area (row 6 is the per-column
// sentinel).  49 bits total → low half holds bits 0-31, high half bits
// 32-48 (kept in the low 17 bits of the `Hi` Number).

import { OPENING_BOOK } from './connect4OpeningBook';

const WIDTH = 7;
const HEIGHT = 6;
const H1 = HEIGHT + 1; // 7
const TOTAL = WIDTH * HEIGHT; // 42
const HI_MASK = 0x1FFFF; // 17-bit clamp for the high half

const COLUMN_ORDER = [3, 4, 2, 5, 1, 6, 0];

type Cell = 0 | 1 | 2;
type Player = 1 | 2;

// ─── Precomputed constants in split form ─────────────────────────────

const BOTTOM_BIT_LO: number[] = [];
const BOTTOM_BIT_HI: number[] = [];
const TOP_BIT_LO: number[] = [];
const TOP_BIT_HI: number[] = [];
const COLUMN_MASK_LO: number[] = [];
const COLUMN_MASK_HI: number[] = [];

for (let c = 0; c < WIDTH; c++) {
  const bottomBit = c * H1;
  const topBit = HEIGHT - 1 + c * H1;
  if (bottomBit < 32) {
    BOTTOM_BIT_LO.push(1 << bottomBit);
    BOTTOM_BIT_HI.push(0);
  } else {
    BOTTOM_BIT_LO.push(0);
    BOTTOM_BIT_HI.push(1 << (bottomBit - 32));
  }
  if (topBit < 32) {
    TOP_BIT_LO.push(1 << topBit);
    TOP_BIT_HI.push(0);
  } else {
    TOP_BIT_LO.push(0);
    TOP_BIT_HI.push(1 << (topBit - 32));
  }
  let colLo = 0, colHi = 0;
  for (let r = 0; r < HEIGHT; r++) {
    const b = c * H1 + r;
    if (b < 32) colLo |= 1 << b;
    else colHi |= 1 << (b - 32);
  }
  COLUMN_MASK_LO.push(colLo | 0);
  COLUMN_MASK_HI.push(colHi & HI_MASK);
}

let BOARD_LO = 0, BOARD_HI = 0;
let BOTTOM_LO = 0, BOTTOM_HI = 0;
for (let c = 0; c < WIDTH; c++) {
  BOARD_LO = (BOARD_LO | COLUMN_MASK_LO[c]) | 0;
  BOARD_HI = (BOARD_HI | COLUMN_MASK_HI[c]) & HI_MASK;
  BOTTOM_LO = (BOTTOM_LO | BOTTOM_BIT_LO[c]) | 0;
  BOTTOM_HI = (BOTTOM_HI | BOTTOM_BIT_HI[c]) & HI_MASK;
}

// Centre column (col 3) entirely fits in low half.
const CENTRE_LO = COLUMN_MASK_LO[3];
const CENTRE_HI = COLUMN_MASK_HI[3];

// Parity masks: bits at rows 0/2/4 vs 1/3/5 across all columns.
let ROW_EVEN_LO = 0, ROW_EVEN_HI = 0;
for (let c = 0; c < WIDTH; c++) {
  for (const r of [0, 2, 4]) {
    const b = c * H1 + r;
    if (b < 32) ROW_EVEN_LO |= 1 << b;
    else ROW_EVEN_HI |= 1 << (b - 32);
  }
}
ROW_EVEN_LO = ROW_EVEN_LO | 0;
ROW_EVEN_HI = ROW_EVEN_HI & HI_MASK;
const ROW_ODD_LO = (BOARD_LO ^ ROW_EVEN_LO) | 0;
const ROW_ODD_HI = (BOARD_HI ^ ROW_EVEN_HI) & HI_MASK;

// ─── Bit helpers on split values ─────────────────────────────────────

// Shift left by k ∈ [0, 48]: bits flow lo → hi.
function shlLo(lo: number, _hi: number, k: number): number {
  if (k === 0) return lo | 0;
  if (k >= 32) return 0;
  return (lo << k) | 0;
}
function shlHi(lo: number, hi: number, k: number): number {
  if (k === 0) return hi & HI_MASK;
  if (k >= 32) return ((lo << (k - 32)) & HI_MASK);
  return (((hi << k) | (lo >>> (32 - k))) & HI_MASK);
}

// Shift right by k ∈ [0, 48]: bits flow hi → lo.
function shrLo(lo: number, hi: number, k: number): number {
  if (k === 0) return lo | 0;
  if (k >= 32) return ((hi >>> (k - 32)) & HI_MASK) | 0;
  return (((lo >>> k) | (hi << (32 - k))) | 0);
}
function shrHi(_lo: number, hi: number, k: number): number {
  if (k === 0) return hi & HI_MASK;
  if (k >= 32) return 0;
  return ((hi >>> k) & HI_MASK);
}

// Add two 49-bit values.  Sum can overflow into bit 49 — the caller
// usually ANDs with BOARD_MASK afterwards which discards it.
function addLo(aLo: number, _aHi: number, bLo: number, _bHi: number): number {
  // unsigned 32-bit sum, returned as int32
  return (((aLo >>> 0) + (bLo >>> 0)) >>> 0) | 0;
}
function addHi(aLo: number, aHi: number, bLo: number, bHi: number): number {
  // Carry from low if (aLo + bLo) overflows 32 bits.
  const sumLo = (aLo >>> 0) + (bLo >>> 0);
  const carry = sumLo > 0xFFFFFFFF ? 1 : 0;
  return ((aHi + bHi + carry) & HI_MASK);
}

// Constant-time popcount across the two halves.
function popcountSplit(lo: number, hi: number): number {
  return popcount32(lo | 0) + popcount32(hi | 0);
}
function popcount32(x: number): number {
  x = x | 0;
  x = x - ((x >>> 1) & 0x55555555);
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  x = (x + (x >>> 4)) & 0x0F0F0F0F;
  return Math.imul(x, 0x01010101) >>> 24;
}

// ─── Position class ──────────────────────────────────────────────────

export class Position {
  currentLo = 0;
  currentHi = 0;
  maskLo = 0;
  maskHi = 0;
  moves = 0;

  static fromCells(cells: Cell[][], turn: Player): Position {
    const p = new Position();
    let countP1 = 0;
    let countP2 = 0;
    for (let c = 0; c < WIDTH; c++) {
      for (let r = 0; r < HEIGHT; r++) {
        const cell = cells[HEIGHT - 1 - r][c];
        if (cell !== 0) {
          const b = c * H1 + r;
          if (b < 32) p.maskLo = (p.maskLo | (1 << b)) | 0;
          else p.maskHi = (p.maskHi | (1 << (b - 32))) & HI_MASK;
          if (cell === 1) countP1++; else countP2++;
        }
      }
    }
    p.moves = countP1 + countP2;
    for (let c = 0; c < WIDTH; c++) {
      for (let r = 0; r < HEIGHT; r++) {
        if (cells[HEIGHT - 1 - r][c] === turn) {
          const b = c * H1 + r;
          if (b < 32) p.currentLo = (p.currentLo | (1 << b)) | 0;
          else p.currentHi = (p.currentHi | (1 << (b - 32))) & HI_MASK;
        }
      }
    }
    return p;
  }

  clone(): Position {
    const p = new Position();
    p.currentLo = this.currentLo;
    p.currentHi = this.currentHi;
    p.maskLo = this.maskLo;
    p.maskHi = this.maskHi;
    p.moves = this.moves;
    return p;
  }

  canPlay(col: number): boolean {
    return (this.maskLo & TOP_BIT_LO[col]) === 0 &&
           (this.maskHi & TOP_BIT_HI[col]) === 0;
  }

  play(col: number): void {
    // current ^= mask
    const cl = this.currentLo ^ this.maskLo;
    const ch = (this.currentHi ^ this.maskHi) & HI_MASK;
    // mask |= mask + bottomBit(col)
    const bLo = BOTTOM_BIT_LO[col];
    const bHi = BOTTOM_BIT_HI[col];
    const sumLo = addLo(this.maskLo, this.maskHi, bLo, bHi);
    const sumHi = addHi(this.maskLo, this.maskHi, bLo, bHi);
    this.currentLo = cl | 0;
    this.currentHi = ch & HI_MASK;
    this.maskLo = (this.maskLo | sumLo) | 0;
    this.maskHi = ((this.maskHi | sumHi) & HI_MASK);
    this.moves++;
  }

  // Apply a precomputed bit move (a single bit on a playable cell).
  playMoveSplit(moveLo: number, moveHi: number): void {
    this.currentLo ^= this.maskLo;
    this.currentHi = (this.currentHi ^ this.maskHi) & HI_MASK;
    this.maskLo = (this.maskLo | moveLo) | 0;
    this.maskHi = ((this.maskHi | moveHi) & HI_MASK);
    this.moves++;
  }

  isWinningMove(col: number): boolean {
    // (winningPositions() & possible() & columnMask) ≠ 0
    const win = this.winningPositions();
    const possLo = this.possibleLo();
    const possHi = this.possibleHi();
    const checkLo = win.lo & possLo & COLUMN_MASK_LO[col];
    const checkHi = win.hi & possHi & COLUMN_MASK_HI[col];
    return (checkLo | checkHi) !== 0;
  }

  // Transposition-table key — Pons's `current + mask` packs uniquely
  // because `mask` isolates positions and `current` is a subset of `mask`.
  // We combine the two split values into a single Number; the result is
  // ≤ 2 × (2^49 - 1) ≈ 2^50, well within the 2^53 exact-integer range.
  key(): number {
    const currentFull = this.currentHi * 0x100000000 + (this.currentLo >>> 0);
    const maskFull = this.maskHi * 0x100000000 + (this.maskLo >>> 0);
    return currentFull + maskFull;
  }

  // Bitmask of cells where dropping a stone is legal right now.
  possibleLo(): number {
    return (addLo(this.maskLo, this.maskHi, BOTTOM_LO, BOTTOM_HI) & BOARD_LO) | 0;
  }
  possibleHi(): number {
    return (addHi(this.maskLo, this.maskHi, BOTTOM_LO, BOTTOM_HI) & BOARD_HI) & HI_MASK;
  }

  // Cells where the player to move would complete four-in-a-row.
  winningPositions(): { lo: number; hi: number } {
    return computeWinningPositions(this.currentLo, this.currentHi, this.maskLo, this.maskHi);
  }
  opponentWinningPositions(): { lo: number; hi: number } {
    const oppLo = this.currentLo ^ this.maskLo;
    const oppHi = (this.currentHi ^ this.maskHi) & HI_MASK;
    return computeWinningPositions(oppLo, oppHi, this.maskLo, this.maskHi);
  }

  // Subset of legal moves that don't immediately give the opponent a
  // winning reply.  Returns 0 if every legal move loses.
  possibleNonLosingMoves(): { lo: number; hi: number } {
    let possLo = this.possibleLo();
    let possHi = this.possibleHi();
    const opp = this.opponentWinningPositions();
    const forcedLo = possLo & opp.lo;
    const forcedHi = possHi & opp.hi;
    if ((forcedLo | forcedHi) !== 0) {
      // Multiple forced blocks → cannot block them all → lost.
      const popcount = popcountSplit(forcedLo, forcedHi);
      if (popcount > 1) return { lo: 0, hi: 0 };
      possLo = forcedLo;
      possHi = forcedHi;
    }
    // Don't fill a cell directly below an opponent winning cell.
    // ~(oppWin >> 1) — shift right by 1, then NOT, then AND.
    const shiftedLo = shrLo(opp.lo, opp.hi, 1);
    const shiftedHi = shrHi(opp.lo, opp.hi, 1);
    return {
      lo: (possLo & ~shiftedLo) | 0,
      hi: (possHi & ~shiftedHi) & HI_MASK,
    };
  }
}

// ─── computeWinningPositions ─────────────────────────────────────────
// Pascal Pons's four-direction alignment scan, expressed in split form.
// For each direction with shift amount `s`, the formula is:
//   r = pos & (pos >> s) & (pos >> 2s) & (pos >> 3s)        // already-aligned
//   r |= ... patterns with shifts in either direction       // win-cell scans
// We compute lo/hi separately for each shifted variant, then combine.

function computeWinningPositions(
  posLo: number, posHi: number, maskLo: number, maskHi: number,
): { lo: number; hi: number } {
  let rLo = 0, rHi = 0;

  // Vertical: shift by 1 (bits move up within the column).
  {
    // pos << 1 & pos << 2 & pos << 3
    const a1Lo = shlLo(posLo, posHi, 1);
    const a1Hi = shlHi(posLo, posHi, 1);
    const a2Lo = shlLo(posLo, posHi, 2);
    const a2Hi = shlHi(posLo, posHi, 2);
    const a3Lo = shlLo(posLo, posHi, 3);
    const a3Hi = shlHi(posLo, posHi, 3);
    rLo |= a1Lo & a2Lo & a3Lo;
    rHi |= a1Hi & a2Hi & a3Hi;
  }

  // Horizontal (shift by H1 = 7).
  {
    const s = H1;
    // p = (pos << s) & (pos << 2s)
    const sl1Lo = shlLo(posLo, posHi, s);
    const sl1Hi = shlHi(posLo, posHi, s);
    const sl2Lo = shlLo(posLo, posHi, 2 * s);
    const sl2Hi = shlHi(posLo, posHi, 2 * s);
    let pLo = sl1Lo & sl2Lo;
    let pHi = sl1Hi & sl2Hi;
    // r |= p & (pos << 3s)
    const sl3Lo = shlLo(posLo, posHi, 3 * s);
    const sl3Hi = shlHi(posLo, posHi, 3 * s);
    rLo |= pLo & sl3Lo;
    rHi |= pHi & sl3Hi;
    // r |= p & (pos >> s)
    const sr1Lo = shrLo(posLo, posHi, s);
    const sr1Hi = shrHi(posLo, posHi, s);
    rLo |= pLo & sr1Lo;
    rHi |= pHi & sr1Hi;
    // p = (pos >> s) & (pos >> 2s)
    const sr2Lo = shrLo(posLo, posHi, 2 * s);
    const sr2Hi = shrHi(posLo, posHi, 2 * s);
    pLo = sr1Lo & sr2Lo;
    pHi = sr1Hi & sr2Hi;
    // r |= p & (pos << s)
    rLo |= pLo & sl1Lo;
    rHi |= pHi & sl1Hi;
    // r |= p & (pos >> 3s)
    const sr3Lo = shrLo(posLo, posHi, 3 * s);
    const sr3Hi = shrHi(posLo, posHi, 3 * s);
    rLo |= pLo & sr3Lo;
    rHi |= pHi & sr3Hi;
  }

  // Diagonal / (shift by H1 - 1 = 6).
  {
    const s = H1 - 1;
    const sl1Lo = shlLo(posLo, posHi, s);
    const sl1Hi = shlHi(posLo, posHi, s);
    const sl2Lo = shlLo(posLo, posHi, 2 * s);
    const sl2Hi = shlHi(posLo, posHi, 2 * s);
    let pLo = sl1Lo & sl2Lo;
    let pHi = sl1Hi & sl2Hi;
    const sl3Lo = shlLo(posLo, posHi, 3 * s);
    const sl3Hi = shlHi(posLo, posHi, 3 * s);
    rLo |= pLo & sl3Lo;
    rHi |= pHi & sl3Hi;
    const sr1Lo = shrLo(posLo, posHi, s);
    const sr1Hi = shrHi(posLo, posHi, s);
    rLo |= pLo & sr1Lo;
    rHi |= pHi & sr1Hi;
    const sr2Lo = shrLo(posLo, posHi, 2 * s);
    const sr2Hi = shrHi(posLo, posHi, 2 * s);
    pLo = sr1Lo & sr2Lo;
    pHi = sr1Hi & sr2Hi;
    rLo |= pLo & sl1Lo;
    rHi |= pHi & sl1Hi;
    const sr3Lo = shrLo(posLo, posHi, 3 * s);
    const sr3Hi = shrHi(posLo, posHi, 3 * s);
    rLo |= pLo & sr3Lo;
    rHi |= pHi & sr3Hi;
  }

  // Diagonal \ (shift by H1 + 1 = 8).
  {
    const s = H1 + 1;
    const sl1Lo = shlLo(posLo, posHi, s);
    const sl1Hi = shlHi(posLo, posHi, s);
    const sl2Lo = shlLo(posLo, posHi, 2 * s);
    const sl2Hi = shlHi(posLo, posHi, 2 * s);
    let pLo = sl1Lo & sl2Lo;
    let pHi = sl1Hi & sl2Hi;
    const sl3Lo = shlLo(posLo, posHi, 3 * s);
    const sl3Hi = shlHi(posLo, posHi, 3 * s);
    rLo |= pLo & sl3Lo;
    rHi |= pHi & sl3Hi;
    const sr1Lo = shrLo(posLo, posHi, s);
    const sr1Hi = shrHi(posLo, posHi, s);
    rLo |= pLo & sr1Lo;
    rHi |= pHi & sr1Hi;
    const sr2Lo = shrLo(posLo, posHi, 2 * s);
    const sr2Hi = shrHi(posLo, posHi, 2 * s);
    pLo = sr1Lo & sr2Lo;
    pHi = sr1Hi & sr2Hi;
    rLo |= pLo & sl1Lo;
    rHi |= pHi & sl1Hi;
    const sr3Lo = shrLo(posLo, posHi, 3 * s);
    const sr3Hi = shrHi(posLo, posHi, 3 * s);
    rLo |= pLo & sr3Lo;
    rHi |= pHi & sr3Hi;
  }

  // Restrict to currently empty cells.
  return {
    lo: (rLo & ((BOARD_LO ^ maskLo) | 0)) | 0,
    hi: (rHi & ((BOARD_HI ^ maskHi) & HI_MASK)) & HI_MASK,
  };
}

// ─── Heuristic + solver ──────────────────────────────────────────────

function moveScore(p: Position, moveLo: number, moveHi: number): number {
  const newLo = (p.currentLo | moveLo) | 0;
  const newHi = ((p.currentHi | moveHi) & HI_MASK);
  const newMaskLo = (p.maskLo | moveLo) | 0;
  const newMaskHi = ((p.maskHi | moveHi) & HI_MASK);
  const w = computeWinningPositions(newLo, newHi, newMaskLo, newMaskHi);
  return popcountSplit(w.lo, w.hi);
}

function leafEval(p: Position): number {
  const firstToMove = (p.moves & 1) === 0;
  const myClaimMaskLo = firstToMove ? ROW_EVEN_LO : ROW_ODD_LO;
  const myClaimMaskHi = firstToMove ? ROW_EVEN_HI : ROW_ODD_HI;
  const oppClaimMaskLo = (BOARD_LO ^ myClaimMaskLo) | 0;
  const oppClaimMaskHi = (BOARD_HI ^ myClaimMaskHi) & HI_MASK;

  const myWin = p.winningPositions();
  const oppWin = p.opponentWinningPositions();

  const myClaim = popcountSplit(myWin.lo & myClaimMaskLo, myWin.hi & myClaimMaskHi);
  const myWrong = popcountSplit(myWin.lo, myWin.hi) - myClaim;
  const oppClaim = popcountSplit(oppWin.lo & oppClaimMaskLo, oppWin.hi & oppClaimMaskHi);
  const oppWrong = popcountSplit(oppWin.lo, oppWin.hi) - oppClaim;

  let score = myClaim * 2 + myWrong * 1 - oppClaim * 3 - oppWrong * 1;
  if (myClaim >= 2) score += 3;
  if (oppClaim >= 2) score -= 4;

  const myCentre = popcountSplit(p.currentLo & CENTRE_LO, p.currentHi & CENTRE_HI);
  const oppCentre = popcountSplit(
    (p.currentLo ^ p.maskLo) & CENTRE_LO,
    ((p.currentHi ^ p.maskHi) & HI_MASK) & CENTRE_HI,
  );
  score += myCentre - oppCentre;

  return Math.max(-18, Math.min(18, score));
}

export interface TTEntry { value: number; flag: 0 | 1 | 2; depth: number; }
class TimeBudgetExceeded extends Error { constructor() { super('time-budget'); } }

export interface SolveResult {
  col: number;
  score: number;
  exhaustive: boolean;
}

const DEFAULT_BUDGET_MS = 2200;
const TT_MAX = 400_000;

export function solve(
  position: Position,
  budgetMs = DEFAULT_BUDGET_MS,
  sharedTT?: Map<number, TTEntry>,
): SolveResult {
  // Opening-book lookup — bypasses the search entirely for the first
  // few plies, where each call would otherwise burn the entire budget
  // on positions whose best moves are well-known.
  const booked = OPENING_BOOK.get(position.key());
  if (booked && position.canPlay(booked.col)) {
    return { col: booked.col, score: booked.score, exhaustive: booked.exhaustive };
  }

  const deadline = performance.now() + budgetMs;

  for (const c of COLUMN_ORDER) {
    if (position.canPlay(c) && position.isWinningMove(c)) {
      return { col: c, score: 1000, exhaustive: true };
    }
  }

  const possible0 = position.possibleNonLosingMoves();
  if (possible0.lo === 0 && possible0.hi === 0) {
    for (const c of COLUMN_ORDER) {
      if (position.canPlay(c)) {
        return { col: c, score: -1000, exhaustive: true };
      }
    }
  }

  type Cand = { col: number; bitLo: number; bitHi: number; score: number };
  const candidates: Cand[] = [];
  for (const c of COLUMN_ORDER) {
    const colBitsLo = COLUMN_MASK_LO[c] & possible0.lo;
    const colBitsHi = COLUMN_MASK_HI[c] & possible0.hi;
    if ((colBitsLo | colBitsHi) !== 0) {
      candidates.push({
        col: c, bitLo: colBitsLo, bitHi: colBitsHi,
        score: moveScore(position, colBitsLo, colBitsHi),
      });
    }
  }
  candidates.sort((a, b) => b.score - a.score);

  const tt = sharedTT ?? new Map<number, TTEntry>();

  function negamax(p: Position, alpha: number, beta: number, depth: number): number {
    if (performance.now() > deadline) throw new TimeBudgetExceeded();
    if (p.moves >= TOTAL) return 0;
    if (depth <= 0) return leafEval(p);

    const possible = p.possibleNonLosingMoves();
    if (possible.lo === 0 && possible.hi === 0) {
      return -((TOTAL - p.moves) >> 1);
    }
    if (p.moves >= TOTAL - 2) return 0;

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

    const local: Cand[] = [];
    for (const c of COLUMN_ORDER) {
      const colBitsLo = COLUMN_MASK_LO[c] & possible.lo;
      const colBitsHi = COLUMN_MASK_HI[c] & possible.hi;
      if ((colBitsLo | colBitsHi) !== 0) {
        local.push({
          col: c, bitLo: colBitsLo, bitHi: colBitsHi,
          score: moveScore(p, colBitsLo, colBitsHi),
        });
      }
    }
    local.sort((a, b) => b.score - a.score);

    const origAlpha = alpha;
    let bestVal = -Infinity;
    let firstMove = true;
    for (const m of local) {
      const next = p.clone();
      next.playMoveSplit(m.bitLo, m.bitHi);
      let score: number;
      if (firstMove) {
        score = -negamax(next, -beta, -alpha, depth - 1);
        firstMove = false;
      } else {
        score = -negamax(next, -alpha - 1, -alpha, depth - 1);
        if (score > alpha && score < beta) {
          score = -negamax(next, -beta, -alpha, depth - 1);
        }
      }
      if (score > bestVal) bestVal = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) {
        if (tt.size < TT_MAX) tt.set(k, { value: alpha, flag: 1, depth });
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
  const remaining = TOTAL - position.moves;

  for (let depth = 4; depth <= remaining; depth += 2) {
    if (performance.now() > deadline) break;
    let depthBest = bestCol;
    let depthScore = -Infinity;
    let timedOut = false;
    try {
      for (const m of candidates) {
        const next = position.clone();
        next.playMoveSplit(m.bitLo, m.bitHi);
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

