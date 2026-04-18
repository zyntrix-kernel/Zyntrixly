const CACHE='zyntrixly-v3';
const SHELL=[
  './',
  './index.html',
  './app.js',
  './crypto.js',
  './security.js',
  './webrtc.js',
  './style.css',
  './manifest.webmanifest',
  './assets/app-icon-192.png',
  './assets/app-icon-512.png',
  './assets/app-icon-maskable-512.png',
  './assets/apple-touch-icon.png',
  './vendor/firebase/firebase-app-compat.js',
  './vendor/firebase/firebase-auth-compat.js',
  './vendor/firebase/firebase-firestore-compat.js',
  './vendor/fonts/google-fonts.css',
  './vendor/fonts/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZg.ttf',
  './vendor/fonts/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuGKYMZg.ttf',
  './vendor/fonts/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuI6fMZg.ttf',
  './vendor/fonts/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf',
  './vendor/fonts/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuOKfMZg.ttf',
  './vendor/fonts/XRXI3I6Li01BKofiOc5wtlZ2di8HDFwmRTM.ttf',
  './vendor/fonts/XRXI3I6Li01BKofiOc5wtlZ2di8HDGUmRTM.ttf',
  './vendor/fonts/XRXI3I6Li01BKofiOc5wtlZ2di8HDIkhRTM.ttf',
  './vendor/fonts/XRXI3I6Li01BKofiOc5wtlZ2di8HDLshRTM.ttf',
  './vendor/fonts/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8-qxjPQ.ttf',
  './vendor/fonts/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxjPQ.ttf'
];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(
      keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))
    )).then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);

  // Never intercept /api/* — always needs network
  if(url.pathname.startsWith('/api/')) return;

  // Navigation: serve cached shell, update in background
  if(req.mode==='navigate'){
    e.respondWith(
      caches.match('./index.html').then(cached=>{
        const fresh=fetch(req).then(res=>{
          caches.open(CACHE).then(c=>c.put('./index.html',res.clone()));
          return res;
        }).catch(()=>cached);
        return cached||fresh;
      })
    );
    return;
  }

  // Same-origin assets: cache-first
  if(url.origin===self.location.origin){
    e.respondWith(
      caches.match(req).then(cached=>{
        if(cached) return cached;
        return fetch(req).then(res=>{
          if(res&&res.status===200&&res.type==='basic'){
            caches.open(CACHE).then(c=>c.put(req,res.clone()));
          }
          return res;
        }).catch(()=>new Response('Offline',{status:503}));
      })
    );
  }
});
