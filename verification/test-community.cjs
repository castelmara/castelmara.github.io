const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('path').join(__dirname,'../assets/atlas-community.js'),'utf8');
const html=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8');
const tests=[];const test=(n,f)=>tests.push([n,f]);const clone=x=>JSON.parse(JSON.stringify(x));
function env(){
 const chars=[{id:'a',name:'Алиса',cardImage:'https://original/card.jpg',avatar:'https://original/photo.jpg',banner:'https://original/banner.jpg'}];
 const calls=[],events={},winEvents={},nodes={};
 const doc={querySelectorAll:()=>[],querySelector:()=>null,getElementById:id=>nodes[id]||null,addEventListener:(n,f)=>(events[n]||=[]).push(f)};
 const data={character_owners:[{character_id:'a',user_id:'u1'}],profiles:[{id:'u1',nickname:'alice',display_name:'Алиса'}],atlas_character_customizations:[],atlas_teams:[{id:'foxes',name:'foxes',sport:'football'}],atlas_team_members:[{character_id:'a',kind:'athlete',team_id:'foxes',position:'forward',captaincy:'none',visible:true}],atlas_character_catalog:[{id:'a',name:'Алиса',active:true}],atlas_notes:[]};
 const hooks={};
 const client={from(table){const q={table,filters:{},action:'select',select(fields){this.fields=fields;return this},eq(k,v){this.filters[k]=v;return this},order(){return this},limit(){return this},maybeSingle(){this.single=true;return this},update(row){this.action='update';this.row=clone(row);return this},insert(row){this.action='insert';this.row=clone(row);return this},delete(){this.action='delete';return this},then(ok,fail){calls.push(this);if(hooks.query)return Promise.resolve(hooks.query(this)).then(ok,fail);let result=(data[table]||[]).filter(r=>Object.entries(this.filters).every(([k,v])=>r[k]===v));if(this.action!=='select')result=[{...this.row,updated_at:'new'}];return Promise.resolve({data:this.single?result[0]||null:clone(result)}).then(ok,fail)}};return q},rpc(n,args){calls.push({rpc:n,args});return Promise.resolve(hooks.rpc?hooks.rpc(n,args):{data:n==='atlas_favorite_count'?3:true})},storage:{from(){return {upload(p,f){calls.push({upload:p});return Promise.resolve({data:{path:p}})},getPublicUrl(p){return{data:{publicUrl:'https://storage/'+p}}},remove(paths){calls.push({remove:paths});return Promise.resolve({data:[]})}}}}};
 const win={ATLAS_CHARACTERS:chars,ATLAS_CARD_ONLY:[],ATLAS_SUPABASE:client,ATLAS_CURRENT_SESSION:{user:{id:'u1'}},addEventListener:(n,f)=>(winEvents[n]||=[]).push(f)};
 class FormData {constructor(form){this.f=form.fields}get(k){return this.f[k]??null}has(k){return Object.hasOwn(this.f,k)}}
 const ctx={window:win,document:doc,console,URL,TextEncoder,crypto:{randomUUID:()=> 'file-id'},FormData,Map,Set,Promise,setTimeout,clearTimeout,confirm:()=>true};
 const exports=`window.test={run:s=>eval(s),save:saveCharacter,relations:relationsHtml,social:hydrateSocial,validate:validateImage,characterDisplayName};`;
 vm.runInNewContext(source.replace(/\}\)\(\);\s*$/,exports+'})();'),ctx);
 return {win,doc,data,calls,hooks,nodes,api:win.test,chars};
}
test('Changing interior media keeps the catalog source unchanged',async()=>{
 const e=env(),before=clone(e.chars);e.api.run("editor={kind:'character',id:'a',user:'u1',urls:[],saving:false,original:{updated_at:'old',photo_url:'https://old/photo.jpg',banner_url:'https://old/banner.jpg'}}");
 await e.api.save({fields:{reset_photo:'on'},querySelectorAll:()=>[]});
 const write=e.calls.find(x=>x.action==='update');assert.equal(write.row.photo_url,null);assert.equal(write.row.banner_url,'https://old/banner.jpg');assert.equal(write.filters.updated_at,'old');assert.deepEqual(e.chars,before);assert(!Object.hasOwn(write.row,'cardImage'));
});
test('Partner editor saves love only, preserving other relations and customization fields',async()=>{
 const e=env();e.api.run("editor={kind:'character',id:'a',user:'u1',urls:[],saving:false,loveOnly:true,relations:{friends:{items:[{name:'Friend'}]},love:{items:[{name:'Old'}]}},original:{updated_at:'old',photo_url:'photo',banner_url:'banner',indicators:{items:[]}}}");
 const values={relation_group:'friends',relation_target:'',relation_name:'New partner',relation_label:'любовный интерес',relation_text:'описание'};
 const row={querySelector:s=>({value:values[s.match(/name="([^"]+)"/)[1]]})};
 await e.api.save({fields:{},querySelectorAll:()=>[row]});
 const write=e.calls.find(x=>x.action==='update');
 assert.equal(write.row.relations.love.items[0].name,'New partner');
 assert.equal(write.row.relations.friends.items[0].name,'Friend');
 for(const k of ['photo_url','banner_url','indicators']) assert(!Object.hasOwn(write.row,k));
 assert.equal(write.filters.updated_at,'old');
});
test('Partner can be removed without deleting other relations',async()=>{
 const e=env();e.api.run("editor={kind:'character',id:'a',user:'u1',urls:[],saving:false,loveOnly:true,relations:{family:{items:[{name:'Family'}]},love:{items:[{name:'Old'}]}},original:{updated_at:'old'}}");
 await e.api.save({fields:{},querySelectorAll:()=>[]});
 const write=e.calls.find(x=>x.action==='update');assert(!write.row.relations.love);assert.equal(write.row.relations.family.items[0].name,'Family');
});
test('Partner overview escapes copy and offers editing only when allowed',()=>{
 const e=env();const out=e.api.run("partnerHtml({id:'a'},{love:{items:[{name:'<script>x</script>',relation:'партнёр'}]}},false)");
 assert(out.includes('&lt;script&gt;'));assert(!out.includes('data-community-partner-edit'));
 assert(e.api.run("partnerHtml({id:'a'},null,true)").includes('data-community-partner-edit="a"'));
});
test('Stale character edit is rejected without replacing the cached result',async()=>{
 const e=env();e.api.run("editor={kind:'character',id:'a',user:'u1',urls:[],saving:false,original:{updated_at:'old'}}");
 e.hooks.query=()=>({data:[]});await e.api.save({fields:{},querySelectorAll:()=>[]});assert.equal(e.api.run('custom.has("a")'),false);assert.equal(e.api.run('editor.saving'),false);
});
test('Account switch prevents an old editor from writing',async()=>{
 const e=env();e.api.run("editor={kind:'character',id:'a',user:'previous-user',urls:[],saving:false,original:null}");await e.api.save({fields:{},querySelectorAll:()=>[]});assert.equal(e.calls.filter(x=>x.action==='insert'||x.action==='update').length,0);
});
test('An unsuccessful save removes newly uploaded images',async()=>{
 const e=env();e.api.run("editor={kind:'character',id:'a',user:'u1',urls:[],saving:false,original:null}");e.hooks.query=()=>({error:{code:'42501',message:'denied'}});
 await e.api.save({fields:{photo:{name:'x.png',size:100,type:'image/png'}},querySelectorAll:()=>[]});assert.equal(e.calls.filter(x=>x.upload).length,1);assert.deepEqual(clone(e.calls.find(x=>x.remove).remove),['u1/characters/a/photo-file-id.png']);
});
test('Profile media rejects oversized files and active document formats',()=>{const e=env();assert.throws(()=>e.api.validate({type:'image/svg+xml',size:50}));assert.throws(()=>e.api.validate({type:'image/png',size:9*1024*1024}));e.api.validate({type:'image/jpeg',size:2000});});
test('Relations render user text as text, not markup',()=>{
 const e=env();const out=e.api.relations({friends:{items:[{name:'<img src=x onerror=alert(1)>',relation:'<svg>',text:'<script>bad()</script>',targetId:'unknown'}]}});assert(!out.includes('<script>'));assert(!out.includes('<img'));assert(out.includes('&lt;script&gt;'));
});
test('Roster authority and source come from the server',async()=>{
 const e=env();e.hooks.rpc=()=>({data:false});const rows=await e.win.atlasLoadRoster();assert.equal(rows[0].team,'foxes');assert.equal(e.api.run('rosterAllowed'),false);assert(e.calls.some(c=>c.rpc==='atlas_can_manage_rosters'));assert(!e.calls.some(c=>c.table==='profiles'&&c.action!=='select'));
});
test('Team rosters use the catalog Russian name priority and original-name fallback',()=>{
 const e=env();
 const nested={id:'nested',profile:{overview:{mainInfo:{fullName:'Педро Исмаэль Мартинес'}}},fullName:'Другое имя',cardName:'Pedro Martinez',originalName:'Pedro Ismael Martinez'};
 const top={id:'top',fullName:'Сильвия Руис Рамос',cardName:'Silvia Ruiz Ramos',originalName:'Silvia Ruiz Ramos'};
 const card={id:'card',cardName:'Федерико Эррера',originalName:'Federico Herrera'};
 const fallback={id:'fallback',cardName:'Federico Herrera',originalName:'Federico Pablo Herrera'};
 assert.equal(e.api.characterDisplayName(nested),'Педро Исмаэль Мартинес');
 assert.equal(e.api.characterDisplayName(top),'Сильвия Руис Рамос');
 assert.equal(e.api.characterDisplayName(card),'Федерико Эррера');
 assert.equal(e.api.characterDisplayName(fallback),'Federico Pablo Herrera');
});
test('A late roster response cannot restore permissions after account change',async()=>{
 const e=env();let resolve;e.hooks.rpc=()=>new Promise(r=>resolve=r);const pending=e.win.atlasLoadRoster();e.win.ATLAS_CURRENT_SESSION.user.id='u2';resolve({data:true});await assert.rejects(pending,/Аккаунт изменился/);assert.equal(e.api.run('rosterAllowed'),false);
});
test('Superadmin sees the top roster editor and permission refresh works without roster content',async()=>{
 const e=env(),toolbar={innerHTML:'',hidden:true,querySelector:()=>null};e.nodes.atlasRosterHeroActions=toolbar;
 e.win.ATLAS_CURRENT_PROFILE={id:'u1',role:'superadmin'};e.api.run('renderRosterActions()');assert.equal(toolbar.hidden,false);
 e.hooks.query=()=>({error:{message:'roster temporarily unavailable'}});await assert.rejects(e.win.atlasLoadRoster());
 assert.equal(toolbar.hidden,false);assert(toolbar.innerHTML.includes('data-community-roster-edit'));assert.equal(e.api.run('rosterAllowedFor'),'u1');
});
test('Passion admin receives server-approved access; stale superadmin profile does not authorize another account',async()=>{
 const e=env(),toolbar={innerHTML:'',hidden:true,querySelector:()=>null};e.nodes.atlasRosterHeroActions=toolbar;
 e.win.ATLAS_CURRENT_PROFILE={id:'u1',role:'admin',nickname:'passion'};await e.api.run('refreshRosterAccess()');assert.equal(toolbar.hidden,false);
 e.win.ATLAS_CURRENT_SESSION.user.id='u2';e.win.ATLAS_CURRENT_PROFILE={id:'u1',role:'superadmin'};e.api.run('renderRosterActions()');assert.equal(toolbar.hidden,true);
 e.hooks.rpc=()=>({data:false});await e.api.run('refreshRosterAccess()');assert.equal(toolbar.hidden,true);assert.equal(e.api.run('rosterAllowed'),false);
});
test('Public profile reads only public target notes and an anonymous aggregate',async()=>{
 const e=env(),section={dataset:{},innerHTML:'',isConnected:true},container={querySelector:()=>section};
 e.data.atlas_notes=[{id:'private',user_id:'u2',target_type:'player',target_id:'u1',is_public:false,body:'secret'},{id:'public',user_id:'u1',target_type:'player',target_id:'u1',is_public:true,body:'visible'}];
 await e.api.social(container,'player','u1');assert(section.innerHTML.includes('visible'));assert(!section.innerHTML.includes('secret'));assert(!e.calls.some(x=>x.table==='atlas_favorites'));assert(e.calls.some(x=>x.rpc==='atlas_favorite_count'));
});
test('New note privacy is opt-in and editing checks the current owner',()=>{
 assert(html.includes('name="is_public" type="checkbox">'));
 assert(html.includes('row.is_public=!!(isPublic&&target&&target.target_id)'));
 assert(html.includes("update(row).eq('id',noteId).eq('user_id',user)"));
});
test('Student cards separate course, faculty and department without guessing missing years',()=>{
 const e=env();
 const details=e.api.run("cardDetails({category:'estudiantes',profile:{overview:{mainInfo:{course:'2 курс',faculty:'факультет игровых видов спорта, кафедра хоккея'}}}})");
 assert.equal(details.badge,'2 КУРС');assert.equal(details.sportBadge,'хоккей');assert.deepEqual(clone(details.lines),['игровые виды спорта']);
 assert.equal(e.api.run("cardDetails({category:'estudiantes',profile:{overview:{mainInfo:{course:'последний курс'}}}}).badge"),'последний курс');
 assert.equal(e.api.run("cardDetails({category:'estudiantes',age:22}).badge"),'');
 assert.equal(e.api.run("cardDetails({category:'entrenadores',year:3}).badge"),'тренер');
 assert.equal(e.api.run("cardDetails({category:'castelmara',card:{tag:'преподаватель'},year:4}).badge"),'преподаватель');
});
test('Card display labels preserve academic data and coaches have no description',()=>{
 const e=env();
 const info=Object.freeze({course:'3 курс',faculty:'факультет спортивной медицины и реабилитации',department:'кафедра физиотерапии и реабилитации'});
 e.chars[0].category='estudiantes';e.chars[0].profile={overview:{mainInfo:info}};
 const before=JSON.stringify(e.chars[0]);
 const details=e.api.run("cardDetails(character('a'))");
 assert.deepEqual(clone(details.lines),['медицина и реабилитация','физиотерапия и реабилитация']);
 assert.equal(JSON.stringify(e.chars[0]),before);
 const coach=e.api.run("cardDetails({category:'entrenadores',card:{tag:'старый badge'},subtitle:'описание кафедры',role:'должность'})");
 assert.equal(coach.badge,'тренер');assert.deepEqual(clone(coach.lines),[]);
});
test('Sport badges replace only their matching department display line without changing data',()=>{
 const e=env();
 for(const [department,sport] of [['футбола','футбол'],['хоккея','хоккей'],['баскетбола','баскетбол'],['волейбола','волейбол'],['тенниса','теннис'],['плавания','плавание'],['водных видов спорта','водные виды спорта'],['фигурного катания','фигурное катание']]){
  e.chars[0].category='estudiantes';
  e.chars[0].profile={overview:{mainInfo:Object.freeze({course:'2 курс',faculty:'факультет индивидуальных видов спорта',department:'кафедра '+department})}};
  const before=JSON.stringify(e.chars[0]),details=e.api.run("cardDetails(character('a'))");
  assert.equal(details.sportBadge,sport);assert.deepEqual(clone(details.lines),['индивидуальные виды спорта']);
  const markup=e.api.run("cardDetailsHtml(character('a'))");
  assert(new RegExp('class="atlas-character-card-badge sport-[^"]+">'+sport+'</span>').test(markup));assert(!markup.includes('<p>'+department+'</p>'));
  assert.equal(JSON.stringify(e.chars[0]),before);
 }
 e.chars[0].profile.overview.mainInfo=Object.freeze({faculty:'факультет индивидуальных видов спорта',department:'кафедра зимних индивидуальных видов спорта'});
 let details=e.api.run("cardDetails(character('a'))");
 assert.equal(details.sportBadge,'');assert.deepEqual(clone(details.lines),['индивидуальные виды спорта','зимних индивидуальных видов спорта']);
 e.chars[0].tags=['figure skating'];
 details=e.api.run("cardDetails(character('a'))");assert.equal(details.sportBadge,'фигурное катание');assert.deepEqual(clone(details.lines),['индивидуальные виды спорта']);
 e.chars[0].profile.overview.mainInfo=Object.freeze({faculty:'факультет спортивной медицины и реабилитации',department:'кафедра физиотерапии и реабилитации'});
 details=e.api.run("cardDetails(character('a'))");assert.equal(details.sportBadge,'');assert.deepEqual(clone(details.lines),['медицина и реабилитация','физиотерапия и реабилитация']);
});
test('Profile hydration inserts one portrait into the existing overview and reuses it',async()=>{
 const e=env(),photos=[],social={dataset:{},innerHTML:'',isConnected:true};
 const side={prepend:node=>photos.unshift(node),querySelector:selector=>selector==='.atlas-community-social'?social:null};
 const overview={querySelector:selector=>selector==='.atlas-community-portrait'?photos[0]||null:selector==='.atlas-profile-overview-left'?side:null};
 let editButton=null,allowed=true;
 const hero={appendChild:node=>{editButton=node;node.remove=()=>{editButton=null}}};
 const root={dataset:{},querySelector:selector=>selector==='[data-character-tab-panel="overview"]'?overview:selector==='.atlas-profile-hero'?hero:selector==='[data-community-edit]'?editButton:null};
 e.nodes.atlasCharacterProfileRoot=root;
 e.doc.createElement=()=>({dataset:{},innerHTML:'',hidden:false});
 e.hooks.rpc=name=>({data:name==='atlas_favorite_count'?3:name==='atlas_can_edit_character'?allowed:false});
 await e.win.atlasHydrateCommunityCharacter('a');
 await e.win.atlasHydrateCommunityCharacter('a');
 assert.equal(photos.length,1);assert.equal(photos[0].className,'atlas-community-portrait');
 assert(photos[0].innerHTML.includes('https://original/photo.jpg'));assert.equal(photos[0].hidden,false);
 assert.equal(editButton.textContent,'редактировать анкету');assert.equal(editButton.dataset.communityEdit,'a');
 allowed=false;await e.win.atlasHydrateCommunityCharacter('a');assert.equal(editButton,null,'No edit button without RPC permission');
});
test('Registered account wins over static labels and never uses a persona nickname',async()=>{
 const e=env();e.chars[0].player={name:'Old Player',id:'not-an-account'};
 e.win.ATLAS_PERSONAS=[{character_id:'a',nickname:'persona-only'}];
 await e.api.run('loadOwners(true)');
 const markup=e.api.run("cardPlayerHtml(character('a'))");
 assert(markup.includes('data-community-player="u1"'));assert(markup.includes('@alice'));
 assert(!markup.includes('Old Player'));assert(!markup.includes('persona-only'));assert(!markup.includes('not-an-account'));
});
test('Static player is escaped plain text; missing player produces no row',()=>{
 const e=env();e.chars[0].player={name:'<Old Player>',id:'static-id'};
 const markup=e.api.run("cardPlayerHtml(character('a'))");
 assert(markup.includes('&lt;Old Player&gt;'));assert(!markup.includes('<button'));assert(!markup.includes('data-community-player'));
 assert.equal(e.api.run("cardPlayerHtml({id:'unknown'})"),'');
 e.win.ATLAS_CHARACTER_DIRECTORY=[{id:'a',player:'Directory Player'}];e.chars[0].player={};
 assert(e.api.run("cardPlayerHtml(character('a'))").includes('Directory Player'));
});
test('Owner changes update one footer without touching academic copy or retaining old names',async()=>{
 const e=env(),children=[],academic={innerHTML:'academic copy'};
 const container={querySelector:selector=>selector==='.atlas-community-owner'?children[0]||null:academic,appendChild:node=>children.push(node)};
 e.doc.createElement=()=>({dataset:{},innerHTML:'',hidden:false});e.win.testCard=container;
 e.chars[0].player={name:'Fallback Player'};
 await e.api.run('loadOwners(true)');e.api.run("decoratePlayerBlock(window.testCard,character('a'))");
 assert.equal(children.length,1);assert(children[0].innerHTML.includes('@alice'));
 e.data.character_owners=[];await e.api.run('loadOwners(true)');e.api.run("decoratePlayerBlock(window.testCard,character('a'))");
 assert.equal(children.length,1);assert(children[0].innerHTML.includes('Fallback Player'));assert(!children[0].innerHTML.includes('@alice'));
 e.chars[0].player={};e.api.run("decoratePlayerBlock(window.testCard,character('a'))");
 assert.equal(children[0].innerHTML,'');assert.equal(children[0].hidden,true);assert.equal(academic.innerHTML,'academic copy');
});
test('Login distinguishes transport failures from server credential errors',async()=>{
 const authSource=html.slice(html.indexOf('  function atlasAuthErrorMessage('),html.indexOf('  async function invokeAtlasUser('));
 let response,thrown;const client={functions:{async invoke(){if(thrown)throw thrown;return response}}};
 const ctx=vm.createContext({client});vm.runInContext(authSource,ctx);
 const network='Не удалось связаться с сервером ATLAS.';
 for(const error of [{name:'FunctionsFetchError',message:'Failed to send a request to the Edge Function'},{name:'FunctionsRelayError',message:'Relay failed'},{name:'TypeError',message:'Failed to fetch'},{name:'TypeError',message:'Load failed'},{name:'AuthRetryableFetchError',message:'Network unavailable',status:0}]) {
  response={error};await assert.rejects(ctx.invokeAtlasAuth({action:'login'}),e=>e.message.startsWith(network));
 }
 thrown={name:'TypeError',message:'Failed to fetch'};
 await assert.rejects(ctx.invokeAtlasAuth({action:'login'}),e=>e.message.startsWith(network));thrown=null;
 for(const message of ['неверный логин или пароль','слишком много попыток','ошибка сервера']) {
  response={error:{name:'FunctionsHttpError',status:400,message:'non-2xx',context:{async json(){return {error:message}}}}};
  await assert.rejects(ctx.invokeAtlasAuth({action:'login'}),e=>e.message===message);
 }
 response={data:{error:'неверный пароль'}};await assert.rejects(ctx.invokeAtlasAuth({}),e=>e.message==='неверный пароль');
 response={data:{session:{access_token:'test-only'}}};assert.equal((await ctx.invokeAtlasAuth({})).session.access_token,'test-only');
 assert.equal(ctx.atlasAuthErrorMessage({name:'TypeError',message:'Unexpected code failure'}),'Unexpected code failure');
 assert.equal(ctx.atlasAuthErrorMessage({name:'AuthRetryableFetchError',status:503,message:'Service unavailable'}),'Service unavailable');
});
(async()=>{for(const [n,f] of tests){await f();console.log('PASS',n)}console.log(tests.length+' community checks passed; mocked APIs, no live database.');})().catch(e=>{console.error(e);process.exitCode=1});
