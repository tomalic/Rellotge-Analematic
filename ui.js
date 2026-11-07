/* UI V9.6: navegació i visualització de lectura; no recalcula les efemèrides. */
(function(){
  'use strict';
  const tabs=['disseny','analema','construccio','meridiana','ajuda'];
  const $=id=>document.getElementById(id);
  const safe=v=>Number.isFinite(v)?v.toFixed(4):'—';
  function activate(name,updateHash){
    if(!tabs.includes(name)) name='disseny';
    tabs.forEach(t=>{
      const selected=t===name, button=$('tab-'+t), view=$('view-'+t);
      button.classList.toggle('active',selected);button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;
      view.hidden=!selected;view.classList.toggle('active',selected);
    });
    if(updateHash) history.replaceState(null,'','#'+name);
    if(name==='analema') drawAnalemma();
    window.scrollTo({top:0,behavior:'instant'});
  }
  document.querySelectorAll('[data-tab]').forEach(el=>el.addEventListener('click',()=>activate(el.dataset.tab,true)));
  document.querySelectorAll('[data-goto]').forEach(el=>el.addEventListener('click',()=>activate(el.dataset.goto,true)));
  window.addEventListener('hashchange',()=>activate(location.hash.slice(1),false));
  function drawAnalemma(){
    if(typeof gnomonCoords==='undefined'||!gnomonCoords.length) return;
    const points=gnomonCoords.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
    if(!points.length) return;
    const date=$('date').value||points[0].date;
    const selected=points.find(p=>p.date===date)||points[0];
    if($('analemmaDate').value!==date) $('analemmaDate').value=date;
    $('analemmaCurrent').textContent=`X ${safe(selected.x)} m · Y ${safe(selected.y)} m`;
    $('analemmaAccuracy').textContent=Number.isFinite(selected.rms)?`${selected.rms.toFixed(2)} min RMS`:'Sense dades suficients';
    const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
    let minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    const span=Math.max(maxX-minX,maxY-minY,0.01);
    const w=700,h=490,pad=76,plotW=w-2*pad,plotH=h-2*pad;
    const plotScale=Math.min(plotW/(maxX-minX+span*.18),plotH/(maxY-minY+span*.18));
    const centerX=(minX+maxX)/2,centerY=(minY+maxY)/2;
    const X=x=>w/2+(x-centerX)*plotScale,Y=y=>h/2-(y-centerY)*plotScale;
    const chain=points.map((p,i)=>`${i?'L':'M'}${X(p.x).toFixed(2)} ${Y(p.y).toFixed(2)}`).join(' ');
    let s=`<rect x="0" y="0" width="700" height="490" rx="12" fill="#fcfdfd"/>`;
    if(minX<=0&&maxX>=0) s+=`<path d="M${X(0)} 37 V453" stroke="#d9e4e2" stroke-width="1" stroke-dasharray="5 6"/>`;
    if(minY<=0&&maxY>=0) s+=`<path d="M40 ${Y(0)} H660" stroke="#d9e4e2" stroke-width="1" stroke-dasharray="5 6"/>`;
    s+=`<path d="${chain}" fill="none" stroke="#c3528b" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`;
    s+=points.filter((_,i)=>i%7===0).map(p=>`<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="2" fill="#c3528b" opacity=".65"/>`).join('');
    s+=`<circle cx="${X(selected.x)}" cy="${Y(selected.y)}" r="11" fill="#b94488" fill-opacity=".15"/><circle cx="${X(selected.x)}" cy="${Y(selected.y)}" r="5" fill="#b94488" stroke="white" stroke-width="2"/>`;
    s+=`<text x="350" y="29" font-family="system-ui,sans-serif" font-size="14" text-anchor="middle" fill="#546b75">Traçat anual · ${date.slice(0,4)}</text><text x="652" y="472" font-family="system-ui,sans-serif" font-size="12" text-anchor="end" fill="#80949a">Est →</text><text x="30" y="57" font-family="system-ui,sans-serif" font-size="12" text-anchor="middle" fill="#80949a">N ↑</text>`;
    $('analemmaDrawing').innerHTML=s;
  }
  $('analemmaDate').addEventListener('input',()=>{$('date').value=$('analemmaDate').value;$('date').dispatchEvent(new Event('input',{bubbles:true}));drawAnalemma()});
  ['name','lat','lon','a','step','from','to','date','time'].forEach(id=>$(id).addEventListener('input',drawAnalemma));
  document.querySelector('.nav-inner').addEventListener('keydown',e=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
    const current=tabs.findIndex(t=>$('tab-'+t).classList.contains('active'));
    const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(current+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
    e.preventDefault();activate(tabs[next],true);$('tab-'+tabs[next]).focus();
  });
  activate(location.hash.slice(1),false);drawAnalemma();
})();
