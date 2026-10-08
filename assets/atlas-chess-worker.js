importScripts('vendor/chess-1.4.0.js','atlas-chess-ai.js');
self.onmessage=({data})=>{
  try{const game=new AtlasChess();if(data.pgn)game.loadPgn(data.pgn);self.postMessage({move:AtlasChessAI.choose(game)});}
  catch{self.postMessage({error:'Не удалось рассчитать ход. Попробуй ещё раз.'});}
};
