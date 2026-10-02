(function(root){
  'use strict';
  const lines=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  function outcome(b){for(const l of lines)if(b[l[0]]&&l.every(i=>b[i]===b[l[0]]))return b[l[0]];return b.every(Boolean)?'draw':null;}
  function ai(b){
    function score(board,turn){const result=outcome(board);if(result)return result==='O'?10:result==='X'?-10:0;
      const scores=board.flatMap((v,i)=>{if(v)return [];const next=board.slice();next[i]=turn;return [score(next,turn==='O'?'X':'O')];});return turn==='O'?Math.max(...scores):Math.min(...scores);}
    let best=-Infinity,move=-1;
    for(const i of [4,0,2,6,8,1,3,5,7])if(!b[i]){const next=b.slice();next[i]='O';const value=score(next,'X');if(value>best){best=value;move=i;}}
    return move;
  }
  function slide(board,index){const empty=board.indexOf(0);if(Math.abs(Math.floor(empty/4)-Math.floor(index/4))+Math.abs(empty%4-index%4)!==1)return board;const next=board.slice();[next[empty],next[index]]=[next[index],next[empty]];return next;}
  const solved=b=>b.every((v,i)=>v===(i+1)%16);
  function puzzle(random=Math.random){let b=Array.from({length:16},(_,i)=>(i+1)%16),previous=-1;for(let n=0;n<220;n++){const e=b.indexOf(0),options=b.map((_,i)=>i).filter(i=>i!==previous&&slide(b,i)!==b);const i=options[Math.floor(random()*options.length)];b=slide(b,i);previous=e;}if(solved(b))b=slide(b,14);return b;}
  function food(body,size,random=Math.random){const free=[];for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(!body.some(p=>p.x===x&&p.y===y))free.push({x,y});return free.length?free[Math.floor(random()*free.length)]:null;}
  function snakeStep(s,random=Math.random){if(s.over)return s;const head={x:s.body[0].x+s.direction.x,y:s.body[0].y+s.direction.y};const eating=head.x===s.food?.x&&head.y===s.food?.y;const tail=eating?s.body:s.body.slice(0,-1);if(head.x<0||head.y<0||head.x>=s.size||head.y>=s.size||tail.some(p=>p.x===head.x&&p.y===head.y))return {...s,over:true};const body=[head,...s.body];if(!eating)body.pop();const nextFood=eating?food(body,s.size,random):s.food;return {...s,body,food:nextFood,score:s.score+(eating?1:0),over:!nextFood};}
  const shapes=[[[1,1,1,1]],[[1,1],[1,1]],[[0,1,0],[1,1,1]],[[0,1,1],[1,1,0]],[[1,1,0],[0,1,1]],[[1,0,0],[1,1,1]],[[0,0,1],[1,1,1]]];
  const rotate=m=>m[0].map((_,x)=>m.map(row=>row[x]).reverse());
  function fits(board,p){return p.shape.every((row,y)=>row.every((v,x)=>!v||(p.x+x>=0&&p.x+x<10&&p.y+y>=0&&p.y+y<20&&!board[p.y+y][p.x+x])));}
  function lock(board,p){const next=board.map(r=>r.slice());p.shape.forEach((row,y)=>row.forEach((v,x)=>{if(v)next[p.y+y][p.x+x]=p.color;}));const kept=next.filter(r=>r.some(v=>!v)),count=20-kept.length;return {board:[...Array.from({length:count},()=>Array(10).fill(0)),...kept],lines:count};}
  const api={outcome,ai,slide,solved,puzzle,food,snakeStep,shapes,rotate,fits,lock};root.AtlasGamesEngine=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
