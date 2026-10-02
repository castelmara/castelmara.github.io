(function(){
  'use strict';
  const E=window.AtlasGamesEngine,uid=()=>window.ATLAS_CURRENT_SESSION?.user?.id,client=()=>window.ATLAS_SUPABASE;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let game='tetris',mode='ai',timer,poll,paused=true,over=false,snake,piece,well,points=0,cleared=0,tiles,moves=0,board=Array(9).fill(''),matches=[],players=[],selected='',busy=false,epoch=0,readVersion=0,networkMessage='',loadedFor=null;
  const active=()=>!!document.querySelector('#atlas-page-games.active');
  const root=()=>document.getElementById('atlasGamesRoot');
  const current=()=>matches.find(m=>m.id===selected);
  function stop(){clearTimeout(timer);timer=null;paused=true;}
  function status(text){const el=root()?.querySelector('.games-status');if(el)el.textContent=text;}
  function button(action,text,extra=''){return '<button type="button" data-game-action="'+action+'" '+extra+'>'+text+'</button>';}
  function tabs(){return '<nav class="games-tabs" aria-label="игры">'+[['tetris','тетрис'],['snake','змейка'],['puzzle','пятнашки'],['ttt','крестики-нолики']].map(([id,label])=>button('switch',label,'data-game="'+id+'" aria-pressed="'+(game===id)+'"')).join('')+'</nav>';}
  function render(){
    if(!root())return;
    let html='';
    if(game==='tetris'||game==='snake')html='<div class="games-toolbar">'+button('start','новая игра')+button('pause',paused?'продолжить':'пауза')+'</div><p class="games-status" role="status"></p><canvas tabindex="0" aria-label="'+(game==='tetris'?'Поле тетриса':'Поле змейки')+'" width="'+(game==='tetris'?240:360)+'" height="'+(game==='tetris'?480:360)+'"></canvas><div class="games-pad">'+[['left','←'],['up',game==='tetris'?'↻':'↑'],['down','↓'],['right','→'],...(game==='tetris'?[['drop','сбросить вниз']]:[])].map(([a,l])=>button(a,l)).join('')+'</div><p class="games-hint">'+(game==='tetris'?'← → / A D — движение, ↑ / W — поворот, ↓ / S — быстрее, пробел — сброс.':'Стрелки или WASD — движение. Не врезайся в стены и хвост.')+' На телефоне используй кнопки. При уходе со страницы игра ставится на паузу.</p>';
    if(game==='puzzle')html='<div class="games-toolbar">'+button('start','перемешать')+'</div><p class="games-status" role="status"></p><div class="games-board puzzle">'+tiles.map((v,i)=>'<button type="button" data-tile="'+i+'" '+(!v?'disabled aria-label="пустая клетка"':'')+'>'+ (v||'')+'</button>').join('')+'</div><p class="games-hint">Собери числа от 1 до 15. Нажимай на плитку рядом с пустой клеткой.</p>';
    if(game==='ttt')html='<div class="games-toolbar">'+button('ai','против компьютера','aria-pressed="'+(mode==='ai')+'"')+button('online','с игроком','aria-pressed="'+(mode==='online')+'"')+'</div>'+tttHtml();
    root().innerHTML=tabs()+'<section class="games-stage">'+html+'</section>';
    if(game==='snake'||game==='tetris')draw();
    if(game==='puzzle')status(E.solved(tiles)?'Собрано! Ходов: '+moves:'Ходов: '+moves);
  }
  function playerName(id){const p=players.find(p=>p.id===id);return p?'@'+p.nickname:'игрок';}
  function tttHtml(){
    let b=board,text='',controls='';
    if(mode==='ai'){const result=E.outcome(b);text=result?(result==='draw'?'Ничья!':result==='X'?'Ты победила / победил!':'Компьютер победил.'):'Твой ход — X';controls=button('start','новая партия');}
    else{
      if(!uid())return '<p>Войди в аккаунт ATLAS, чтобы пригласить другого игрока.</p>'+button('login','войти');
      controls='<div class="games-toolbar"><select aria-label="соперник" id="atlasGameOpponent"><option value="">выбери игрока</option>'+players.filter(p=>p.id!==uid()).map(p=>'<option value="'+esc(p.id)+'">@'+esc(p.nickname)+'</option>').join('')+'</select>'+button('invite','пригласить',busy?'disabled':'')+button('refresh','обновить')+'</div><div class="games-matches">'+matches.map(m=>button('match',esc(playerName(m.x_user===uid()?m.o_user:m.x_user))+' · '+({invited:'приглашение',active:'игра',finished:'завершено',declined:'отменено'}[m.status]),'data-match="'+esc(m.id)+'" aria-pressed="'+(selected===m.id)+'"')).join('')+'</div>';
      const m=current();
      if(!m)return controls+'<p>Пригласи игрока или выбери партию. Приглашения появятся здесь у обоих участников.</p><p role="alert">'+esc(networkMessage)+'</p>';
      b=m.board;const mark=m.x_user===uid()?'X':'O';
      text='Ты — '+mark+'. '+(m.status==='invited'?'Ожидаем принятия приглашения.':m.status==='declined'?'Приглашение отменено.':m.status==='finished'?(m.result==='draw'?'Ничья!':m.result===mark?'Ты победила / победил!':'Победил соперник.'):(m.turn===mark?'Твой ход.':'Ход соперника.'));
      if(m.status==='invited')controls+=(m.o_user===uid()?button('accept','принять',busy?'disabled':''):'')+button('decline','отменить приглашение',busy?'disabled':'');
      if(m.status==='active')controls+=button('resign','сдаться',busy?'disabled':'');
    }
    const m=current(),play=mode==='ai'?!E.outcome(b):m?.status==='active'&&m.turn===(m.x_user===uid()?'X':'O')&&!busy;
    return controls+'<p class="games-status" role="status">'+esc(text)+'</p><div class="games-board">'+b.map((v,i)=>'<button type="button" data-cell="'+i+'" aria-label="клетка '+(i+1)+(v?', '+v:'')+'" '+(!play||v?'disabled':'')+'>'+esc(v)+'</button>').join('')+'</div><p role="alert">'+esc(networkMessage)+'</p>';
  }
  function spawn(){const n=Math.floor(Math.random()*E.shapes.length);piece={x:3,y:0,shape:E.shapes[n].map(r=>r.slice()),color:n+1};if(!E.fits(well,piece)){over=true;stop();}}
  function reset(){stop();points=0;cleared=0;moves=0;over=false;
    if(game==='snake'){snake={size:18,body:[{x:8,y:8},{x:7,y:8},{x:6,y:8}],direction:{x:1,y:0},score:0,over:false};snake.food=E.food(snake.body,18);snake.turned=false;}
    if(game==='tetris'){well=Array.from({length:20},()=>Array(10).fill(0));spawn();}
    if(game==='puzzle')tiles=E.puzzle();
    if(game==='ttt')board=Array(9).fill('');
    render();
  }
  function draw(){const canvas=root()?.querySelector('canvas');if(!canvas)return;const ctx=canvas.getContext('2d');ctx.fillStyle='#10151b';ctx.fillRect(0,0,canvas.width,canvas.height);
    if(game==='snake'&&snake){ctx.fillStyle='#ee6e78';if(snake.food)ctx.fillRect(snake.food.x*20+2,snake.food.y*20+2,16,16);snake.body.forEach((p,i)=>{ctx.fillStyle=i?'#82c8aa':'#d8f5a2';ctx.fillRect(p.x*20+1,p.y*20+1,18,18)});points=snake.score;}
    if(game==='tetris'&&well){const colors=['','#80cbd5','#e7c867','#bd8ccf','#8cca9b','#eb8181','#7e9cdb','#eba867'];const cell=(x,y,v)=>{ctx.fillStyle=colors[v];ctx.fillRect(x*24+1,y*24+1,22,22)};well.forEach((r,y)=>r.forEach((v,x)=>{if(v)cell(x,y,v)}));piece.shape.forEach((r,y)=>r.forEach((v,x)=>{if(v)cell(piece.x+x,piece.y+y,piece.color)}));}
    status((over?'Игра окончена. ':paused?'Пауза. ':'')+'Счёт: '+points+(game==='tetris'?' · линий: '+cleared:''));
  }
  function step(){if(paused||!active()||document.hidden)return;
    if(game==='snake'){snake=E.snakeStep(snake);snake.turned=false;over=snake.over;}
    else if(game==='tetris')fall();
    if(over){stop();render();return;}draw();timer=setTimeout(step,game==='snake'?Math.max(65,160-snake.score*4):Math.max(90,650-Math.floor(cleared/5)*60));
  }
  function fall(){const next={...piece,y:piece.y+1};if(E.fits(well,next))piece=next;else{const locked=E.lock(well,piece);well=locked.board;points+=[0,100,300,500,800][locked.lines];cleared+=locked.lines;spawn();}}
  function control(action){if(paused||over)return;
    if(game==='snake'){const d={left:{x:-1,y:0},right:{x:1,y:0},up:{x:0,y:-1},down:{x:0,y:1}}[action];if(d&&!snake.turned&&d.x!==-snake.direction.x&&d.y!==-snake.direction.y){snake.direction=d;snake.turned=true;}}
    else if(game==='tetris'){if(action==='drop'){while(E.fits(well,{...piece,y:piece.y+1})){piece.y++;points++;}fall();}else if(action==='down')fall();else{const next={...piece};if(action==='up')next.shape=E.rotate(piece.shape);else next.x+=action==='left'?-1:action==='right'?1:0;if(E.fits(well,next))piece=next;}draw();}
  }
  async function refresh(){
    if(!uid()||!client()||busy)return;const viewer=uid(),token=epoch,readToken=++readVersion;
    try{const [m,p]=await Promise.all([client().from('atlas_ttt_matches').select('*').order('updated_at',{ascending:false}).limit(50),client().from('profiles').select('id,nickname').order('nickname')]);if(m.error)throw m.error;if(p.error)throw p.error;if(uid()!==viewer||epoch!==token)return;
      if(readToken!==readVersion)return;
      const changed=!!networkMessage||JSON.stringify(matches)!==JSON.stringify(m.data)||loadedFor!==viewer;matches=m.data||[];players=p.data||[];loadedFor=viewer;networkMessage='';if(!matches.some(m=>m.id===selected))selected=matches[0]?.id||'';if(changed&&active()&&game==='ttt'&&mode==='online')render();
    }catch(e){if(uid()===viewer&&epoch===token){networkMessage='Не удалось загрузить партии. Проверь соединение и нажми «обновить».';const el=root()?.querySelector('[role="alert"]');if(el)el.textContent=networkMessage;}}
  }
  async function action(name,cell){if(busy||!uid()||!client())return;const viewer=uid(),token=epoch,m=current(),opponent=root()?.querySelector('#atlasGameOpponent')?.value;readVersion++;busy=true;networkMessage='';render();
    try{const r=await client().rpc('atlas_ttt_action',{p_action:name,p_match:m?.id||null,p_opponent:opponent||null,p_cell:cell??null,p_revision:m?.revision??null});if(r.error)throw r.error;if(uid()!==viewer||token!==epoch)return;selected=r.data.id;matches=[r.data,...matches.filter(x=>x.id!==r.data.id)];}
    catch(e){if(uid()===viewer&&token===epoch)networkMessage=e.code==='23505'?'Приглашение уже существует. Обнови список.':e.message||'Не удалось сохранить ход.';}
    finally{if(token===epoch){busy=false;if(uid()===viewer)render();}}
  }
  document.addEventListener('click',e=>{if(!e.target.closest('#atlasGamesRoot'))return;const b=e.target.closest('button');if(!b)return;
    if(b.dataset.tile!=null){const next=E.slide(tiles,Number(b.dataset.tile));if(next!==tiles){tiles=next;moves++;render();}return;}
    if(b.dataset.cell!=null){const i=Number(b.dataset.cell);if(mode==='online'){action('move',i);return;}if(board[i]||E.outcome(board))return;board[i]='X';if(!E.outcome(board)){const move=E.ai(board);if(move>=0)board[move]='O';}render();return;}
    const a=b.dataset.gameAction;
    if(a==='switch'){game=b.dataset.game;networkMessage='';reset();return;}
    if(a==='start'){reset();if(['tetris','snake'].includes(game)){paused=false;render();step();}return;}
    if(a==='pause'){if(over)return;if(paused){paused=false;render();step();}else{stop();render();}return;}
    if(a==='ai'||a==='online'){mode=a;networkMessage='';render();if(a==='online')refresh();return;}
    if(a==='login'){document.getElementById('atlasAccountButton')?.click();return;}
    if(a==='refresh'){refresh();return;}
    if(a==='match'){selected=b.dataset.match;render();return;}
    if(['invite','accept','decline','resign'].includes(a)){action(a);return;}
    control(a);
  });
  document.addEventListener('keydown',e=>{if(!active()||!['tetris','snake'].includes(game)||e.target.closest('input,textarea,select,dialog')||e.ctrlKey||e.metaKey||e.altKey)return;const a={KeyA:'left',KeyD:'right',KeyW:'up',KeyS:'down'}[e.code]||{arrowleft:'left',a:'left',arrowright:'right',d:'right',arrowup:'up',w:'up',arrowdown:'down',s:'down',' ':'drop'}[e.key.toLowerCase()];if(a){e.preventDefault();control(a);}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();if(active())render();}});
  window.addEventListener('atlasPlayerAuthReady',()=>{epoch++;busy=false;matches=[];players=[];selected='';loadedFor=null;if(active()){render();if(mode==='online')refresh();}});
  window.atlasRenderGames=function(page){clearInterval(poll);stop();if(page!=='games')return;if(!well||!tiles){tiles=E.puzzle();reset();}else render();if(game==='ttt'&&mode==='online')refresh();poll=setInterval(()=>{if(!active()){clearInterval(poll);stop();return;}if(!document.hidden&&game==='ttt'&&mode==='online')refresh();},3000);};
  if(active())window.atlasRenderGames('games');
})();
