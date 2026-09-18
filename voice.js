export class VoiceEngine {
  constructor({onTranscript,onState}={}){
    this.onTranscript=onTranscript||(()=>{}); this.onState=onState||(()=>{});
    this.recognition=null; this.listening=false; this.speaking=false;
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(SR){
      this.recognition=new SR();
      this.recognition.lang='fr-FR'; this.recognition.interimResults=true; this.recognition.continuous=false;
      this.recognition.onstart=()=>{this.listening=true;this.onState('listening')};
      this.recognition.onend=()=>{this.listening=false;this.onState('idle')};
      this.recognition.onerror=(e)=>{this.listening=false;this.onState('error',e.error||'microphone')};
      this.recognition.onresult=(event)=>{
        let finalText=''; let interim='';
        for(let i=event.resultIndex;i<event.results.length;i++){
          const t=event.results[i][0].transcript;
          if(event.results[i].isFinal) finalText+=t; else interim+=t;
        }
        this.onTranscript({finalText:finalText.trim(),interimText:interim.trim()});
      };
    }
  }
  supported(){ return !!this.recognition; }
  setLanguage(lang){if(this.recognition)this.recognition.lang=lang;}
  start(){ if(!this.recognition)return false; try{this.recognition.start();return true}catch{return false;} }
  stop(){ try{this.recognition?.stop()}catch{} }
  speak(text,{rate=1,volume=1,voiceName='',onStart,onEnd}={}){
    if(!('speechSynthesis' in window))return false;
    window.speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(text); u.lang='fr-FR';u.rate=Math.max(.7,Math.min(1.3,rate));u.volume=Math.max(0,Math.min(1,volume));
    const voices=window.speechSynthesis.getVoices(); if(voiceName){const v=voices.find(x=>x.name===voiceName);if(v)u.voice=v;} else {const v=voices.find(x=>/^fr(-|_)/i.test(x.lang))||voices.find(x=>/français|french/i.test(x.name));if(v)u.voice=v;}
    u.onstart=()=>{this.speaking=true;this.onState('speaking');onStart?.()};
    u.onend=()=>{this.speaking=false;this.onState('idle');onEnd?.()};
    u.onerror=()=>{this.speaking=false;this.onState('idle');onEnd?.()};
    window.speechSynthesis.speak(u); return true;
  }
}
