/* ArsA V9.7 — Capa de lectura solar i dades del dispositiu.
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
