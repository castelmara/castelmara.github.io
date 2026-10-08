(function(root){
  'use strict';
  // Iterative deepening: finish a complete depth before replacing the chosen move.
  function choose(chess,budget=700){
    if(chess.isGameOver())return null;
    const deadline=Date.now()+budget,values={p:100,n:320,b:330,r:500,q:900,k:0};
    const ordered=()=>chess.moves({verbose:true}).sort((a,b)=>(values[b.captured]||0)-(values[a.captured]||0));
    function evaluate(){let score=0;for(const row of chess.board())for(const p of row)if(p){const advance=p.color==='w'?Number(p.square[1])-2:7-Number(p.square[1]);const center=3.5-Math.abs(p.square.charCodeAt(0)-97-3.5);score+=(p.color==='w'?1:-1)*(values[p.type]+(p.type==='p'?advance*5+center*4:0)+(p.type==='n'||p.type==='b'?center*7:0));}return score*(chess.turn()==='w'?1:-1);}
    function search(depth,alpha,beta,ply){
      if(Date.now()>deadline)throw new Error('budget');
      if(chess.isCheckmate())return -100000+ply;
      if(chess.isDraw())return 0;
      if(!depth)return evaluate();
      for(const move of ordered()){chess.move(move);let score;try{score=-search(depth-1,-beta,-alpha,ply+1);}finally{chess.undo();}alpha=Math.max(alpha,score);if(alpha>=beta)break;}return alpha;
    }
    let best=ordered()[0];
    for(let depth=1;depth<=3;depth++){
      let candidate=best,score=-Infinity;
      try{for(const move of ordered()){chess.move(move);let value;try{value=-search(depth-1,-Infinity,Infinity,1);}finally{chess.undo();}if(value>score){score=value;candidate=move;}}best=candidate;}catch(e){if(e.message!=='budget')throw e;break;}
    }
    return {from:best.from,to:best.to,...(best.promotion?{promotion:best.promotion}:{})};
  }
  root.AtlasChessAI={choose};if(typeof module!=='undefined')module.exports={choose};
})(typeof self!=='undefined'?self:globalThis);
