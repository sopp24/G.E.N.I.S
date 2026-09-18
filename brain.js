import {storage} from './storage.js';
import {createTimer,getWeather,openService,webSearch,notify} from './tools.js';

function say(text,meta={}){return {text,meta}};
function parseMinutes(input){ const m=input.match(/(\d+(?:[.,]\d+)?)\s*(seconde?s?|sec|minute?s?|heure?s?|h|m)\b/i); if(!m)return null;let n=parseFloat(m[1].replace(',','.'));const u=m[2].toLowerCase();if(/^s/.test(u)||u==='sec')return n/60;if(/^h/.test(u)||u==='heure'||u==='heures')return n*60;return n; }
function memoryCommand(text){
 const add=text.match(/(?:souviens[- ]toi que|mémorise que|rappelle[- ]toi que)\s+(.+)/i); if(add){const item={id:`mem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`,text:add[1].trim(),createdAt:Date.now(),source:'user'};storage.memories=[item,...storage.memories];return say(`C’est mémorisé : « ${item.text} »`,{tool:'memory'});}
 if(/(?:oublie|supprime)\s+(?:ça|cela|cette mémoire)/i.test(text)){const memories=storage.memories;if(!memories.length)return say('Je n’ai pas de mémoire à supprimer.');storage.memories=memories.slice(1);return say('J’ai supprimé la mémoire la plus récente.',{tool:'memory'});}
 if(/(?:qu'?est[- ]ce que tu|que)\s+(?:mémoris|sais de moi)|mes mémoires|ce que tu retiens/i.test(text)){const m=storage.memories.slice(0,6);if(!m.length)return say('Je n’ai encore aucune mémoire enregistrée.');return say('Voici ce que j’ai en mémoire :\n'+m.map((x,i)=>`${i+1}. ${x.text}`).join('\n'),{tool:'memory'});}
}

export async function localIntent(text,context={}){
 const t=text.trim();
 const mem=memoryCommand(t);if(mem)return mem;
 const mins=parseMinutes(t);if(mins && /minuteur|chrono|timer|compte à rebours|dans\s+\d/i.test(t)){const task=createTimer(mins,`Minuteur ${Math.round(mins)} min`);return say(`C’est lancé. Minuteur de ${Math.round(mins)} minute${Math.round(mins)>1?'s':''}.`,{tool:'timer',task});}
 if(/quelle heure|heure est|il est quelle heure/i.test(t)){return say(`Il est ${new Intl.DateTimeFormat('fr-FR',{hour:'2-digit',minute:'2-digit'}).format(new Date())}.`,{tool:'clock'});}
 if(/météo|temps qu'?il fait|va pleuvoir|température/i.test(t)){const city=(t.match(/(?:à|a|pour|sur)\s+([A-Za-zÀ-ÿ' -]{2,40})$/i)||[])[1]||storage.settings.defaultCity||'';try{const w=await getWeather(city);const d=w.daily;return say(`À ${w.location}, ${w.label}, ${Math.round(w.current.temperature_2m)} °C (ressenti ${Math.round(w.current.apparent_temperature)} °C). Probabilité de précipitation : ${d?.precipitation_probability_max?.[0] ?? '?'} %.`,{tool:'weather'});}catch(e){return say(e.message||'Je ne peux pas consulter la météo pour le moment.',{tool:'weather',error:true});}}
 if(/ouvre|lance|mets|va sur|ouvre-moi|sur deezer|sur youtube|sur netflix|sur gmail|sur agenda/i.test(t)){const opened=openService(t);if(opened)return say(`J’ouvre ${opened.key}.`,{tool:'open_service'});}
 if(/cherche|recherche|trouve/i.test(t)&&t.length>6){webSearch(t.replace(/^(cherche|recherche|trouve)([- ]moi)?/i,'').trim());return say('Je prépare une recherche web dans un nouvel onglet. Je ne prétends pas avoir analysé les résultats tant que la page n’a pas été consultée.',{tool:'web_search'});}
 if(/souviens|mémorise|mémoire|rappelle/i.test(t)){return say('Je peux gérer ma mémoire depuis Réglages → Mémoire, ou utiliser « mémorise que… ».',{tool:'memory'});}
 if(/^notifi(?:e|cation)|rappelle-moi/i.test(t)){return say('Je peux créer une notification locale depuis le module Tâches. Formulez l’heure ou le délai souhaité.',{tool:'notification'});}
 if(/devoir|pronote|cours|emploi du temps/i.test(t)){webSearch(`Pronote ${t}`);return say('Je n’ai pas de connecteur Pronote configuré. J’ai ouvert une recherche pour éviter de simuler un accès.',{tool:'open_service'});}
 if(/restaurant|réserve|réservation|coiffeur|cinéma|uber/i.test(t)){return say('Je peux préparer la recherche, mais la réservation réelle nécessite un connecteur autorisé. Ouvrez Applications pour voir les connecteurs disponibles.',{tool:'booking'});}
 if(/mail|email|gmail|outlook/i.test(t)){return say('Le connecteur mail est prévu, mais aucun compte n’est encore connecté. Réglages → Comptes connectés.',{tool:'mail'});}
 if(/agenda|calendrier|réunion|rendez-vous/i.test(t)){return say('Le connecteur Google Agenda est prévu mais aucun compte n’est encore connecté. Réglages → Comptes connectés.',{tool:'calendar'});}
 if(/paiement|paye|achète|achat|commande/i.test(t)){return say('Cette action est protégée : aucun paiement n’est déclenché automatiquement dans cette version. Une authentification forte et la confirmation appropriée seront nécessaires.',{tool:'security',risk:4});}
 return null;
}

export async function aiChat(text,history=[]){
 const s=storage.settings;if(!s.gatewayUrl)return null;
 const headers={'Content-Type':'application/json'}; if(s.gatewaySecret)headers['x-app-secret']=s.gatewaySecret;
 const body={model:s.model,messages:[...history.slice(-12).map(m=>({role:m.role==='assistant'?'assistant':'user',content:m.content})),{role:'user',content:text}],max_tokens:900};
 const r=await fetch(s.gatewayUrl,{method:'POST',headers,body:JSON.stringify(body)});if(!r.ok){const msg=await r.text();throw new Error(msg||`Passerelle IA indisponible (${r.status})`)}
 const ct=r.headers.get('content-type')||'';
 if(ct.includes('text/event-stream')){const reader=r.body.getReader(),decoder=new TextDecoder();let buffer='',out='';while(true){const {done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});const lines=buffer.split('\n');buffer=lines.pop()||'';for(const line of lines){if(!line.startsWith('data:'))continue;const payload=line.slice(5).trim();if(!payload||payload==='[DONE]')continue;try{const j=JSON.parse(payload);const delta=j.delta?.text||j.completion||'';out+=delta;}catch{}}}if(out)return {text:out.trim()};}
 const j=await r.json();const content=j.content?.map(x=>x.text||'').join('')||j.text||j.message||'';return content?{text:content}:{text:'La passerelle IA a répondu sans contenu.'};
}
