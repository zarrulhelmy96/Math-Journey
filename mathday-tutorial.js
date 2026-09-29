/* Read-only guided tour: never click a target or initiate checkout. */
(function(){
 'use strict';
 const steps=[
  ['profile','[data-main-nav="profile"]','Profil anda','Di sini anda boleh melihat keahlian, jumlah XP, kemajuan dan baki Reset Coin. Anda boleh membuka Tutorial ini semula pada bila-bila masa.'],
  ['profile','[data-main-nav="leaderboard"]','Leaderboard','Lihat 100 pelajar terbaik berdasarkan jumlah XP. Tiga tempat teratas dipaparkan di podium.'],
  ['profile','[data-main-nav="store"]','Pakej Gold','Menu ini membawa anda ke pilihan pakej Gold, Reset Coin, pembelian voucher dan tebusan voucher.'],
  ['profile','[data-main-nav="learn"]','Belajar','Mulakan latihan melalui menu Belajar. Pilih tingkatan, bab dan subtopik yang ingin anda kuasai.'],
  ['profile','#continueLearning','Mula belajar dari Profil','Butang Mula Belajar di Profil juga membawa anda ke pilihan tingkatan. Mari lihat langkah seterusnya.'],
  ['form','#formGrid button','Pilih tingkatan','Pilih tingkatan anda. Tutorial ini menggunakan Tingkatan 1 sebagai contoh sahaja; pilihan pembelajaran anda tidak akan diubah selepas tutorial.'],
  ['chapter','#chapterList button','Pilih bab','Selepas memilih tingkatan, tekan bab yang ingin dipelajari untuk melihat senarai subtopik.'],
  ['subtopic','#subtopicList button','Pilih subtopik','Tekan subtopik pilihan anda. Setiap subtopik mempunyai bahan dan latihan yang berkaitan.'],
  ['chapterHub','#openQuiz','Buka Quiz','Tekan Quiz, pilih kategori Normal atau Gold, kemudian pilih nombor soalan. Nota dan Contoh Soalan juga boleh dibuka apabila tersedia. Akses Gold diperlukan untuk ciri Gold.'],
  ['store','[data-extra-package="gold-30"]','Beli pakej Gold','Pilih Gold 30 Hari, 90 + 30 Hari atau Lifetime. Tekan pakej pilihan, semak harga dan nombor telefon, baca terma, kemudian teruskan ke pembayaran. Gold aktif selepas bayaran disahkan oleh server. Tutorial ini tidak membuat pembelian.'],
  ['store','[data-extra-package="reset-10"]','Beli Reset Coin','Pilih kotak 10 Reset Coin atau 20 + 5 Percuma, kemudian lengkapkan pembayaran. Setiap 1 coin membolehkan anda reset satu soalan yang dijawab salah untuk cuba semula. Reset Coin tidak termasuk akses Gold.'],
  ['profile','#startTutorial','Dah sedia untuk belajar!','Anda sudah kenal menu utama MathDay. Tekan Selesai untuk kembali ke Profil. Jika terlupa, buka butang Tutorial ini semula.']
 ];
 window.MathDayTutorial={create({navigate,begin,restore,canStart,getUserKey=()=>''}){
  const app=document.querySelector('.app'),actions=document.querySelector('#profileScreen .profile-actions');
  if(!app||!actions)return null;
  const trigger=document.createElement('button');trigger.type='button';trigger.id='startTutorial';trigger.className='secondary';trigger.textContent='Tutorial';
  actions.insertBefore(trigger,document.getElementById('logoutButton'));
  const overlay=document.createElement('div');overlay.className='md-tour';overlay.hidden=true;
  overlay.innerHTML='<div class="md-tour-spot" aria-hidden="true"></div><section class="md-tour-card" role="dialog" aria-modal="true" aria-labelledby="mdTourTitle" aria-describedby="mdTourCopy" tabindex="-1"><div class="md-tour-top"><span class="md-tour-progress" aria-live="polite"></span><button type="button" class="md-tour-close" aria-label="Tutup tutorial">Tutup</button></div><h2 id="mdTourTitle"></h2><p id="mdTourCopy"></p><div class="md-tour-track" aria-hidden="true"><span></span></div><div class="md-tour-actions"><button type="button" data-tour-back>Kembali</button><button type="button" data-tour-next>Seterusnya</button></div></section>';
  document.body.append(overlay);
  const spacer=document.createElement('div');spacer.hidden=true;spacer.style.height='100vh';spacer.setAttribute('aria-hidden','true');document.body.append(spacer);
  const card=overlay.querySelector('.md-tour-card'),spot=overlay.querySelector('.md-tour-spot'),back=overlay.querySelector('[data-tour-back]'),next=overlay.querySelector('[data-tour-next]');
  let active=false,index=0,target=null,frame=0,snapshot=null,priorInert=false,activeUser='';
  // Only a non-sensitive, per-account onboarding preference is stored locally.
  const welcomed=new Set();let invitedUid='',welcomeFocus=null;
  const welcome=document.createElement('dialog');welcome.className='md-tour-welcome';
  welcome.setAttribute('aria-labelledby','mdWelcomeTitle');welcome.setAttribute('aria-describedby','mdWelcomeCopy');
  welcome.innerHTML='<span class="md-welcome-icon" aria-hidden="true">✦</span><h2 id="mdWelcomeTitle">Selamat datang ke MathDay!</h2><p id="mdWelcomeCopy">Nak lihat tutorial ringkas? Kami tunjukkan cara mula belajar, fungsi menu utama dan cara membeli Gold atau Reset Coin.</p><p class="md-welcome-note">Anda juga boleh buka Tutorial di Profil pada bila-bila masa.</p><div class="md-tour-actions"><button type="button" data-welcome-no>Tak nak</button><button type="button" data-welcome-yes autofocus>Ya, mula tutorial</button></div>';
  document.body.append(welcome);
  function hasWelcomed(uid){try{return welcomed.has(uid)||localStorage.getItem('mathDayTutorialWelcome:v1:'+uid)==='done';}catch{return welcomed.has(uid);}}
  function rememberWelcome(uid){if(!uid)return;welcomed.add(uid);try{localStorage.setItem('mathDayTutorialWelcome:v1:'+uid,'done');}catch{}}
  function closeWelcome(remember=false,focus=true){
   if(!welcome.open)return;
   if(remember&&invitedUid===getUserKey())rememberWelcome(invitedUid);
   welcome.close();invitedUid='';
   if(focus&&welcomeFocus?.isConnected)welcomeFocus.focus({preventScroll:true});
  }
  function offerWelcome(){
   const uid=getUserKey();
   if(welcome.open&&(!canStart()||uid!==invitedUid))closeWelcome(false,false);
   if(!uid||active||welcome.open||!canStart()||hasWelcomed(uid)||!document.querySelector('#profileScreen.active'))return;
   if(app.inert||document.querySelector('dialog[open],.retry-overlay:not(.hidden),.announcement-overlay:not(.hidden)'))return;
   invitedUid=uid;welcomeFocus=document.activeElement;welcome.showModal();
  }
  welcome.querySelector('[data-welcome-no]').onclick=()=>closeWelcome(true);
  welcome.querySelector('[data-welcome-yes]').onclick=()=>{closeWelcome(true,false);start();};
  welcome.addEventListener('cancel',event=>{event.preventDefault();closeWelcome(true);});
  function layout(){
   if(!active||!target)return;
   const r=target.getBoundingClientRect(),w=window.innerWidth,h=window.innerHeight,pad=6;
   const left=Math.max(3,r.left-pad),top=Math.max(3,r.top-pad),right=Math.min(w-3,r.right+pad),bottom=Math.min(h-3,r.bottom+pad);
   Object.assign(spot.style,{left:left+'px',top:top+'px',width:Math.max(0,right-left)+'px',height:Math.max(0,bottom-top)+'px'});
   const cw=card.offsetWidth,ch=card.offsetHeight;
   let y=bottom+12;
   if(y+ch>h-12)y=top-ch-12;
   // In short landscape view, put the card beside the target when possible.
   let x=Math.max(12,Math.min(w-cw-12,(left+right-cw)/2));
   if(y<12){y=Math.max(12,(h-ch)/2);if(right+cw+24<=w)x=right+12;else if(left-cw-12>=12)x=left-cw-12;}
   Object.assign(card.style,{left:x+'px',top:Math.max(12,Math.min(h-ch-12,y))+'px'});
  }
  function schedule(){cancelAnimationFrame(frame);frame=requestAnimationFrame(layout);}
  function stop(returnToProfile=true){
   if(!returnToProfile)closeWelcome(false,false);
   if(!active)return;
   active=false;cancelAnimationFrame(frame);overlay.hidden=true;spacer.hidden=true;app.inert=priorInert;
   restore(snapshot,returnToProfile);snapshot=null;target=null;
   if(returnToProfile)trigger.focus({preventScroll:false});
  }
  function show(){
   const [screen,selector,title,copy]=steps[index];
   navigate(screen);
   target=document.querySelector(selector);
   if(!target||!target.getClientRects().length){stop();return;}
   overlay.querySelector('#mdTourTitle').textContent=title;overlay.querySelector('#mdTourCopy').textContent=copy;
   overlay.querySelector('.md-tour-progress').textContent='TUTORIAL · '+(index+1)+' / '+steps.length;
   overlay.querySelector('.md-tour-track span').style.width=((index+1)/steps.length*100)+'%';
   back.disabled=index===0;next.textContent=index===steps.length-1?'Selesai':'Seterusnya';
   if(!target.closest('.bottom-nav')){target.scrollIntoView({block:'start',behavior:'instant'});window.scrollBy({top:-20,behavior:'instant'});}
   layout();card.focus({preventScroll:true});schedule();
  }
  function start(){
   if(active||!canStart())return;
   closeWelcome(true,false);rememberWelcome(getUserKey());
   snapshot=begin();activeUser=getUserKey();priorInert=app.inert;app.inert=true;active=true;index=0;overlay.hidden=false;spacer.hidden=false;show();
  }
  trigger.addEventListener('click',start);
  back.onclick=()=>{if(index>0){index--;show();}};
  next.onclick=()=>{if(index===steps.length-1)stop();else{index++;show();}};
  overlay.querySelector('.md-tour-close').onclick=()=>stop();
  overlay.addEventListener('keydown',event=>{
   if(event.key==='Escape'){event.preventDefault();stop();}
   if(event.key==='Tab'){
    const buttons=[...card.querySelectorAll('button:not(:disabled)')],pos=buttons.indexOf(document.activeElement);
    if(event.shiftKey&&(pos<=0)){event.preventDefault();buttons.at(-1).focus();}
    else if(!event.shiftKey&&(pos===buttons.length-1||pos<0)){event.preventDefault();buttons[0].focus();}
   }
  });
  window.addEventListener('resize',schedule);window.addEventListener('scroll',schedule,{passive:true});
  window.visualViewport?.addEventListener('resize',schedule);
  new ResizeObserver(schedule).observe(card);
  // Session expiry must not leave a tutorial over the login screen.
  new MutationObserver(()=>{if(active&&(!canStart()||activeUser!==getUserKey()))stop(false);offerWelcome();}).observe(app,{subtree:true,attributes:true,attributeFilter:['class']});
  queueMicrotask(offerWelcome);
  return {start,stop};
 }};
})();
