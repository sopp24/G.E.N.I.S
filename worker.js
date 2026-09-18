/**
 * GENIS Gateway — Cloudflare Worker
 * Secret ANTHROPIC_API_KEY is stored in Cloudflare, never in GitHub Pages.
 * Optional APP_SECRET filters casual use. Set ALLOWED_ORIGIN to your Pages origin.
 */
const DEFAULT_MODEL='claude-haiku-4-5-20251001';
const MAX_TOKENS=4096; const MAX_CHARS=70000;
export default { async fetch(request,env){
  const cors=corsHeaders(env); if(request.method==='OPTIONS')return new Response(null,{headers:cors});
  if(request.method!=='POST')return json({error:{message:'GENIS Gateway accepte uniquement POST'}},405,cors);
  if(env.APP_SECRET){const got=request.headers.get('x-app-secret')||'';if(got!==env.APP_SECRET)return json({error:{message:'Secret passerelle incorrect'}},403,cors);}
  if(!env.ANTHROPIC_API_KEY)return json({error:{message:'ANTHROPIC_API_KEY non configurée'}},500,cors);
  let body;try{body=await request.json()}catch{return json({error:{message:'JSON invalide'}},400,cors)}
  if(!body||!Array.isArray(body.messages)||!body.messages.length)return json({error:{message:'messages requis'}},400,cors);
  const msgs=body.messages.slice(-14).map(m=>({role:m.role==='assistant'?'assistant':'user',content:String(m.content||'').slice(0,MAX_CHARS)}));
  const content=String(msgs[msgs.length-1].content||'').trim();if(!content)return json({error:{message:'message vide'}},400,cors);
  const model=typeof body.model==='string'&&body.model.trim()?body.model.trim():DEFAULT_MODEL;
  const maxTokens=Math.min(Math.max(Number(body.max_tokens)||900,1),MAX_TOKENS);
  let upstream;try{upstream=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':env.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01'},body:JSON.stringify({model,max_tokens:maxTokens,stream:true,messages:msgs})});}
  catch{return json({error:{message:'Impossible de joindre le fournisseur IA'}},502,cors)}
  const h=new Headers(cors);h.set('content-type',upstream.headers.get('content-type')||'text/event-stream');return new Response(upstream.body,{status:upstream.status,headers:h});
}};
function corsHeaders(env){const h=new Headers();h.set('Access-Control-Allow-Origin',env.ALLOWED_ORIGIN||'*');h.set('Access-Control-Allow-Methods','POST, OPTIONS');h.set('Access-Control-Allow-Headers','content-type, x-app-secret');h.set('Vary','Origin');return h;}
function json(obj,status,cors){const h=new Headers(cors);h.set('content-type','application/json');return new Response(JSON.stringify(obj),{status,headers:h});}
