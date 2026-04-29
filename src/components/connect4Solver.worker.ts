// Web Worker shell around the bitboard solver.  Off-thread search keeps
// the modal's hover preview / "thinking…" caption painting smoothly while
// the solver chews through the position graph.

import { Position, solve, rankMoves } from './connect4Solver';

type Cell = 0 | 1 | 2;
interface SolveRequest {
  op?: 'solve';
  cells: Cell[][];
  turn: 1 | 2;
  budgetMs?: number;
}
interface RankRequest {
  op: 'rank';
  cells: Cell[][];
  turn: 1 | 2;
  budgetMs?: number;
}
type Request = SolveRequest | RankRequest;

self.addEventListener('message', (e: MessageEvent<Request>) => {
  const { cells, turn, budgetMs } = e.data;
  const pos = Position.fromCells(cells, turn);
  if (e.data.op === 'rank') {
    const ranked = rankMoves(pos, budgetMs);
    (self as unknown as Worker).postMessage({ op: 'rank', ranked });
  } else {
    const result = solve(pos, budgetMs);
    (self as unknown as Worker).postMessage(result);
  }
});
