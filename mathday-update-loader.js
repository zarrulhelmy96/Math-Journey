/* Runs at the start of <body>, before the question bank and application module. */
(() => {
  'use strict';
  const script=document.currentScript?.src||new URL('./mathday-update-loader.js',location.href).href;
  const key='mathDayUpdateLoading:'+new URL('./',script).pathname;
  let timer=null,active=false,booting=false;
  const dialog=document.createElement('dialog');dialog.id='mathdayUpdateLoader';
  dialog.setAttribute('aria-labelledby','mathdayUpdateTitle');dialog.setAttribute('aria-describedby','mathdayUpdateMessage');
  dialog.innerHTML='<div class="md-update-card"><div class="md-update-brand" aria-label="MathDay">Math<span>Day</span></div><div class="md-update-spinner" aria-hidden="true"></div><p class="md-update-eyebrow">VERSI BAHARU UNTUK ANDA</p><h1 id="mathdayUpdateTitle">Mengemas kini MathDay</h1><p id="mathdayUpdateMessage" role="status" aria-live="polite">Sila tunggu sebentar. Kami sedang menyediakan versi baharu.</p><div class="md-update-progress" role="progressbar" aria-label="Kemas kini sedang dimuatkan"><span></span></div><p class="md-update-note">Pastikan sambungan internet kekal aktif.</p><div class="md-update-actions" hidden><button type="button" id="mathdayUpdateRetry">Cuba semula</button><button type="button" id="mathdayUpdateClose">Tutup</button></div></div>';
  const style=document.createElement('style');style.textContent=`
    #mathdayUpdateLoader{position:fixed;inset:0;box-sizing:border-box;width:100%;height:100%;height:100dvh;max-width:none;max-height:none;margin:0;padding:max(24px,env(safe-area-inset-top)) 24px max(24px,env(safe-area-inset-bottom));border:0;border-radius:0;background:radial-gradient(ellipse at top left,#ece3ff,transparent 65%),radial-gradient(ellipse at bottom right,#fff4c0,transparent 65%),#fffdf9;color:#30263f;font-family:system-ui,-apple-system,Segoe UI,sans-serif;text-align:center;overflow:auto}
    #mathdayUpdateLoader[open]{display:grid;place-items:center}#mathdayUpdateLoader::backdrop{background:#fffdf9}
    #mathdayUpdateLoader .md-update-card{width:100%;max-width:390px;padding:24px 0}
    #mathdayUpdateLoader .md-update-brand{font-size:40px;line-height:1.2;font-weight:900;letter-spacing:-2px;color:#845cff;margin-bottom:42px}#mathdayUpdateLoader .md-update-brand span{color:#d6a300}
    #mathdayUpdateLoader .md-update-spinner{width:64px;height:64px;box-sizing:border-box;margin:0 auto 30px;border:5px solid #e8ddff;border-top-color:#845cff;border-right-color:#e6bf3f;border-radius:50%;animation:md-update-spin 1s linear infinite}
    #mathdayUpdateLoader .md-update-eyebrow{font-size:10px;letter-spacing:1.7px;font-weight:800;color:#8267ad;margin:0 0 12px}
    #mathdayUpdateLoader h1{font-size:26px;line-height:1.25;margin:0 0 16px;letter-spacing:-.6px}
    #mathdayUpdateMessage{font-size:15px;line-height:1.65;color:#70647e;margin:0 auto 26px;max-width:330px}
    #mathdayUpdateLoader .md-update-progress{height:6px;overflow:hidden;border-radius:99px;background:#e9e0f7;max-width:220px;margin:auto}#mathdayUpdateLoader .md-update-progress span{display:block;width:40%;height:100%;border-radius:inherit;background:linear-gradient(90deg,#845cff,#e3bc3b);animation:md-update-slide 1.4s ease-in-out infinite alternate}
    #mathdayUpdateLoader .md-update-note{font-size:12px;color:#8b7e98;margin:20px 0 0}
    #mathdayUpdateLoader .md-update-actions{display:flex;justify-content:center;flex-wrap:wrap;gap:12px;margin-top:24px}#mathdayUpdateLoader [hidden]{display:none!important}
    #mathdayUpdateLoader button{font:inherit;font-size:14px;font-weight:800;padding:12px 18px;min-height:44px;border:0;border-radius:12px;background:#845cff;color:white;cursor:pointer}#mathdayUpdateLoader #mathdayUpdateClose{background:#ece5f7;color:#624781}#mathdayUpdateLoader button:focus-visible{outline:3px solid #39234e;outline-offset:4px}
    #mathdayUpdateLoader[data-failed="true"] .md-update-spinner{animation:none;border-color:#e4bd59}#mathdayUpdateLoader[data-failed="true"] .md-update-progress{display:none}
    @keyframes md-update-spin{to{transform:rotate(360deg)}}@keyframes md-update-slide{from{transform:translateX(-70%)}to{transform:translateX(220%)}}
    @media(prefers-reduced-motion:reduce){#mathdayUpdateLoader .md-update-spinner,#mathdayUpdateLoader .md-update-progress span{animation:none}}
  `;
  document.head.append(style);document.body.append(dialog);
  const title=dialog.querySelector('h1'),message=dialog.querySelector('#mathdayUpdateMessage'),actions=dialog.querySelector('.md-update-actions'),close=dialog.querySelector('#mathdayUpdateClose');
  function clearMarker(){try{sessionStorage.removeItem(key);}catch{}}
  function finish(){active=false;clearTimeout(timer);clearMarker();if(dialog.open)dialog.close();}
  function fail(text='Kemas kini mengambil masa lebih lama. Semak sambungan internet dan cuba semula.'){
    if(!active)return;clearTimeout(timer);clearMarker();dialog.dataset.failed='true';
    title.textContent='Kemas kini belum selesai';message.textContent=text;actions.hidden=false;close.hidden=booting;
  }
  function show(isBoot=false){
    active=true;booting=isBoot;clearTimeout(timer);dialog.dataset.failed='false';actions.hidden=true;
    title.textContent=isBoot?'Memuatkan MathDay baharu':'Mengemas kini MathDay';
    message.textContent=isBoot?'Sedang memuatkan aplikasi dan bank soalan. Sila tunggu sebentar.':'Sila tunggu sebentar. Kami sedang menyediakan versi baharu.';
    if(!dialog.open)dialog.showModal();timer=setTimeout(()=>fail(),45000);
  }
  function start(){try{sessionStorage.setItem(key,String(Date.now()));}catch{}show(false);}
  dialog.addEventListener('cancel',event=>{event.preventDefault();});
  close.onclick=()=>{dispatchEvent(new Event('mathday:update-cancel'));finish();};
  dialog.querySelector('#mathdayUpdateRetry').onclick=()=>{dispatchEvent(new Event('mathday:update-cancel'));start();requestAnimationFrame(()=>location.reload());};
  addEventListener('mathday:app-ready',finish);
  addEventListener('error',event=>{if(active&&booting&&(event.target?.tagName==='SCRIPT'||event instanceof ErrorEvent))fail('Fail kemas kini belum dapat dimuatkan. Semak internet, kemudian tekan Cuba semula.');},true);
  window.MathDayUpdateLoader=Object.freeze({start,finish,fail});
  try{const timestamp=Number(sessionStorage.getItem(key));clearMarker();if(timestamp>0&&Date.now()-timestamp>=0&&Date.now()-timestamp<120000)show(true);}catch{}
})();
