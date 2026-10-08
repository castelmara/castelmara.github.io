const assert = require('node:assert/strict');
const { Chess } = require('../assets/vendor/chess-1.4.0.js');
const { choose } = require('../assets/atlas-chess-ai.js');
const trap = '6k1/8/4p3/3r4/8/8/8/3Q2K1 w - - 0 1';
for (const level of ['easy', 'medium', 'hard']) {
  const game = new Chess(trap), before = game.fen(), started = Date.now();
  const move = choose(game, level);
  assert.equal(game.fen(), before, 'Search / timeout restores the board');
  assert.deepEqual(game.history(), [], 'Search restores history too');
  assert(Date.now() - started < 6000, 'Thinking is bounded');
  if (level === 'easy') assert.equal(move.to, 'd5', 'One-ply opponent takes the bait');
  else assert.notEqual(move.to, 'd5', 'Stronger levels see the pawn recapturing their queen');
  assert(game.move(move), 'Chosen move is legal');
  const mate = new Chess(); ['f3', 'e5', 'g4'].forEach(m => mate.move(m));
  mate.move(choose(mate, level)); assert(mate.isCheckmate(), level + ' finds mate in one');
}
const interrupted = new Chess(), original = interrupted.fen();
assert(interrupted.move(choose(interrupted, 0)), 'Zero budget still returns a legal fallback');
interrupted.undo(); assert.equal(interrupted.fen(), original);
assert.equal(choose(new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'), 'hard'), null);
console.log('PASS difficulty: three levels, defended-piece trap, mate, legal fallback, bounded time, restored history, stalemate');
