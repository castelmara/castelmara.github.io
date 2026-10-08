(function(){
 'use strict';
 const Chess=window.AtlasChess,uid=()=>window.ATLAS_CURRENT_SESSION?.user?.id,client=()=>window.ATLAS_SUPABASE;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const names={k:'король',q:'ферзь',r:'ладья',b:'слон',n:'конь',p:'пешка'},symbols={k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'};
 let mode='ai',local=new Chess(),remote=new Chess(),host=null,worker=null,thinking=false,poll=null;
 let matches=[],players=[],selected='',from='',promotion=null,busy=false,message='',generation=0,reads=0,opponent='',loadedFor=null,remotePgn=null;
 const mounted=()=>!!host?.isConnected&&!!document.querySelector('#atlas-page-games.active #atlasChessRoot');
 const match=()=>matches.find(m=>m.id===selected);
 const game=()=>mode==='ai'?local:remote;
 const color=()=>mode==='ai'?'w':match()?.white_user===uid()?'w':'b';
 const canMove=()=>!busy&&!thinking&&!game().isGameOver()&&game().turn()===color()&&(mode==='ai'||match()?.status==='active');
 const button=(action,label,attrs='')=>'<button type="button" data-chess-action="'+action+'" '+attrs+'>'+label+'</button>';
 function resultText(g){
  if(g.isCheckmate())return 'Мат. Победили '+(g.turn()==='w'?'чёрные.':'белые.');
  if(g.isStalemate())return 'Ничья — пат.';
  if(g.isThreefoldRepetition())return 'Ничья — повторение позиции.';
  if(g.isInsufficientMaterial())return 'Ничья — недостаточно фигур для мата.';
  if(g.isDraw())return 'Ничья — правило 50 ходов.';
  return (thinking?'Компьютер думает…':g.turn()==='w'?'Ход белых.':'Ход чёрных.')+(g.isCheck()?' Шах!':'');
 }
 function boardHtml(g){
  const files=color()==='b'?'hgfedcba':'abcdefgh',ranks=color()==='b'?[1,2,3,4,5,6,7,8]:[8,7,6,5,4,3,2,1];
  const movable=canMove(),moves=from&&movable?g.moves({square:from,verbose:true}):[],last=g.history({verbose:true}).at(-1);
  return '<div class="chess-board" role="group" aria-label="шахматная доска">'+ranks.map((rank,row)=>[...files].map((file,col)=>{
   const square=file+rank,p=g.get(square),legal=moves.some(m=>m.to===square),checked=p?.type==='k'&&p.color===g.turn()&&g.isCheck();
   const label=square+(p?' · '+(p.color==='w'?'белые: ':'чёрные: ')+names[p.type]:' · пусто')+(legal?' · доступный ход':'');
   return '<button type="button" class="chess-square '+((file.charCodeAt(0)+rank)%2?'light':'dark')+(square===from?' selected':'')+(legal?' legal':'')+(checked?' checked':'')+(last&&(last.from===square||last.to===square)?' last':'')+'" data-square="'+square+'" aria-label="'+label+'" aria-pressed="'+(square===from)+'" '+(!movable||promotion?'disabled':'')+'>'+(p?'<span aria-hidden="true" class="chess-piece '+p.color+'">'+symbols[p.type]+'&#xfe0e;</span>':'')+(col===0?'<small class="chess-rank" aria-hidden="true">'+rank+'</small>':'')+(row===7?'<small class="chess-file" aria-hidden="true">'+file+'</small>':'')+'</button>';
  }).join('')).join('')+'</div>';
 }
 function render(){
  if(!mounted())return;
  let html='<div class="games-toolbar">'+button('ai','против компьютера','aria-pressed="'+(mode==='ai')+'"')+button('online','с игроком','aria-pressed="'+(mode==='online')+'"')+'</div>';
  if(mode==='ai')html+='<div class="games-toolbar">'+button('new','новая партия')+(message&&local.turn()==='b'?button('retry','повторить ход компьютера'):'')+'</div>';
  else if(!uid()){host.innerHTML=html+'<p class="games-hint">Войди в ATLAS, чтобы пригласить другого игрока.</p><div class="games-toolbar">'+button('login','войти')+'</div>';return;}
  else{
   html+='<div class="games-toolbar"><select id="atlasChessOpponent" aria-label="соперник в шахматах"><option value="">выбери игрока</option>'+players.filter(p=>p.id!==uid()).map(p=>'<option value="'+esc(p.id)+'" '+(p.id===opponent?'selected':'')+'>@'+esc(p.nickname)+'</option>').join('')+'</select>'+button('invite','пригласить',busy||!opponent?'disabled':'')+button('refresh','обновить',busy?'disabled':'')+'</div><div class="games-matches">'+matches.map(m=>{
    const other=m.white_user===uid()?m.black_user:m.white_user,p=players.find(p=>p.id===other);
    return button('match',esc(p?'@'+p.nickname:'игрок')+' · '+({invited:'приглашение',active:'игра',finished:'завершено',declined:'отменено'}[m.status]),'data-match="'+m.id+'" aria-pressed="'+(m.id===selected)+'" '+(busy?'disabled':''));
   }).join('')+'</div>';
   if(!match()){host.innerHTML=html+'<p class="games-hint">Выбери игрока и отправь приглашение. Оно появится у вас обоих здесь, во вкладке «шахматы».</p><p role="alert">'+esc(message)+'</p>';return;}
   const m=match();
   if(m.status==='invited')html+='<div class="games-toolbar">'+(m.black_user===uid()?button('accept','принять',busy?'disabled':''):'')+button('decline','отменить приглашение',busy?'disabled':'')+'</div>';
   if(m.status==='active')html+='<div class="games-toolbar">'+button('resign','сдаться',busy?'disabled':'')+'</div>';
  }
  const g=game(),m=match();let status=resultText(g);
  if(mode==='online'){
   if(m.status==='invited')status='Ожидаем принятия приглашения.';
   if(m.status==='declined')status='Приглашение отменено.';
   if(m.status==='finished')status=m.result==='draw'?'Ничья.':'Победили '+(m.result==='w'?'белые.':'чёрные.');
  }
  html+='<p class="games-status" role="status">'+esc(status)+'</p><p class="chess-side">Ты играешь '+(color()==='w'?'белыми':'чёрными')+'</p>';
  if(promotion)html+='<div class="chess-promotion" role="group" aria-label="превращение пешки"><p>Выбери фигуру:</p>'+['q','r','b','n'].map(p=>button('promote',names[p],'data-piece="'+p+'"')).join('')+button('cancel','отмена')+'</div>';
  html+=boardHtml(g)+'<p role="alert">'+esc(message)+'</p><p class="games-hint">Нажми на свою фигуру, затем на подсвеченную клетку. Для рокировки выбери короля и клетку через одну.</p>';
  const history=g.history();if(history.length)html+='<details class="chess-history"><summary>ходы · '+history.length+'</summary><p>'+history.map((move,i)=>(i%2===0?Math.floor(i/2+1)+'. ':'')+esc(move)).join(' ')+'</p></details>';
  host.innerHTML=html;
 }
 function cancelAI(){worker?.terminate();worker=null;thinking=false;}
 function think(){
  if(mode!=='ai'||!mounted()||document.hidden||local.turn()!=='b'||local.isGameOver()||thinking)return;
  cancelAI();thinking=true;message='';render();const expected=local.fen();
  try{
   worker=new Worker('assets/atlas-chess-worker.js?v=20261006-1');
   worker.onmessage=({data})=>{cancelAI();if(!mounted()||mode!=='ai'||local.fen()!==expected)return;try{if(data.error)throw new Error(data.error);if(data.move)local.move(data.move);}catch{message='Не удалось рассчитать ход. Нажми «повторить ход компьютера».';}render();};
   worker.onerror=()=>{cancelAI();message='Не удалось загрузить компьютерного соперника. Нажми «повторить ход компьютера».';render();};
   worker.postMessage({pgn:local.pgn()});
  }catch{cancelAI();message='Не удалось запустить компьютерного соперника.';render();}
 }
 function installMatch(m){const changed=selected!==m?.id||remotePgn!==m?.pgn;selected=m?.id||'';if(changed){remote=new Chess();remotePgn=m?.pgn;if(m?.pgn)remote.loadPgn(m.pgn);from='';promotion=null;}}
 async function refresh(){
  if(mode!=='online'||!uid()||!client()||busy||!mounted())return;
  const viewer=uid(),token=generation,read=++reads;
  try{
   const [ms,ps]=await Promise.all([client().from('atlas_chess_matches').select('*').order('updated_at',{ascending:false}).limit(50),loadedFor===viewer?Promise.resolve({data:players}):client().from('profiles').select('id,nickname').order('nickname')]);
   if(ms.error||ps.error)throw ms.error||ps.error;
   if(viewer!==uid()||token!==generation||read!==reads||!mounted())return;
   const changed=!!message||JSON.stringify(ms.data)!==JSON.stringify(matches)||loadedFor!==viewer;
   matches=ms.data||[];players=ps.data||[];loadedFor=viewer;message='';installMatch(matches.find(m=>m.id===selected)||matches[0]);if(changed)render();
  }catch{if(viewer===uid()&&token===generation&&read===reads){message='Не удалось загрузить партии. Проверь соединение и нажми «обновить».';render();}}
 }
 async function send(action,move={}){
  if(busy||!uid()||!client())return;const viewer=uid(),token=generation,m=match();busy=true;reads++;message='';render();
  try{
   const r=await client().functions.invoke('atlas-chess',{body:{action,match:m?.id,revision:m?.revision,opponent:opponent||undefined,...move}});
   if(r.error){let detail;try{detail=await r.error.context?.json();}catch{}throw new Error(detail?.error||'Не удалось связаться с сервером. Проверь соединение.');}
   if(r.data?.error)throw new Error(r.data.error);
   if(viewer!==uid()||token!==generation)return;
   const updated=r.data.match;matches=[updated,...matches.filter(x=>x.id!==updated.id)];installMatch(updated);from='';promotion=null;
  }catch(e){if(viewer===uid()&&token===generation)message=e.message;}
  finally{if(token===generation){busy=false;render();}}
 }
 function move(to,piece){
  const move={from,to,...(piece?{promotion:piece}:{})};
  if(mode==='online'){send('move',move);return;}
  try{local.move(move);from='';promotion=null;render();think();}catch{message='Этот ход недоступен.';render();}
 }
 document.addEventListener('change',e=>{if(e.target.id==='atlasChessOpponent'){opponent=e.target.value;render();}});
 document.addEventListener('click',e=>{
  if(!e.target.closest('#atlasChessRoot'))return;const b=e.target.closest('button');if(!b||b.disabled)return;
  if(b.dataset.square){if(!canMove()||promotion)return;const sq=b.dataset.square,g=game(),legal=from?g.moves({square:from,verbose:true}).filter(m=>m.to===sq):[];
   if(legal.length){if(legal.some(m=>m.promotion)){promotion=sq;render();}else move(sq);return;}
   from=g.get(sq)?.color===color()&&sq!==from?sq:'';render();return;
  }
  const action=b.dataset.chessAction;
  if(action==='ai'||action==='online'){generation++;reads++;busy=false;cancelAI();mode=action;from='';promotion=null;message='';render();if(mode==='online')refresh();else think();return;}
  if(action==='new'){cancelAI();local=new Chess();from='';promotion=null;message='';render();return;}
  if(action==='retry'){think();return;}
  if(action==='login'){document.getElementById('atlasAccountButton')?.click();return;}
  if(action==='refresh'){refresh();return;}
  if(action==='match'){installMatch(matches.find(m=>m.id===b.dataset.match));message='';render();return;}
  if(action==='promote'){if(canMove()&&promotion)move(promotion,b.dataset.piece);return;}
  if(action==='cancel'){promotion=null;from='';render();return;}
  if(['invite','accept','decline','resign'].includes(action))send(action);
 });
 function leave(){clearInterval(poll);poll=null;cancelAI();generation++;reads++;busy=false;host=null;}
 window.AtlasChessUI={mount(el){clearInterval(poll);host=el;render();if(mode==='ai')think();else refresh();poll=setInterval(()=>{if(mounted()&&!document.hidden)refresh();},3000);},leave};
 window.addEventListener('atlasPlayerAuthReady',()=>{generation++;reads++;busy=false;matches=[];players=[];selected='';from='';promotion=null;opponent='';loadedFor=null;remotePgn=null;remote=new Chess();if(mounted()){render();refresh();}});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelAI();else if(mounted()){if(mode==='ai')think();else refresh();}});
})();
