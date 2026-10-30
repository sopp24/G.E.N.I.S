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

const WEATHER_LABELS={0:'ciel dégagé',1:'principalement dégagé',2:'partiellement nuageux',3:'couvert',45:'brouillard',48:'brouillard givrant',51:'bruine légère',53:'bruine',55:'bruine forte',61:'pluie faible',63:'pluie',65:'forte pluie',71:'neige faible',73:'neige',75:'forte neige',80:'averses faibles',81:'averses',82:'fortes averses',95:'orage',96:'orage avec grêle',99:'orage avec forte grêle'};

export async function getWeather(city='',dayOffset=0){
  let lat,lon,name=city;
  if(!city&&storage.permissions.location&&navigator.geolocation){
    const pos=await new Promise(resolve=>navigator.geolocation.getCurrentPosition(resolve,()=>resolve(null),{timeout:8000,maximumAge:300000}));
    if(pos){lat=pos.coords.latitude;lon=pos.coords.longitude;name='ma position';}
  }
  if(lat==null){
    if(!city)throw new Error('Aucune ville définie. Indiquez une ville ou activez la permission de localisation dans GENIS.');
    const response=await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=fr&format=json`);
    if(!response.ok)throw new Error('Le service de géolocalisation des villes est indisponible.');
    const geo=await response.json();const hit=geo.results?.[0];if(!hit)throw new Error('Ville introuvable.');lat=hit.latitude;lon=hit.longitude;name=hit.name;
  }
  const response=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=3`);
  if(!response.ok)throw new Error('Le service météo est temporairement indisponible.');
  const data=await response.json();const offset=Math.max(0,Math.min(Number(dayOffset)||0,(data.daily?.time?.length||1)-1));
  const code=data.daily?.weather_code?.[offset]??data.current?.weather_code;
  const forecast={date:data.daily?.time?.[offset]||null,label:WEATHER_LABELS[code]||'conditions météo particulières',minimum:data.daily?.temperature_2m_min?.[offset],maximum:data.daily?.temperature_2m_max?.[offset],precipitationProbability:data.daily?.precipitation_probability_max?.[offset]};
  return {location:name,current:data.current,daily:data.daily,label:WEATHER_LABELS[data.current?.weather_code]||'conditions météo particulières',forecast};
}

export function createTimer(minutes,label='Minuteur'){
  const seconds=Math.max(1,Math.round(minutes*60));const id=uid('timer'); const task={id,type:'timer',label,dueAt:Date.now()+seconds*1000,createdAt:Date.now(),status:'running'}; const tasks=storage.tasks.filter(t=>t.status!=='done');tasks.push(task);storage.tasks=tasks;return task;
}
export function cancelTimer(id){storage.tasks=storage.tasks.map(t=>t.id===id?{...t,status:'cancelled'}:t)}
export function openService(name){
 const urls={
  deezer:'https://www.deezer.com/',spotify:'https://open.spotify.com/',youtube:'https://www.youtube.com/',twitch:'https://www.twitch.tv/',
  netflix:'https://www.netflix.com/',disney:'https://www.disneyplus.com/',prime:'https://www.primevideo.com/',canal:'https://www.canalplus.com/',
  gmail:'https://mail.google.com/',outlook:'https://outlook.live.com/',calendar:'https://calendar.google.com/',agenda:'https://calendar.google.com/',
  drive:'https://drive.google.com/',docs:'https://docs.google.com/document/',sheets:'https://sheets.google.com/',slides:'https://slides.google.com/',
  maps:'https://maps.google.com/',slack:'https://slack.com/',discord:'https://discord.com/app',teams:'https://teams.microsoft.com/',
  sncf:'https://www.sncf-connect.com/',vinted:'https://www.vinted.fr/',amazon:'https://www.amazon.fr/',thomann:'https://www.thomann.de/fr/',
  leboncoin:'https://www.leboncoin.fr/',doctolib:'https://www.doctolib.fr/',pronote:'https://www.index-education.com/fr/pronote-info.php',
  ameli:'https://www.ameli.fr/',franceinfo:'https://www.franceinfo.fr/'
 };
 const normalized=String(name||'').toLocaleLowerCase('fr');
 const key=Object.keys(urls).sort((a,b)=>b.length-a.length).find(k=>normalized.includes(k));
 const url=key?urls[key]:null;if(!url)return null;
 const tab=window.open(url,'_blank');if(tab){try{tab.opener=null;}catch{}}
 return {key,url,opened:!!tab};
}

export function webSearch(q){const url=`https://www.google.com/search?q=${encodeURIComponent(q)}`;const tab=window.open(url,'_blank');if(tab){try{tab.opener=null;}catch{}}return {url,opened:!!tab};}
export function notify(title,body){
 const entry={id:uid('notif'),title,body,createdAt:Date.now(),read:false};storage.notifications=[entry,...storage.notifications].slice(0,100);
 if(storage.permissions.notifications&&'Notification' in window&&Notification.permission==='granted')new Notification(title,{body});return entry;
}
