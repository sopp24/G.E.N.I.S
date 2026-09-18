import {storage, uid} from './storage.js';

export const TOOL_CATALOG=[
  {name:'timer',label:'Minuteur',risk:1,description:'Créer un minuteur local.'},
  {name:'clock',label:'Heure',risk:1,description:'Lire l’heure locale.'},
  {name:'weather',label:'Météo',risk:1,description:'Prévisions via Open-Meteo.'},
  {name:'open_service',label:'Ouvrir un service',risk:1,description:'Ouvrir une application ou un service web.'},
  {name:'memory',label:'Mémoire',risk:1,description:'Ajouter, consulter ou supprimer une mémoire.'},
  {name:'automation',label:'Automatisations',risk:2,description:'Créer ou exécuter une règle locale.'},
  {name:'web_search',label:'Recherche web',risk:1,description:'Ouvrir une recherche web préparée.'},
  {name:'notification',label:'Notification',risk:1,description:'Créer une notification locale.'}
];

export async function getWeather(city=''){
  let lat,lon,name=city;
  if(!city && navigator.geolocation){
    const pos=await new Promise(resolve=>navigator.geolocation.getCurrentPosition(resolve,()=>resolve(null),{timeout:8000,maximumAge:300000}));
    if(pos){lat=pos.coords.latitude;lon=pos.coords.longitude;name='ma position';}
  }
  if(lat==null){ if(!city) throw new Error('Je n’ai pas de ville. Indiquez une ville ou autorisez la localisation.'); const geo=await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=fr&format=json`).then(r=>r.json());const hit=geo.results?.[0];if(!hit)throw new Error('Ville introuvable.');lat=hit.latitude;lon=hit.longitude;name=hit.name; }
  const data=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=3`).then(r=>r.json());
  const code=data.current.weather_code; const labels={0:'ciel dégagé',1:'principalement dégagé',2:'partiellement nuageux',3:'couvert',45:'brouillard',48:'brouillard givrant',51:'bruine légère',53:'bruine',55:'bruine forte',61:'pluie faible',63:'pluie',65:'forte pluie',71:'neige faible',73:'neige',75:'forte neige',80:'averses faibles',81:'averses',82:'fortes averses',95:'orage',96:'orage avec grêle',99:'orage avec forte grêle'};
  return {location:name,current:data.current,daily:data.daily,label:labels[code]||'conditions météo particulières'};
}

export function createTimer(minutes,label='Minuteur'){
  const seconds=Math.max(1,Math.round(minutes*60));const id=uid('timer'); const task={id,type:'timer',label,dueAt:Date.now()+seconds*1000,createdAt:Date.now(),status:'running'}; const tasks=storage.tasks.filter(t=>t.status!=='done');tasks.push(task);storage.tasks=tasks;return task;
}
export function cancelTimer(id){storage.tasks=storage.tasks.map(t=>t.id===id?{...t,status:'cancelled'}:t)}
export function openService(name){
 const urls={deezer:'https://www.deezer.com/',youtube:'https://www.youtube.com/',netflix:'https://www.netflix.com/',disney:'https://www.disneyplus.com/',prime:'https://www.primevideo.com/',gmail:'https://mail.google.com/',outlook:'https://outlook.live.com/',calendar:'https://calendar.google.com/',maps:'https://maps.google.com/',sncf:'https://www.sncf-connect.com/',vinted:'https://www.vinted.fr/',amazon:'https://www.amazon.fr/',thomann:'https://www.thomann.de/fr/',leboncoin:'https://www.leboncoin.fr/',doctolib:'https://www.doctolib.fr/',franceinfo:'https://www.franceinfo.fr/'};
 const key=Object.keys(urls).find(k=>name.toLowerCase().includes(k)); const url=key?urls[key]:null;if(!url)return null;window.open(url,'_blank','noopener');return {key,url};
}

export function webSearch(q){const url=`https://www.google.com/search?q=${encodeURIComponent(q)}`;window.open(url,'_blank','noopener');return url;}
export function notify(title,body){
 const entry={id:uid('notif'),title,body,createdAt:Date.now(),read:false};storage.notifications=[entry,...storage.notifications].slice(0,100);
 if('Notification' in window && Notification.permission==='granted') new Notification(title,{body}); return entry;
}
