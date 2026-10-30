export class Waveform {
  constructor(canvas){
    this.canvas=canvas;
    this.ctx=canvas?.getContext('2d')||null;
    this.phase=0;this.level=.04;this.target=.04;this.state='idle';
    this.analyser=null;this.data=null;
    this.motionPreference=window.matchMedia?.('(prefers-reduced-motion: reduce)')||null;
    this.reducedMotion=!!this.motionPreference?.matches;
    this.resize();
    window.addEventListener('resize',()=>this.resize());
    this.frame=this.frame.bind(this);
    this.running=!document.hidden&&!this.reducedMotion;
    this.raf=this.running?requestAnimationFrame(this.frame):0;
    this.motionPreference?.addEventListener?.('change',event=>{
      this.reducedMotion=event.matches;
      if(this.reducedMotion){this.running=false;cancelAnimationFrame(this.raf);this.drawStatic();}
      else if(!document.hidden&&!this.running){this.running=true;this.raf=requestAnimationFrame(this.frame);}
    });
    document.addEventListener('visibilitychange',()=>{
      if(document.hidden){this.running=false;cancelAnimationFrame(this.raf);}
      else if(!this.running&&!this.reducedMotion){this.running=true;this.raf=requestAnimationFrame(this.frame);}
      else if(this.reducedMotion)this.drawStatic();
    });
    if(this.reducedMotion)this.drawStatic();
  }
  resize(){
    if(!this.canvas)return;
    const rect=this.canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);
    this.canvas.width=Math.max(1,Math.floor(rect.width*d));this.canvas.height=Math.max(1,Math.floor(rect.height*d));
    if(this.ctx)this.ctx.setTransform(d,0,0,d,0,0);
    this.w=rect.width;this.h=rect.height;
    if(this.reducedMotion)this.drawStatic();
  }
  attachAnalyser(analyser){this.analyser=analyser;this.data=analyser?new Uint8Array(analyser.frequencyBinCount):null}
  setState(state){this.state=state;if(this.reducedMotion)this.drawStatic();}
  setLevel(value){this.target=Math.min(1,Math.max(0,value));if(this.reducedMotion)this.drawStatic();}
  drawStatic(){
    const {ctx,w,h}=this;if(!ctx||!w||!h)return;
    ctx.clearRect(0,0,w,h);ctx.save();ctx.translate(w/2,h/2);
    const radius=Math.min(w,h)*.225;
    ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);
    ctx.lineWidth=16;ctx.strokeStyle='#F5F5F5';ctx.lineCap='round';
    ctx.shadowBlur=14;ctx.shadowColor='rgba(255,255,255,.18)';ctx.stroke();ctx.restore();
  }
  frame(){
    if(!this.running||this.reducedMotion)return;
    const {ctx,w,h}=this;if(!ctx||!w||!h){this.raf=requestAnimationFrame(this.frame);return;}
    ctx.clearRect(0,0,w,h);
    if(this.analyser&&this.data){this.analyser.getByteFrequencyData(this.data);let sum=0;for(let i=0;i<this.data.length;i++)sum+=this.data[i];this.target=Math.max(.03,Math.min(1,sum/(this.data.length*255)*2.1));}
    this.level+=(this.target-this.level)*.14;this.phase+=.012+this.level*.025;
    const cx=w/2,cy=h/2,base=Math.min(w,h)*.225;ctx.save();ctx.translate(cx,cy);
    ctx.beginPath();const points=180;
    for(let i=0;i<=points;i++){
      const angle=i/points*Math.PI*2;
      const frequency=1.8*Math.sin(angle*3+this.phase*3)+1.2*Math.sin(angle*7-this.phase*2)+.7*Math.sin(angle*13+this.phase*4);
      const stateBoost=this.state==='listening'?1.6:this.state==='speaking'?1.35:this.state==='thinking'?.9:.65;
      const radius=base*(1+frequency*.02*this.level*stateBoost+Math.sin(angle*5+this.phase*2)*.018*this.level);
      const x=Math.cos(angle)*radius,y=Math.sin(angle)*radius;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }
    ctx.closePath();ctx.lineWidth=16+this.level*18;ctx.strokeStyle='#F5F5F5';ctx.lineCap='round';ctx.shadowBlur=18+this.level*35;ctx.shadowColor='rgba(255,255,255,.22)';ctx.stroke();
    ctx.globalAlpha=.15;ctx.lineWidth=2;ctx.shadowBlur=0;ctx.strokeStyle='#fff';ctx.stroke();ctx.restore();
    this.raf=requestAnimationFrame(this.frame);
  }
}
