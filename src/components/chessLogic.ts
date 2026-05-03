// Chess engine — pure logic, no UI. Used by Chess.tsx.
//
// Board layout: board[rank][file].
//   rank 0 = white's back rank (a1..h1)
//   rank 7 = black's back rank (a8..h8)
//   file 0 = a, file 7 = h
// Pieces are single chars: K Q R B N P (white) / k q r b n p (black).
// Empty squares are the empty string.

export type Piece =
  | 'K' | 'Q' | 'R' | 'B' | 'N' | 'P'
  | 'k' | 'q' | 'r' | 'b' | 'n' | 'p'
  | '';

export type Side = 'w' | 'b';
export type Square = readonly [number, number]; // [rank, file]

export interface CastlingRights {
  wK: boolean; // white kingside
  wQ: boolean; // white queenside
  bK: boolean;
  bQ: boolean;
}

export interface GameState {
  board: Piece[][];
  toMove: Side;
  castling: CastlingRights;
  /** Square that *could* be captured to en passant (the empty square the
   *  pawn jumped over), or null. */
  enPassant: Square | null;
  halfmove: number;
  fullmove: number;
  /** Position keys (board + toMove + castling + ep) for repetition detection. */
  history: string[];
}

export interface Move {
  from: Square;
  to: Square;
  piece: Piece;
  /** Captured piece, '' if none. For en passant this is the captured pawn. */
  captured: Piece;
  promotion?: 'Q' | 'R' | 'B' | 'N' | 'q' | 'r' | 'b' | 'n';
  castle?: 'K' | 'Q';
  enPassant?: boolean;
}

export type Status =
  | 'ongoing'
  | 'check'
  | 'checkmate'
  | 'stalemate'
  | 'fifty-move'
  | 'threefold'
  | 'insufficient';

export const sideOf = (p: Piece): Side | null => {
  if (!p) return null;
  return p === p.toUpperCase() ? 'w' : 'b';
};

export const opposite = (s: Side): Side => (s === 'w' ? 'b' : 'w');

const inBounds = (r: number, f: number) =>
  r >= 0 && r < 8 && f >= 0 && f < 8;

export function initialState(): GameState {
  const empty: Piece[][] = Array.from({ length: 8 }, () =>
    Array<Piece>(8).fill(''),
  );
  const back: Piece[] = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
  for (let f = 0; f < 8; f++) {
    empty[0][f] = back[f];
    empty[1][f] = 'P';
    empty[6][f] = 'p';
    empty[7][f] = back[f].toLowerCase() as Piece;
  }
  return {
    board: empty,
    toMove: 'w',
    castling: { wK: true, wQ: true, bK: true, bQ: true },
    enPassant: null,
    halfmove: 0,
    fullmove: 1,
    history: [],
  };
}

export const cloneBoard = (b: Piece[][]): Piece[][] =>
  b.map((row) => row.slice());

export const cloneState = (s: GameState): GameState => ({
  board: cloneBoard(s.board),
  toMove: s.toMove,
  castling: { ...s.castling },
  enPassant: s.enPassant ? ([s.enPassant[0], s.enPassant[1]] as const) : null,
  halfmove: s.halfmove,
  fullmove: s.fullmove,
  history: s.history.slice(),
});

// === Square <-> algebraic notation ===

export const squareName = ([r, f]: Square): string =>
  `${'abcdefgh'[f]}${r + 1}`;

export const parseSquare = (s: string): Square | null => {
  if (s.length !== 2) return null;
  const f = 'abcdefgh'.indexOf(s[0]);
  const r = parseInt(s[1], 10) - 1;
  if (f < 0 || isNaN(r) || r < 0 || r > 7) return null;
  return [r, f];
};

// === Pseudo-legal move generation (ignores leaving own king in check) ===

const SLIDE_DIRS: Record<'R' | 'B' | 'Q', ReadonlyArray<[number, number]>> = {
  R: [[1, 0], [-1, 0], [0, 1], [0, -1]],
  B: [[1, 1], [1, -1], [-1, 1], [-1, -1]],
  Q: [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]],
};

const KNIGHT_OFFSETS: ReadonlyArray<[number, number]> = [
  [2, 1], [2, -1], [-2, 1], [-2, -1],
  [1, 2], [1, -2], [-1, 2], [-1, -2],
];

const KING_OFFSETS: ReadonlyArray<[number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

function pseudoMovesFrom(state: GameState, r: number, f: number): Move[] {
  const piece = state.board[r][f];
  if (!piece) return [];
  const side = sideOf(piece)!;
  if (side !== state.toMove) return [];
  const out: Move[] = [];
  const enemy: Side = opposite(side);

  const push = (m: Move) => out.push(m);

  const lower = piece.toLowerCase();

  if (lower === 'p') {
    const dir = side === 'w' ? 1 : -1;
    const startRank = side === 'w' ? 1 : 6;
    const promoRank = side === 'w' ? 7 : 0;

    // Single push
    const r1 = r + dir;
    if (inBounds(r1, f) && !state.board[r1][f]) {
      if (r1 === promoRank) {
        for (const promo of (side === 'w'
          ? (['Q', 'R', 'B', 'N'] as const)
          : (['q', 'r', 'b', 'n'] as const))) {
          push({
            from: [r, f], to: [r1, f], piece, captured: '', promotion: promo,
          });
        }
      } else {
        push({ from: [r, f], to: [r1, f], piece, captured: '' });
      }
      // Double push
      const r2 = r + 2 * dir;
      if (r === startRank && !state.board[r2][f]) {
        push({ from: [r, f], to: [r2, f], piece, captured: '' });
      }
    }

    // Captures
    for (const df of [-1, 1]) {
      const nr = r + dir;
      const nf = f + df;
      if (!inBounds(nr, nf)) continue;
      const target = state.board[nr][nf];
      if (target && sideOf(target) === enemy) {
        if (nr === promoRank) {
          for (const promo of (side === 'w'
            ? (['Q', 'R', 'B', 'N'] as const)
            : (['q', 'r', 'b', 'n'] as const))) {
            push({
              from: [r, f], to: [nr, nf], piece, captured: target,
              promotion: promo,
            });
          }
        } else {
          push({ from: [r, f], to: [nr, nf], piece, captured: target });
        }
      } else if (
        state.enPassant &&
        state.enPassant[0] === nr &&
        state.enPassant[1] === nf
      ) {
        // En passant: captured pawn sits behind the target square.
        const captured = state.board[r][nf];
        push({
          from: [r, f], to: [nr, nf], piece, captured,
          enPassant: true,
        });
      }
    }
    return out;
  }

  if (lower === 'n') {
    for (const [dr, df] of KNIGHT_OFFSETS) {
      const nr = r + dr, nf = f + df;
      if (!inBounds(nr, nf)) continue;
      const target = state.board[nr][nf];
      if (!target || sideOf(target) === enemy) {
        push({ from: [r, f], to: [nr, nf], piece, captured: target });
      }
    }
    return out;
  }

  if (lower === 'r' || lower === 'b' || lower === 'q') {
    const dirs =
      lower === 'r' ? SLIDE_DIRS.R :
      lower === 'b' ? SLIDE_DIRS.B :
      SLIDE_DIRS.Q;
    for (const [dr, df] of dirs) {
      let nr = r + dr, nf = f + df;
      while (inBounds(nr, nf)) {
        const target = state.board[nr][nf];
        if (!target) {
          push({ from: [r, f], to: [nr, nf], piece, captured: '' });
        } else {
          if (sideOf(target) === enemy) {
            push({ from: [r, f], to: [nr, nf], piece, captured: target });
          }
          break;
        }
        nr += dr; nf += df;
      }
    }
    return out;
  }

  if (lower === 'k') {
    for (const [dr, df] of KING_OFFSETS) {
      const nr = r + dr, nf = f + df;
      if (!inBounds(nr, nf)) continue;
      const target = state.board[nr][nf];
      if (!target || sideOf(target) === enemy) {
        push({ from: [r, f], to: [nr, nf], piece, captured: target });
      }
    }

    // Castling — pseudo-legal here; legality (squares not attacked) is
    // verified after generating into legal moves below.
    const homeRank = side === 'w' ? 0 : 7;
    if (r === homeRank && f === 4) {
      const rights = state.castling;
      const canK = side === 'w' ? rights.wK : rights.bK;
      const canQ = side === 'w' ? rights.wQ : rights.bQ;
      if (canK &&
        !state.board[homeRank][5] &&
        !state.board[homeRank][6] &&
        state.board[homeRank][7].toLowerCase() === 'r') {
        push({
          from: [r, f], to: [homeRank, 6], piece, captured: '', castle: 'K',
        });
      }
      if (canQ &&
        !state.board[homeRank][1] &&
        !state.board[homeRank][2] &&
        !state.board[homeRank][3] &&
        state.board[homeRank][0].toLowerCase() === 'r') {
        push({
          from: [r, f], to: [homeRank, 2], piece, captured: '', castle: 'Q',
        });
      }
    }
    return out;
  }

  return out;
}

function findKing(board: Piece[][], side: Side): Square | null {
  const target: Piece = side === 'w' ? 'K' : 'k';
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      if (board[r][f] === target) return [r, f];
    }
  }
  return null;
}

/** True if `side`'s pieces attack square (r, f). Used for check + castling. */
export function isSquareAttacked(
  board: Piece[][],
  r: number,
  f: number,
  byside: Side,
): boolean {
  // Pawn attacks
  const pawn: Piece = byside === 'w' ? 'P' : 'p';
  const dir = byside === 'w' ? 1 : -1;
  for (const df of [-1, 1]) {
    const pr = r - dir, pf = f - df;
    if (inBounds(pr, pf) && board[pr][pf] === pawn) return true;
  }

  // Knight attacks
  const knight: Piece = byside === 'w' ? 'N' : 'n';
  for (const [dr, df] of KNIGHT_OFFSETS) {
    const nr = r + dr, nf = f + df;
    if (inBounds(nr, nf) && board[nr][nf] === knight) return true;
  }

  // King attacks (adjacent)
  const king: Piece = byside === 'w' ? 'K' : 'k';
  for (const [dr, df] of KING_OFFSETS) {
    const nr = r + dr, nf = f + df;
    if (inBounds(nr, nf) && board[nr][nf] === king) return true;
  }

  // Sliding: rook/queen along ranks+files
  for (const [dr, df] of SLIDE_DIRS.R) {
    let nr = r + dr, nf = f + df;
    while (inBounds(nr, nf)) {
      const p = board[nr][nf];
      if (p) {
        if (sideOf(p) === byside &&
          (p.toLowerCase() === 'r' || p.toLowerCase() === 'q')) {
          return true;
        }
        break;
      }
      nr += dr; nf += df;
    }
  }
  // Sliding: bishop/queen along diagonals
  for (const [dr, df] of SLIDE_DIRS.B) {
    let nr = r + dr, nf = f + df;
    while (inBounds(nr, nf)) {
      const p = board[nr][nf];
      if (p) {
        if (sideOf(p) === byside &&
          (p.toLowerCase() === 'b' || p.toLowerCase() === 'q')) {
          return true;
        }
        break;
      }
      nr += dr; nf += df;
    }
  }
  return false;
}

export function inCheck(state: GameState, side: Side): boolean {
  const k = findKing(state.board, side);
  if (!k) return false;
  return isSquareAttacked(state.board, k[0], k[1], opposite(side));
}

/** Apply a move and return the new state. Caller is responsible for ensuring
 *  the move is legal (use legalMoves to enumerate). Mutates nothing. */
export function applyMove(state: GameState, m: Move): GameState {
  const next = cloneState(state);
  const board = next.board;
  const [fr, ff] = m.from;
  const [tr, tf] = m.to;
  const moving = board[fr][ff];

  board[fr][ff] = '';

  // En passant: remove the pawn that was captured (NOT on the destination).
  if (m.enPassant) {
    board[fr][tf] = '';
  }

  board[tr][tf] = m.promotion ?? moving;

  // Castling: also move the rook.
  if (m.castle === 'K') {
    board[tr][5] = board[tr][7];
    board[tr][7] = '';
  } else if (m.castle === 'Q') {
    board[tr][3] = board[tr][0];
    board[tr][0] = '';
  }

  // Update castling rights when king/rook moves or rook is captured.
  if (moving === 'K') { next.castling.wK = false; next.castling.wQ = false; }
  if (moving === 'k') { next.castling.bK = false; next.castling.bQ = false; }
  if (moving === 'R' && fr === 0 && ff === 0) next.castling.wQ = false;
  if (moving === 'R' && fr === 0 && ff === 7) next.castling.wK = false;
  if (moving === 'r' && fr === 7 && ff === 0) next.castling.bQ = false;
  if (moving === 'r' && fr === 7 && ff === 7) next.castling.bK = false;
  // Rook captured on home square -> rights revoked.
  if (m.captured === 'R' && tr === 0 && tf === 0) next.castling.wQ = false;
  if (m.captured === 'R' && tr === 0 && tf === 7) next.castling.wK = false;
  if (m.captured === 'r' && tr === 7 && tf === 0) next.castling.bQ = false;
  if (m.captured === 'r' && tr === 7 && tf === 7) next.castling.bK = false;

  // En passant target — only set on a pawn double push.
  next.enPassant = null;
  if (moving.toLowerCase() === 'p' && Math.abs(tr - fr) === 2) {
    next.enPassant = [(fr + tr) / 2, ff];
  }

  // Half/full move counters.
  if (moving.toLowerCase() === 'p' || m.captured) {
    next.halfmove = 0;
  } else {
    next.halfmove += 1;
  }
  if (state.toMove === 'b') next.fullmove += 1;

  next.toMove = opposite(state.toMove);
  next.history = [...state.history, positionKey(next)];
  return next;
}

/** Enumerate all legal moves for the side to move. */
export function legalMoves(state: GameState): Move[] {
  const side = state.toMove;
  const enemy = opposite(side);
  const moves: Move[] = [];

  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const p = state.board[r][f];
      if (!p || sideOf(p) !== side) continue;
      const candidates = pseudoMovesFrom(state, r, f);
      for (const m of candidates) {
        // Castling needs extra checks: not in check, and king's path squares
        // are not attacked.
        if (m.castle) {
          if (inCheck(state, side)) continue;
          const homeRank = side === 'w' ? 0 : 7;
          const through = m.castle === 'K' ? [5, 6] : [3, 2];
          let ok = true;
          for (const tf of through) {
            if (isSquareAttacked(state.board, homeRank, tf, enemy)) {
              ok = false; break;
            }
          }
          if (!ok) continue;
        }
        const after = applyMove(state, m);
        if (!inCheck(after, side)) moves.push(m);
      }
    }
  }
  return moves;
}

/** Compact textual key for a position (for repetition detection). */
export function positionKey(state: GameState): string {
  let s = '';
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) s += state.board[r][f] || '.';
  }
  s += `|${state.toMove}`;
  s += `|${state.castling.wK ? 'K' : ''}${state.castling.wQ ? 'Q' : ''}${state.castling.bK ? 'k' : ''}${state.castling.bQ ? 'q' : ''}`;
  s += `|${state.enPassant ? squareName(state.enPassant) : '-'}`;
  return s;
}

function hasInsufficientMaterial(board: Piece[][]): boolean {
  // Count non-king material per side. Returns true for K vs K, K+B vs K,
  // K+N vs K, and K+B vs K+B with same-coloured bishops.
  const pieces: { side: Side; piece: string; r: number; f: number }[] = [];
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const p = board[r][f];
      if (!p) continue;
      if (p.toLowerCase() === 'k') continue;
      pieces.push({ side: sideOf(p)!, piece: p.toLowerCase(), r, f });
    }
  }
  if (pieces.length === 0) return true;
  if (pieces.length === 1 &&
    (pieces[0].piece === 'b' || pieces[0].piece === 'n')) return true;
  if (pieces.length === 2 &&
    pieces.every((p) => p.piece === 'b')) {
    const colour = (r: number, f: number) => (r + f) % 2;
    if (colour(pieces[0].r, pieces[0].f) === colour(pieces[1].r, pieces[1].f)) {
      return true;
    }
  }
  return false;
}

export function status(state: GameState): Status {
  const moves = legalMoves(state);
  const checked = inCheck(state, state.toMove);
  if (moves.length === 0) return checked ? 'checkmate' : 'stalemate';
  if (state.halfmove >= 100) return 'fifty-move';
  if (hasInsufficientMaterial(state.board)) return 'insufficient';

  // Threefold: count current position in history.
  const cur = state.history[state.history.length - 1] ?? positionKey(state);
  let count = 0;
  for (const k of state.history) if (k === cur) count += 1;
  if (count >= 3) return 'threefold';

  return checked ? 'check' : 'ongoing';
}

/** Find a move in `legal` that matches a from->to square (any promotion).
 *  Used by the UI to look up a move from clicks. */
export function findMove(
  legal: Move[],
  from: Square,
  to: Square,
): Move | null {
  for (const m of legal) {
    if (m.from[0] === from[0] && m.from[1] === from[1] &&
      m.to[0] === to[0] && m.to[1] === to[1]) {
      return m;
    }
  }
  return null;
}

/** All promotion moves matching a from->to. Returned in Q,R,B,N order. */
export function promotionsFor(
  legal: Move[],
  from: Square,
  to: Square,
): Move[] {
  return legal.filter((m) =>
    m.promotion &&
    m.from[0] === from[0] && m.from[1] === from[1] &&
    m.to[0] === to[0] && m.to[1] === to[1],
  );
}

// === SAN-ish move notation for the move list (compact, not strict SAN) ===

const PIECE_LETTER: Record<string, string> = {
  k: 'K', q: 'Q', r: 'R', b: 'B', n: 'N', p: '',
};

export function moveToSan(state: GameState, m: Move): string {
  if (m.castle === 'K') return suffix('O-O');
  if (m.castle === 'Q') return suffix('O-O-O');
  const piece = m.piece.toLowerCase();
  const letter = PIECE_LETTER[piece];
  const fromName = squareName(m.from);
  const toName = squareName(m.to);
  let dis = '';

  // Disambiguation: if another same-typed piece can also reach `to`, add file
  // (or rank, or full square) of the source.
  if (piece !== 'p' && piece !== 'k') {
    const others = legalMoves(state).filter((x) =>
      (x.from[0] !== m.from[0] || x.from[1] !== m.from[1]) &&
      x.piece === m.piece &&
      x.to[0] === m.to[0] && x.to[1] === m.to[1],
    );
    if (others.length > 0) {
      const sameFile = others.some((x) => x.from[1] === m.from[1]);
      const sameRank = others.some((x) => x.from[0] === m.from[0]);
      if (!sameFile) dis = fromName[0];
      else if (!sameRank) dis = fromName[1];
      else dis = fromName;
    }
  }

  const captureMark = m.captured
    ? piece === 'p' ? `${fromName[0]}x` : `${dis}x`
    : dis;
  const promo = m.promotion ? `=${m.promotion.toUpperCase()}` : '';
  return suffix(`${letter}${captureMark}${toName}${promo}`);

  function suffix(base: string): string {
    const after = applyMove(state, m);
    const oppInCheck = inCheck(after, after.toMove);
    if (!oppInCheck) return base;
    const reply = legalMoves(after);
    return reply.length === 0 ? `${base}#` : `${base}+`;
  }
}
