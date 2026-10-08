importScripts('vendor/chess-1.4.0.js','atlas-chess-ai.js?v=20261008-levels');
self.onmessage=({data})=>{
  try{const game=new AtlasChess();if(data.pgn)game.loadPgn(data.pgn);self.postMessage({move:AtlasChessAI.choose(game,data.difficulty)});}
  catch{self.postMessage({error:'Не удалось рассчитать ход. Попробуй ещё раз.'});}
};
