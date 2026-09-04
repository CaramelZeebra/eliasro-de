// Web Worker shell around the bitboard solver.  Off-thread search keeps
// the modal's hover preview / "thinking…" caption painting smoothly while
// the solver chews through the position graph.

import { Position, solve } from './connect4Solver';

type Cell = 0 | 1 | 2;
interface Request {
  cells: Cell[][];
  turn: 1 | 2;
  budgetMs?: number;
}

self.addEventListener('message', (e: MessageEvent<Request>) => {
  const { cells, turn, budgetMs } = e.data;
  const pos = Position.fromCells(cells, turn);
  const result = solve(pos, budgetMs);
  (self as unknown as Worker).postMessage(result);
});
