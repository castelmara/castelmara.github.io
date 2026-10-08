import {Chess} from 'npm:chess.js@1.4.0';
import {createHandler} from './handler.mjs';
const url=Deno.env.get('SUPABASE_URL')!;
const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const serverHeaders={apikey:secret,Authorization:`Bearer ${secret}`,'Content-Type':'application/json'};
async function rest(path:string,options:RequestInit={}){
 const response=await fetch(`${url}/rest/v1/${path}`,{...options,headers:serverHeaders});
 const data=await response.json();if(!response.ok)throw data;return data;
}
Deno.serve(createHandler({Chess,
 getUser:async(token:string)=>{const r=await fetch(`${url}/auth/v1/user`,{headers:{apikey:Deno.env.get('SUPABASE_ANON_KEY')!,Authorization:`Bearer ${token}`}});return r.ok?await r.json():null;},
 readMatch:async(id:string)=>(await rest(`atlas_chess_matches?id=eq.${id}&select=*`))[0],
 write:async(body:unknown)=>{const data=await rest('rpc/atlas_chess_write',{method:'POST',body:JSON.stringify(body)});return Array.isArray(data)?data[0]:data;}
}));
