/**
 * GENIS Gateway — Cloudflare Worker
 * Configure APP_SECRET and the selected provider API key as Cloudflare Secrets.
 * AI_PROVIDER may be anthropic or openai. ALLOWED_ORIGIN is a comma-separated list of exact origins.
 */
const DEFAULT_MODELS={anthropic:'claude-haiku-4-5-20251001',openai:'gpt-4.1-mini'};
const MAX_TOKENS=4096;
const MAX_CHARS_PER_MESSAGE=70000;
const MAX_TOTAL_CHARS=180000;

export default {
  async fetch(request,env){
    const origin=request.headers.get('Origin')||'';
    const allowedOrigins=String(env.ALLOWED_ORIGIN||'').split(',').map(x=>x.trim()).filter(Boolean);
    if(!allowedOrigins.length||allowedOrigins.includes('*')){
      return json({error:{message:'ALLOWED_ORIGIN doit contenir au moins une origine exacte autorisée.'}},503);
    }
    if(!origin||!allowedOrigins.includes(origin)){
      return json({error:{message:'Origine non autorisée.'}},403);
    }
    const cors=corsHeaders(origin);
    if(request.method==='OPTIONS')return new Response(null,{headers:cors});
    if(request.method!=='POST')return json({error:{message:'GENIS Gateway accepte uniquement POST.'}},405,cors);
    if(!env.APP_SECRET)return json({error:{message:'APP_SECRET doit être configuré côté Cloudflare.'}},503,cors);
    const suppliedSecret=request.headers.get('x-app-secret')||'';
    if(suppliedSecret!==env.APP_SECRET)return json({error:{message:'Secret passerelle incorrect.'}},403,cors);
    let body;
    try{body=await request.json();}catch{return json({error:{message:'JSON invalide.'}},400,cors);}
    if(!body||!Array.isArray(body.messages)||!body.messages.length){
      return json({error:{message:'Le champ messages est requis.'}},400,cors);
    }

    const messages=[];
    for(const item of body.messages.slice(-20)){
      if(!item||typeof item.content!=='string')continue;
      const role=item.role==='assistant'?'assistant':'user';
      const content=item.content.slice(0,MAX_CHARS_PER_MESSAGE);
      if(!content.trim())continue;
      const previous=messages[messages.length-1];
      if(previous&&previous.role===role)previous.content+='\n\n'+content;
      else messages.push({role,content});
    }
    while(messages.length&&messages[0].role==='assistant')messages.shift();
    if(!messages.length||messages[messages.length-1].role!=='user'){
      return json({error:{message:'Le dernier message doit être une demande utilisateur.'}},400,cors);
    }
    const totalChars=messages.reduce((sum,m)=>sum+m.content.length,0);
    if(totalChars>MAX_TOTAL_CHARS)return json({error:{message:'La conversation est trop volumineuse.'}},413,cors);

    const provider=String(body.provider||env.AI_PROVIDER||'anthropic').toLowerCase();
    if(!['anthropic','openai'].includes(provider))return json({error:{message:'Fournisseur IA non pris en charge. Choisissez anthropic ou openai.'}},400,cors);
    const apiKey=provider==='openai'?env.OPENAI_API_KEY:env.ANTHROPIC_API_KEY;
    if(!apiKey)return json({error:{message:provider==='openai'?'OPENAI_API_KEY non configurée dans Cloudflare.':'ANTHROPIC_API_KEY non configurée dans Cloudflare.'}},503,cors);
    const model=typeof body.model==='string'&&body.model.trim()?body.model.trim():DEFAULT_MODELS[provider];
    const maxTokens=Math.min(Math.max(Number(body.max_tokens)||1800,1),MAX_TOKENS);
    let upstream;
    try{
      if(provider==='anthropic'){
        upstream=await fetch('https://api.anthropic.com/v1/messages',{
          method:'POST',headers:{'content-type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01'},
          body:JSON.stringify({model,max_tokens:maxTokens,system:typeof body.system==='string'?body.system:'',stream:true,messages})
        });
      }else{
        const openAIMessages=[];
        if(typeof body.system==='string'&&body.system.trim())openAIMessages.push({role:'system',content:body.system});
        openAIMessages.push(...messages);
        upstream=await fetch('https://api.openai.com/v1/chat/completions',{
          method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${apiKey}`},
          body:JSON.stringify({model,max_tokens:maxTokens,stream:true,messages:openAIMessages})
        });
      }
    }catch{return json({error:{message:'Impossible de joindre le fournisseur IA.'}},502,cors);}
    if(!upstream.ok){
      let detail='Le fournisseur IA a refusé la demande.';
      try{const data=await upstream.clone().json();detail=data.error?.message||data.message||detail;}catch{}
      return json({error:{message:detail}},upstream.status,cors);
    }

    const headers=new Headers(cors);
    headers.set('content-type',upstream.headers.get('content-type')||'text/event-stream');
    headers.set('cache-control','no-store');
    headers.set('x-content-type-options','nosniff');
    return new Response(upstream.body,{status:upstream.status,headers});
  }
};

function corsHeaders(origin){
  const headers=new Headers();
  headers.set('Access-Control-Allow-Origin',origin);
  headers.set('Access-Control-Allow-Methods','POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers','content-type, x-app-secret');
  headers.set('Access-Control-Max-Age','86400');
  headers.set('Vary','Origin');
  return headers;
}
function json(obj,status,cors){
  const headers=new Headers(cors||{});
  headers.set('content-type','application/json; charset=utf-8');
  headers.set('cache-control','no-store');
  headers.set('x-content-type-options','nosniff');
  return new Response(JSON.stringify(obj),{status,headers});
}
