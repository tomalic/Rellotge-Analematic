const CACHE='rellotge-analematic-v9-6-UI';
const ASSETS=['./','./index.html','./ui.css','./ui.js','./manifest.webmanifest','./orientacio-ombres.html','./orientacio-ombres.css','./orientacio-ombres.js','./orientacio-solar.js','./meridiana-m1.html','./meridiana-m1.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('rellotge-analematic-')&&k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;
 if(e.request.mode==='navigate'){
  e.respondWith(fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();e.waitUntil(caches.open(CACHE).then(c=>c.put(e.request,copy)))}return r}).catch(()=>caches.match(e.request).then(c=>c||caches.match('./index.html'))));return
 }
 e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request)))
});
