(function(root){
  'use strict';
  const levels={
    easy:{budget:250,depth:1,quiescence:0},
    medium:{budget:1000,depth:3,quiescence:3},
    hard:{budget:3500,depth:7,quiescence:6}
  };
  // Keep a complete iteration if the worker runs out of thinking time.
  function choose(chess,level='medium'){
    if(chess.isGameOver())return null;
    const settings=typeof level==='number'?{...levels.medium,budget:level}:levels[level]||levels.medium;
    const deadline=Date.now()+settings.budget,values={p:100,n:320,b:335,r:500,q:900,k:0};
    const timeout={};
    function checkTime(){if(Date.now()>=deadline)throw timeout;}
    function order(moves,preferred){
      const rank=m=>(preferred&&m.from===preferred.from&&m.to===preferred.to&&m.promotion===preferred.promotion?100000:0)
        +(m.captured?10000+(values[m.captured]||0)*10-values[m.piece]:0)
        +(values[m.promotion]||0)+(m.san.includes('+')?50:0);
      return moves.sort((a,b)=>rank(b)-rank(a));
    }
    function evaluate(){
      const board=chess.board();let score=0,nonPawn=0;
      for(const row of board)for(const p of row)if(p&&p.type!=='p'&&p.type!=='k')nonPawn+=values[p.type];
      const endgame=nonPawn<2600;
      for(const row of board)for(const p of row)if(p){
        const file=p.square.charCodeAt(0)-97,rank=Number(p.square[1])-1;
        const advance=p.color==='w'?rank:7-rank;
        const center=7-Math.abs(file-3.5)-Math.abs(rank-3.5);
        let positional=0;
        if(p.type==='p')positional=advance*(endgame?12:6)+(3.5-Math.abs(file-3.5))*5;
        if(p.type==='n')positional=center*12;
        if(p.type==='b')positional=center*7+(advance>0?12:0);
        if(p.type==='r')positional=advance===6?25:0;
        if(p.type==='q')positional=center*3;
        if(p.type==='k')positional=endgame?center*12:-advance*15+(advance===0&&(file===6||file===2)?35:0);
        score+=(p.color==='w'?1:-1)*(values[p.type]+positional);
      }
      return score*(chess.turn()==='w'?1:-1);
    }
    function quiet(alpha,beta,ply,left){
      checkTime();
      if(chess.isCheckmate())return -100000+ply;
      if(chess.isDraw())return 0;
      const checked=chess.isCheck();
      if(left<=0)return evaluate();
      if(!checked){
        const stand=evaluate();if(stand>=beta)return stand;alpha=Math.max(alpha,stand);
      }
      // Never stand pat in check: include every legal evasion.
      const moves=chess.moves({verbose:true}).filter(m=>checked||m.captured||m.promotion);
      for(const move of order(moves)){
        chess.move(move);let score;
        try{score=-quiet(-beta,-alpha,ply+1,left-1);}finally{chess.undo();}
        if(score>=beta)return score;alpha=Math.max(alpha,score);
      }
      return alpha;
    }
    function search(depth,alpha,beta,ply){
      checkTime();
      if(chess.isCheckmate())return -100000+ply;
      if(chess.isDraw())return 0;
      if(!depth)return quiet(alpha,beta,ply,settings.quiescence);
      for(const move of order(chess.moves({verbose:true}))){
        chess.move(move);let score;
        try{score=-search(depth-1,-beta,-alpha,ply+1);}finally{chess.undo();}
        if(score>=beta)return score;alpha=Math.max(alpha,score);
      }
      return alpha;
    }
    const moves=chess.moves({verbose:true});let best=moves[0];
    for(let depth=1;depth<=settings.depth;depth++){
      let candidate=best,score=-Infinity;
      try{
        for(const move of order(moves,best)){
          checkTime();chess.move(move);let value;
          try{value=-search(depth-1,-Infinity,-score,1);}finally{chess.undo();}
          if(value>score){score=value;candidate=move;}
        }
        best=candidate;
        if(score>99000)break;
      }catch(e){if(e!==timeout)throw e;break;}
    }
    return {from:best.from,to:best.to,...(best.promotion?{promotion:best.promotion}:{})};
  }
  root.AtlasChessAI={choose};if(typeof module!=='undefined')module.exports={choose};
})(typeof self!=='undefined'?self:globalThis);
