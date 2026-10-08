export function createHandler({Chess,getUser,readMatch,write}){
 const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json'};
 const reply=(body,status=200)=>new Response(JSON.stringify(body),{headers,status});
 return async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers});
  if(req.method!=='POST')return reply({error:'Метод не поддерживается.'},405);
  try{
   const token=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
   const user=token?await getUser(token):null;
   if(!user)return reply({error:'Войди в аккаунт.'},401);
   const text=await req.text();if(text.length>4096)return reply({error:'Слишком большой запрос.'},413);
   const body=JSON.parse(text);
   if(!['invite','accept','decline','resign','move'].includes(body.action))return reply({error:'Неизвестное действие.'},400);
   const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
   if(body.action==='invite'?!uuid(body.opponent):(!uuid(body.match)||!Number.isInteger(body.revision)||body.revision<0))return reply({error:'Некорректная партия.'},400);
   let state=null;
   if(body.action==='move'){
    const m=await readMatch(body.match);
    if(!m||![m.white_user,m.black_user].includes(user.id))return reply({error:'Нет доступа к партии.'},403);
    if(m.status!=='active'||m.revision!==body.revision)return reply({error:'Партия обновилась. Нажми «обновить».'},409);
    const color=user.id===m.white_user?'w':'b';
    const game=new Chess();if(m.pgn)game.loadPgn(m.pgn);
    if(game.turn()!==color||game.isGameOver())return reply({error:'Сейчас нельзя сделать ход.'},409);
    if(!/^[a-h][1-8]$/.test(body.from)||!/^[a-h][1-8]$/.test(body.to)||!['q','r','b','n',undefined].includes(body.promotion))return reply({error:'Некорректный ход.'},400);
    try{game.move({from:body.from,to:body.to,...(body.promotion?{promotion:body.promotion}:{})});}catch{return reply({error:'Этот ход запрещён правилами.'},400);}
    state={pgn:game.pgn(),fen:game.fen(),turn:game.turn(),result:game.isCheckmate()?color:game.isDraw()?'draw':null};
   }
   const match=await write({p_actor:user.id,p_action:body.action,p_match:body.match||null,p_opponent:body.opponent||null,p_revision:body.revision??null,p_state:state});
   return reply({match});
  }catch(e){return reply({error:e.code==='23505'?'У вас уже есть приглашение или незавершённая партия.':e.code==='40001'?'Партия обновилась. Нажми «обновить».':'Не удалось выполнить действие. Обнови партию и попробуй ещё раз.'},400);}
 };
}
