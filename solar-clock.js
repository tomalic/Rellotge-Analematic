/* ArsA V9.8 — Capa de lectura solar i dades del dispositiu.
   No modifica el motor NOAA/Meeus ni les coordenades del rellotge. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 let live=false;
 let applyingGps=false;
 const status=$('locationStatus');
 function formatDeviceDate(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
 function formatDeviceTime(d){return [d.getHours(),d.getMinutes(),d.getSeconds()].map(n=>String(n).padStart(2,'0')).join(':')}
 function showTimezoneInput(){$('manualTimezoneField').hidden=$('tzMode').value!=='manual'}
 function updateSolarReadout(){
  const calc=calculateSolarClock();
  $('solarTime').textContent=calc?calc.text:'--:--:--';
  $('solarLongitudeCorrection').textContent=calc?formatSignedMinutes(calc.longitudeCorrection):'—';
  $('solarEquationCorrection').textContent=calc?formatSignedMinutes(calc.eot):'—';
  $('solarTotalCorrection').textContent=calc?formatSignedMinutes(calc.totalCorrection):'—';
  $('solarDayNote').textContent=calc&&calc.dayShift?`(${calc.dayShift>0?'+':''}${calc.dayShift} dia${Math.abs(calc.dayShift)!==1?'s':''})`:'';
  $('solarClockContext').textContent=calc?`Hora civil: ${$('date').value} · ${$('time').value} · ${calc.zoneLabel}`:'Revisa les coordenades, la data, l’hora i el fus horari.';
  $('solarClockMode').textContent=live?'● En directe':'Lectura de l’instant triat';
  const noon=calc?calculateSolarNoon():null;
  $('solarNoonTime').textContent=noon?noon.text:'--:--:--';
  $('solarNoonNote').textContent=noon?noon.note:'Revisa la data, la longitud i el fus horari.';
 }
 // Calcula el trànsit solar superior (hora solar aparent = 12:00) de la data civil.
 // Resol iterativament 720 = minuts UTC + 4·longitud + EOT(t) per al mateix
 // motor NOAA/Meeus de l'app; l'EOT varia durant el dia.
 function calculateSolarNoon(){
  const date=$('date').value;
  const lon=Number($('lon').value);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||$('lon').value===''||!Number.isFinite(lon)||Math.abs(lon)>180)return null;
  const [year,month,day]=date.split('-').map(Number);
  const utcMidnight=Date.UTC(year,month-1,day);
  if(!Number.isFinite(utcMidnight)||new Date(utcMidnight).toISOString().slice(0,10)!==date)return null;
  const manual=$('tzMode').value==='manual';
  let manualOffset=0;
  if(manual){
   if($('tzManual').value==='')return null;
   manualOffset=Number($('tzManual').value);
   if(!Number.isFinite(manualOffset)||manualOffset< -12||manualOffset>14)return null;
  }
  // Hora civil de les 12 de la data escollida; resol el fus de l'aparell
  // en la data seleccionada, no el de la data actual.
  const civilMidday=manual
   ?utcMidnight+12*3600000-manualOffset*3600000
   :new Date(`${date}T12:00:00`).getTime();
  if(!Number.isFinite(civilMidday))return null;
  const formatCivil=instant=>{
   const d=manual?new Date(instant+manualOffset*3600000):new Date(instant);
   const fmt=n=>String(n).padStart(2,'0');
   const dd=manual?[d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate()]:[d.getFullYear(),d.getMonth()+1,d.getDate()];
   const h=manual?d.getUTCHours():d.getHours(),m=manual?d.getUTCMinutes():d.getMinutes(),s=manual?d.getUTCSeconds():d.getSeconds();
   return {date:`${dd[0]}-${fmt(dd[1])}-${fmt(dd[2])}`,text:`${fmt(h)}:${fmt(m)}:${fmt(s)}`};
  };
  // Inclou els dies UTC propers per a fusos i longituds allunyats del
  // meridià de referència; evita donar el trànsit d'un dia diferent.
  const candidates=[];
  for(let delta=-2;delta<=2;delta++){
   const base=utcMidnight+delta*86400000;
   let noon=base+12*3600000-4*lon*60000;
   for(let i=0;i<7;i++){
    const eot=solarAzimuth(new Date(noon),0,lon).eot;
    const next=base+(720-4*lon-eot)*60000;
    if(Math.abs(next-noon)<0.1){noon=next;break;}
    noon=next;
   }
   const civil=formatCivil(Math.round(noon/1000)*1000);
   candidates.push({timestamp:noon,civil,...{distance:Math.abs(noon-civilMidday)}});
  }
  // Tria el trànsit dins la data civil escollida; si un fus incompatible
  // amb la longitud la deixa sense trànsit, no inventa una hora.
  const sameDay=candidates.filter(c=>c.civil.date===date);
  if(!sameDay.length)return {text:'—',note:'No hi ha un migdia solar en aquesta data civil amb el fus seleccionat. Revisa el fus horari.'};
  sameDay.sort((a,b)=>a.distance-b.distance);
  const best=sameDay[0],offsetAtNoon=manual?manualOffset:-new Date(best.timestamp).getTimezoneOffset()/60;
  const utcLabel=`UTC${offsetAtNoon<0?'−':'+'}${Math.abs(offsetAtNoon).toString().replace('.',',')}`;
  return {text:best.civil.text,note:`Hora oficial (${utcLabel}) · estimació NOAA/Meeus`,timestamp:best.timestamp};
 }
 function triggerDateRender(){
  $('date').dispatchEvent(new Event('input',{bubbles:true}));
 }
 function readDeviceClock({recompute=true}={}){
  const now=new Date(),date=formatDeviceDate(now);
  const dateChanged=$('date').value!==date;
  $('date').value=date;$('time').value=formatDeviceTime(now);
  // L'analema depèn de la data i només es recalcula quan canvia el dia.
  if(recompute&&dateChanged)triggerDateRender();
  updateSolarReadout();
  window.dispatchEvent(new Event('arsa-clock-tick'));
 }
 function toggleLive(on){
  live=Boolean(on);
  $('toggleLive').setAttribute('aria-pressed',String(live));
  $('toggleLive').textContent=live?'Aturar hora en directe':'Activar hora en directe';
  if(live){$('tzMode').value='device';showTimezoneInput();readDeviceClock();}
  else updateSolarReadout();
 }
 function stopLiveOnManual(){
  if(live)toggleLive(false);
  else updateSolarReadout();
 }
 $('useDeviceTime').addEventListener('click',()=>{
  if(live)toggleLive(false);
  $('tzMode').value='device';showTimezoneInput();
  readDeviceClock();
 });
 $('toggleLive').addEventListener('click',()=>toggleLive(!live));
 ['date','time'].forEach(id=>$(id).addEventListener('input',stopLiveOnManual));
 ['lat','lon','tzManual'].forEach(id=>$(id).addEventListener('input',updateSolarReadout));
 $('tzMode').addEventListener('change',()=>{showTimezoneInput();if(live&&$('tzMode').value==='manual')toggleLive(false);updateSolarReadout()});
 ['lat','lon'].forEach(id=>$(id).addEventListener('input',()=>{if(!applyingGps){status.dataset.source='manual';status.textContent='Coordenades editades manualment.'}}));
 $('useLocation').addEventListener('click',()=>{
  if(!navigator.geolocation){status.textContent='Aquest navegador no ofereix geolocalització. Escriu la latitud i la longitud manualment.';return}
  if(!window.isSecureContext){status.textContent='La ubicació GPS necessita HTTPS. Obre la PWA des del teu domini segur.';return}
  $('useLocation').disabled=true;status.textContent='Sol·licitant permís de localització…';
  navigator.geolocation.getCurrentPosition(position=>{
   $('useLocation').disabled=false;
   $('lat').value=position.coords.latitude.toFixed(6);
   $('lon').value=position.coords.longitude.toFixed(6);
   applyingGps=true;
   $('lat').dispatchEvent(new Event('input',{bubbles:true}));
   applyingGps=false;status.dataset.source='gps';
   status.textContent=`Ubicació del dispositiu carregada · precisió indicada ±${Math.round(position.coords.accuracy)} m. Pots editar les coordenades.`;
   updateSolarReadout();
  },error=>{
   $('useLocation').disabled=false;
   const messages={1:'Permís de ubicació denegat.',2:'No s’ha pogut determinar la ubicació.',3:'Temps d’espera esgotat.'};
   status.textContent=(messages[error.code]||'Error de localització.')+' Pots escriure les coordenades manualment.';
  },{enableHighAccuracy:true,timeout:12000,maximumAge:60000});
 });
 showTimezoneInput();
 // En projectes nous, l'hora inicial és la del dispositiu; mai no sobreescrivim dades desades.
 if(!hasSavedProject){
  readDeviceClock({recompute:false});
  triggerDateRender();
  toggleLive(true);
 }else{updateSolarReadout()}
 // Només refrescam la lectura horària per segon, no l'analema de tot l'any.
 setInterval(()=>{if(live)readDeviceClock();},1000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&live)readDeviceClock()});
})();
