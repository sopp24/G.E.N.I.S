export class Waveform {
  constructor(canvas){
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.phase=0;this.level=0.04;this.target=.04;this.state='idle';
    this.analyser=null;this.data=null;this.resize(); window.addEventListener('resize',()=>this.resize()); this.frame=this.frame.bind(this); requestAnimationFrame(this.frame);
  }
  resize(){const r=this.canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);this.canvas.width=Math.max(1,Math.floor(r.width*d));this.canvas.height=Math.max(1,Math.floor(r.height*d));this.ctx.setTransform(d,0,0,d,0,0);this.w=r.width;this.h=r.height;}
  attachAnalyser(analyser){this.analyser=analyser;this.data=new Uint8Array(analyser.frequencyBinCount)}
  setState(s){this.state=s}
  setLevel(v){this.target=Math.min(1,Math.max(0,v))}
  frame(){
    const {ctx,w,h}=this; if(!w||!h){requestAnimationFrame(this.frame);return;}
    ctx.clearRect(0,0,w,h);
    if(this.analyser&&this.data){this.analyser.getByteFrequencyData(this.data);let sum=0;for(let i=0;i<this.data.length;i++)sum+=this.data[i];this.target=Math.max(.03,Math.min(1,sum/(this.data.length*255)*2.1));}
    this.level+=(this.target-this.level)*.14;this.phase+=.012+this.level*.025;
    const cx=w/2,cy=h/2,base=Math.min(w,h)*.225; ctx.save();ctx.translate(cx,cy);
    ctx.beginPath(); const pts=180;
    for(let i=0;i<=pts;i++){
      const a=i/pts*Math.PI*2; const freq=1.8*Math.sin(a*3+this.phase*3)+1.2*Math.sin(a*7-this.phase*2)+.7*Math.sin(a*13+this.phase*4);
      const stateBoost=this.state==='listening'?1.6:this.state==='speaking'?1.35:this.state==='thinking'?.9:.65;
      const rad=base*(1+freq*.02*this.level*stateBoost + Math.sin(a*5+this.phase*2)*.018*this.level);
      const x=Math.cos(a)*rad,y=Math.sin(a)*rad; if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }
    ctx.closePath();ctx.lineWidth=16+this.level*18;ctx.strokeStyle='#F5F5F5';ctx.lineCap='round';ctx.shadowBlur=18+this.level*35;ctx.shadowColor='rgba(255,255,255,.22)';ctx.stroke();
    ctx.globalAlpha=.15;ctx.lineWidth=2;ctx.shadowBlur=0;ctx.strokeStyle='#fff';ctx.stroke();ctx.restore(); requestAnimationFrame(this.frame);
  }
}
