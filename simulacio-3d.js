/* ArsA v9.9 · Vista tridimensional de programari (Canvas 2D amb projecció perspectiva).
   Sense dependències, usable sense xarxa. Geometria i efemèrides del motor existent.
   Coordenades: X est, Y nord, Z altura sobre el terreny. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id), canvas=$('scene3d');
 if(!canvas || !canvas.getContext)return;
 const ctx=canvas.getContext('2d',{alpha:false});
 const state={az:210,elev:38,zoom:1,active:false,drag:null,pinch:null,pending:false};
 const PI=Math.PI,DEG=PI/180;
 const c3d={ink:'#234457',teal:'#087d80',pink:'#ba427a',amber:'#d5a547'};
 let size={w:900,h:500,ratio:1};
 let sliderDateTimer=null;
 function clamp(x,a,b){return Math.min(b,Math.max(a,x));}
 function v(x=0,y=0,z=0){return {x,y,z};}
 function sub(a,b){return v(a.x-b.x,a.y-b.y,a.z-b.z);}
 function dot(a,b){return a.x*b.x+a.y*b.y+a.z*b.z;}
 function cross(a,b){return v(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x);}
 function unit(a){const d=Math.hypot(a.x,a.y,a.z)||1;return v(a.x/d,a.y/d,a.z/d);}
 const offsetDate=(date,n)=>{let d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
 function yearDays(y){return (Date.UTC(y+1,0,1)-Date.UTC(y,0,1))/86400000;}
 function dateIndex(date){const year=Number(date.slice(0,4));return Math.round((Date.parse(date+'T12:00:00Z')-Date.UTC(year,0,1,12))/86400000)}
 function syncSliders(){
  const date=$('date').value, time=$('time').value;
  if(/^\d{4}-\d{2}-\d{2}$/.test(date)){
   let y=Number(date.slice(0,4));$('sceneDay').max=yearDays(y)-1;
   $('sceneDay').value=clamp(dateIndex(date),0,Number($('sceneDay').max));
   $('sceneDateLabel').textContent=new Intl.DateTimeFormat('ca-ES',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
  }
  if(/^\d{2}:\d{2}/.test(time)){
   const [h,m]=time.split(':').map(Number),mins=h*60+m;
   $('sceneHour').value=clamp(mins,0,1439);
   $('sceneHourLabel').textContent=`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  }
 }
 function fromDaySlider(){
  const y=Number($('date').value.slice(0,4)) || new Date().getFullYear();
  const newDate=offsetDate(`${y}-01-01`,Number($('sceneDay').value));
  $('date').value=newDate;
  syncSliders();paintSoon();
  // Actualització completa de la taula anual només en deixar quiet el lliscador.
  clearTimeout(sliderDateTimer);
  sliderDateTimer=setTimeout(()=>{$('date').dispatchEvent(new Event('input',{bubbles:true}));},220);
 }
 function fromHourSlider(){
  const n=Number($('sceneHour').value), h=Math.floor(n/60),m=n%60;
  $('time').value=`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`;
  syncSliders();
  $('time').dispatchEvent(new Event('input',{bubbles:true}));
  paintSoon();
 }
 function pointFor(date,lat,a){
  if(typeof gnomonCoords!=='undefined'){
   const p=gnomonCoords.find(p=>p.date===date);
   if(p && Number.isFinite(p.x) && Number.isFinite(p.y))return v(p.x,p.y,0);
  }
  // Mentre es recalculen dades d'un any nou, punt clàssic provisional.
  if(typeof solarData==='function'){
   const s=solarData(date),y=a*Math.cos(lat*DEG)*Math.tan(s.dec*DEG);
   return v(0,Number.isFinite(y)?y:0,0);
  }
  return v();
 }
 function resize(){
  const rect=canvas.getBoundingClientRect();if(rect.width<10||rect.height<10)return;
  const ratio=Math.min(window.devicePixelRatio||1,2);
  size={w:rect.width,h:rect.height,ratio};
  canvas.width=Math.round(rect.width*ratio);canvas.height=Math.round(rect.height*ratio);
  paintSoon();
 }
 function paintSoon(){
  if(!state.active||state.pending)return;
  state.pending=true;requestAnimationFrame(()=>{state.pending=false;draw()});
 }
 function addPath(points,close=true){
  const valid=points.filter(Boolean);if(valid.length<2)return false;
  ctx.beginPath();ctx.moveTo(valid[0].x,valid[0].y);
  for(let i=1;i<valid.length;i++)ctx.lineTo(valid[i].x,valid[i].y);
  if(close)ctx.closePath();return true;
 }
 function label(text,p,{color='#56717e',size:font=12,background=false,align='center'}={}){
  if(!p)return;ctx.save();ctx.font=`700 ${font}px system-ui,-apple-system,sans-serif`;
  ctx.textAlign=align;ctx.textBaseline='middle';
  if(background){const wid=ctx.measureText(text).width;ctx.fillStyle='rgba(255,255,255,.87)';ctx.beginPath();ctx.roundRect(p.x-wid/2-6,p.y-font*.7-2,wid+12,font+5,5);ctx.fill()}
  ctx.fillStyle=color;ctx.fillText(text,p.x,p.y);ctx.restore();
 }
 function draw(){
  if(!state.active)return;
  const {w,h,ratio}=size;if(w<50||h<50)return;
  ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,w,h);
  const lat=Number($('lat').value),lon=Number($('lon').value),a=Number($('a').value);
  const model=$('gnomonType').value,person=model==='persona';const height=Number($('gnomonHeight').value);
  const date=$('date').value;
  const calc=typeof calculateSolarClock==='function'?calculateSolarClock():null;
  const valid=calc&&a>0&&height>0&&height<=20&&Math.abs(lat)<90&&Number.isFinite(lon);
  const sunlight=valid?solarAzimuth(calc.instant,lat,lon):null;
  let grad=ctx.createLinearGradient(0,0,0,h);
  grad.addColorStop(0,'#e5f1f5');grad.addColorStop(.60,'#f8faf9');grad.addColorStop(1,'#dce8e5');ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
  if(!valid){label('Revisa la ubicació, la data, el fus i les dimensions.',{x:w/2,y:h/2},{size:15});updateStats(null);return}
  const b=a*Math.abs(Math.sin(lat*DEG)),foot=pointFor(date,lat,a);
  const az=state.az*DEG,el=state.elev*DEG,modelRadius=Math.max(a,b,0.5);
  const dist=modelRadius*(3.7/state.zoom)+height*.7;
  const center=v(0,0,Math.min(height*.15,modelRadius*.2));
  const cam=v(center.x+dist*Math.sin(az)*Math.cos(el),center.y+dist*Math.cos(az)*Math.cos(el),center.z+dist*Math.sin(el));
  const forward=unit(sub(center,cam)),right=unit(cross(forward,v(0,0,1))),up=unit(cross(right,forward));
  const fl=Math.min(w*.94,h*1.55),zoomFactor=fl;
  function project(p){
   const d=sub(p,cam),z=dot(d,forward);
   if(z<=.02)return null;
   return {x:w/2+dot(d,right)/z*zoomFactor,y:h*.53-dot(d,up)/z*zoomFactor,z,scale:zoomFactor/z};
  }
  function poly(points,fill,stroke,width=1){
   if(!addPath(points.map(project)))return;
   if(fill){ctx.fillStyle=fill;ctx.fill()}
   if(stroke){ctx.lineWidth=width;ctx.strokeStyle=stroke;ctx.stroke()}
  }
  function line(points,color,width=1,dash=[]){
   const pp=points.map(project);if(!addPath(pp,false))return;
   ctx.save();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineJoin='round';ctx.lineCap='round';ctx.setLineDash(dash);ctx.stroke();ctx.restore();
  }
  // Terreny amb una quadrícula suau, per mostrar volum i escala.
  const extent=a*2.25;
  poly([v(-extent,-extent),v(extent,-extent),v(extent,extent),v(-extent,extent)],'#ecf2ef','#cddedb',1.2);
  ctx.save();
  for(let d=-2;d<=2;d++){
   let x=d*a*.65;
   line([v(x,-extent),v(x,extent)],'rgba(111,148,157,.13)',1);
   line([v(-extent,x),v(extent,x)],'rgba(111,148,157,.13)',1);
  }
  ctx.restore();
  // Eixos N/S i E/W: no són línies horàries.
  line([v(0,-a*1.32,.003),v(0,a*1.32,.003)],'rgba(24,122,115,.35)',1.25,[5,7]);
  line([v(-a*1.32,0,.003),v(a*1.32,0,.003)],'rgba(24,122,115,.18)',1.25,[5,7]);
  [['N',0,a*1.39],['S',0,-a*1.39],['E',a*1.43,0],['O',-a*1.43,0]].forEach(([t,x,y])=>label(t,project(v(x,y,.04)),{color:'#5c7c7c',size:13,background:true}));
  // Anella el·líptica amb ombra per donar profunditat.
  const ellipse=[];for(let i=0;i<=144;i++){const th=i*2*PI/144;ellipse.push(v(a*Math.sin(th),b*Math.cos(th),.02))}
  line(ellipse.map(p=>v(p.x,p.y,-.013)),'rgba(33,61,71,.17)',11);
  line(ellipse,'#d4a448',8);
  line(ellipse,'#fffdf4',4);
  // Ombra física projectada damunt un terra pla i horitzontal.
  let actualLen=null,clipped=false;
  if(sunlight.alt>0.05){
   actualLen=height/Math.tan(sunlight.alt*DEG);
   const displayLen=Math.min(actualLen,extent*1.30);clipped=actualLen>displayLen;
   const unitShadowX=-Math.sin(sunlight.az*DEG),unitShadowY=-Math.cos(sunlight.az*DEG);
   const end=v(foot.x+displayLen*unitShadowX,foot.y+displayLen*unitShadowY,.028);
   if(person){
    const perpx=-unitShadowY,perpy=unitShadowX;
    const x=foot.x,y=foot.y;
    const point=(f,side)=>v(x+unitShadowX*displayLen*f+perpx*height*side,y+unitShadowY*displayLen*f+perpy*height*side,.025);
    // Contorn esquemàtic d'una ombra humana: cames, cos i cap.
    poly([point(0,-.09),point(.23,-.07),point(.47,-.19),point(.75,-.14),point(.90,-.10),point(1,-.06),point(1,.06),point(.90,.10),point(.75,.14),point(.47,.19),point(.23,.07),point(0,.09)],'rgba(25,49,67,.26)');
    const headPt=project(end);if(headPt){ctx.save();ctx.beginPath();ctx.ellipse(headPt.x,headPt.y,Math.max(3,headPt.scale*height*.082),Math.max(2,headPt.scale*height*.055),0,0,2*PI);ctx.fillStyle='rgba(25,49,67,.25)';ctx.fill();ctx.restore()}
   }else{
    poly([v(foot.x,foot.y,.024),v(end.x,end.y,.024),v(end.x+.018,end.y+.018,.024),v(foot.x+.025,foot.y+.025,.024)],'rgba(23,48,67,.32)');
   }
   line([foot,end],'rgba(24,51,70,.22)',person?2.5:1.3);
  }
  // Marques horàries exactes de l'app, sense duplicar les seves fórmules.
  if(typeof coords!=='undefined'){
   coords.forEach((mark,i)=>{
    const norm=Math.hypot(mark.x/(a*a),mark.y/(b*b))||1;
    const dx=mark.x/(a*a)/norm,dy=mark.y/(b*b)/norm;
    line([v(mark.x-dx*.055*a,mark.y-dy*.055*a,.045),v(mark.x+dx*.055*a,mark.y+dy*.055*a,.045)],'#315b68',w<600?2.8:4.3);
    if($('sceneShowHours').checked && (w>620||i%2===0)){
     const pt=project(v(mark.x+dx*a*.135,mark.y+dy*a*.135,.045));
     if(pt && pt.x>25&&pt.x<w-25&&pt.y>15&&pt.y<h-18)label(timeLabel(mark.h),pt,{color:'#355965',size:w<620?9:11});
    }
   });
  }
  // Analema/projecte de punts diaris, sempre en planta del rellotge real.
  if($('sceneShowAnalemma').checked && typeof gnomonCoords!=='undefined'){
   ctx.save();ctx.fillStyle='rgba(182,53,125,.56)';
   for(let i=0;i<gnomonCoords.length;i+=3){
    const p=gnomonCoords[i];if(!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;
    const q=project(v(p.x,p.y,.06));if(!q)continue;ctx.beginPath();ctx.arc(q.x,q.y,clamp(q.scale*.0065,1,2.3),0,2*PI);ctx.fill();
   }
   ctx.restore();
  }
  // Gnòmon / persona de l'alçada triada (valor real a escala en metres).
  const body='#254559',body2='#436779';
  function stroke3d(p,q,width,color){
   const P=project(p),Q=project(q);if(!P||!Q)return;
   ctx.save();ctx.lineCap='round';ctx.strokeStyle=color;
   ctx.lineWidth=clamp(width*(P.scale+Q.scale)/2,3,80);
   ctx.beginPath();ctx.moveTo(P.x,P.y);ctx.lineTo(Q.x,Q.y);ctx.stroke();ctx.restore();
  }
  const base=foot;
  if(!person){
   const top=v(base.x,base.y,height);
   stroke3d(base,top,.038,body2);
   stroke3d(v(base.x-.013,base.y,0),v(base.x-.013,base.y,height),.012,'#b7d1da');
   const tip=project(top);if(tip){ctx.fillStyle='#203b4c';ctx.beginPath();ctx.arc(tip.x,tip.y,Math.max(2,tip.scale*.019),0,2*PI);ctx.fill()}
  }else{
   // Figura humana estilitzada: cap, tronc, braços i cames.
   const z=height;
   stroke3d(v(base.x-.105*z,base.y,0),v(base.x-.065*z,base.y,.43*z),.105*z,body);
   stroke3d(v(base.x+.105*z,base.y,0),v(base.x+.065*z,base.y,.43*z),.105*z,body);
   stroke3d(v(base.x,base.y,.40*z),v(base.x,base.y,.76*z),.24*z,body);
   stroke3d(v(base.x-.11*z,base.y,.7*z),v(base.x-.20*z,base.y,.39*z),.085*z,body2);
   stroke3d(v(base.x+.11*z,base.y,.7*z),v(base.x+.20*z,base.y,.39*z),.085*z,body2);
   stroke3d(v(base.x,base.y,.76*z),v(base.x,base.y,.84*z),.078*z,body);
   const hd=project(v(base.x,base.y,.91*z));
   if(hd){const r=clamp(hd.scale*.09*z,4,46);ctx.save();ctx.fillStyle=body;ctx.beginPath();ctx.ellipse(hd.x,hd.y,r*.86,r,0,0,2*PI);ctx.fill();ctx.fillStyle='rgba(255,255,255,.13)';ctx.beginPath();ctx.ellipse(hd.x-r*.2,hd.y-r*.15,r*.22,r*.52,-.15,0,2*PI);ctx.fill();ctx.restore()}
  }
  const basePt=project(v(base.x,base.y,.05));if(basePt){ctx.fillStyle='#ae447b';ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(basePt.x,basePt.y,5,0,PI*2);ctx.fill();ctx.stroke()}
  // Punt de situació de l'ombra i informació de simulació.
  if(sunlight.alt<=0.05){
   ctx.fillStyle='rgba(10,43,62,.82)';ctx.beginPath();ctx.roundRect(12,12,Math.min(w-24,320),34,8);ctx.fill();label('Sol sota l’horitzó · sense ombra solar',{x:Math.min(w-24,320)/2+12,y:29},{color:'#fff',size:w<440?11:12});
  }
  $('scene3dState').textContent=sunlight.alt>0.05?'Ombra calculada':'Sol sota l’horitzó';
  updateStats({model,person,height,a,b,foot,sunlight,shadowLength:actualLen,clipped,calc});
 }
 function updateStats(data){
  const values=data?{
   'sceneAltitude':data.sunlight.alt.toFixed(1)+'°',
   'sceneAzimuth':data.sunlight.az.toFixed(1)+'°',
   'sceneShadow':data.shadowLength===null?'Sense ombra':data.shadowLength<1000?data.shadowLength.toFixed(2)+' m':(data.shadowLength/1000).toFixed(2)+' km',
   'scene3dSize':(2*data.a).toFixed(2)+' × '+(2*data.b).toFixed(2)+' m',
   'scene3dHeight':data.height.toFixed(2)+' m',
   'sceneGnomonPoint':`E ${data.foot.x.toFixed(2)} · N ${data.foot.y.toFixed(2)} m`
  }:Object.fromEntries(['sceneAltitude','sceneAzimuth','sceneShadow','scene3dSize','scene3dHeight','sceneGnomonPoint'].map(k=>[k,'—']));
  Object.entries(values).forEach(([key,value])=>$(key).textContent=value);
  $('scene3dNote').textContent=!data?'Revisa les dades de Disseny.':data.sunlight.alt<=.05?'El Sol és sota l’horitzó: no es projecta cap ombra solar.':data.clipped?'L’ombra sobrepassa l’àrea dibuixada; la longitud indicada és la completa.': 'Simulació geomètrica sobre terreny horitzontal; no inclou obstacles ni relleu.';
 }
 $('sceneDay').addEventListener('input',fromDaySlider);
 $('sceneDay').addEventListener('change',()=>{clearTimeout(sliderDateTimer);$('date').dispatchEvent(new Event('input',{bubbles:true}));paintSoon()});
 $('sceneHour').addEventListener('input',fromHourSlider);
 $('sceneNow').addEventListener('click',()=>{$('useDeviceTime').click();syncSliders();paintSoon()});
 $('sceneResetCamera').addEventListener('click',()=>{state.az=210;state.elev=38;state.zoom=1;paintSoon()});
 $('sceneTop').addEventListener('click',()=>{state.az=180;state.elev=89;state.zoom=1;paintSoon()});
 ['sceneShowHours','sceneShowAnalemma'].forEach(id=>$(id).addEventListener('change',paintSoon));
 ['lat','lon','a','date','time','tzMode','tzManual','gnomonType','gnomonHeight','step','from','to'].forEach(id=>$(id).addEventListener('input',()=>{syncSliders();paintSoon()}));
 // Un canvi de model suggereix l'altura habitual, però l'usuari la pot modificar.
 $('gnomonType').addEventListener('change',()=>{
  $('gnomonHeight').value=$('gnomonType').value==='persona'?'1.70':'1.20';
  $('gnomonHeight').dispatchEvent(new Event('input',{bubbles:true}));paintSoon();
 });
 window.addEventListener('arsa-clock-tick',()=>{if(state.active){syncSliders();paintSoon()}});
 function ptrPoint(e){const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top}}
 const pointers=new Map();let lastDistance=0;
 canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,ptrPoint(e));if(pointers.size===1)state.drag=ptrPoint(e);else if(pointers.size===2){const list=[...pointers.values()];lastDistance=Math.hypot(list[0].x-list[1].x,list[0].y-list[1].y)} });
 canvas.addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId))return;const pos=ptrPoint(e);pointers.set(e.pointerId,pos);
  if(pointers.size===2){const list=[...pointers.values()],distance=Math.hypot(list[0].x-list[1].x,list[0].y-list[1].y);if(lastDistance>0)state.zoom=clamp(state.zoom*(distance/lastDistance),.53,3.1);lastDistance=distance;paintSoon();return}
  if(!state.drag)return;const dx=pos.x-state.drag.x,dy=pos.y-state.drag.y;state.drag=pos;
  state.az=(state.az-dx*.42+360)%360;state.elev=clamp(state.elev+dy*.30,8,89);paintSoon();
 });
 function endPtr(e){pointers.delete(e.pointerId);state.drag=pointers.size===1?[...pointers.values()][0]:null;lastDistance=0}
 canvas.addEventListener('pointerup',endPtr);canvas.addEventListener('pointercancel',endPtr);
 canvas.addEventListener('wheel',e=>{if(!state.active)return;e.preventDefault();state.zoom=clamp(state.zoom*Math.exp(-e.deltaY*.0013),.53,3.1);paintSoon()},{passive:false});
 // Els botons garantiran accessibilitat sense gestos de punter.
 $('sceneLeft').onclick=()=>{state.az=(state.az+345)%360;paintSoon()};
 $('sceneRight').onclick=()=>{state.az=(state.az+15)%360;paintSoon()};
 $('sceneZoomIn').onclick=()=>{state.zoom=clamp(state.zoom*1.18,.53,3.1);paintSoon()};
 $('sceneZoomOut').onclick=()=>{state.zoom=clamp(state.zoom/1.18,.53,3.1);paintSoon()};
 new ResizeObserver(()=>{if(state.active)resize()}).observe(canvas);
 function activate(){state.active=true;syncSliders();resize();paintSoon()}
 function deactivate(){state.active=false}
 window.Arsa3D={activate,deactivate,refresh:()=>{syncSliders();paintSoon()}};
 // La vista 3D també pot obrir-se directament amb l'URL #simulacio.
 if(location.hash==='#simulacio')activate();
})();
