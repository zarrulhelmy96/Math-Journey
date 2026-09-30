/* Read-only chapter mastery: never changes answers, rewards or learning selection. */
(function(root){
  'use strict';
  function summarize(items,storage,uid,form,chapter){
    const ids=new Set(items.filter(q=>q&&typeof q.id==='string'&&q.id).map(q=>q.id));
    let correct=0;
    if(uid)for(const id of ids){
      const key=`mathDayQuizAnswer:${uid}:${form}:${chapter}:${id}`;
      const viewed=storage.getItem(key+':answer-viewed')==='true';
      let result;try{result=JSON.parse(storage.getItem(key)||'null');}catch{}
      // Reveals may store correct:true; they are not independently correct answers.
      if(!viewed&&result&&typeof result==='object'&&!Array.isArray(result)&&result.correct===true&&!result.answerViewed&&result.completedBy!=='answer-reveal')correct++;
    }
    const total=ids.size;
    return {correct,total,percent:total?Math.round(correct/total*100):0};
  }
  function create({getUser,canOpen,getForm,chapters,loadChapter,storage=root.localStorage}){
    const card=document.getElementById('answerAccuracy')?.closest('.stat-card');
    if(!card)return null;
    const trigger=document.createElement('button');trigger.type='button';trigger.className=card.className;
    trigger.id='openChapterProgress';trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-controls','chapterProgressDialog');
    while(card.firstChild)trigger.append(card.firstChild);
    const hint=document.createElement('span');hint.className='chapter-progress-hint';hint.textContent='Lihat kemajuan bab';trigger.append(hint);card.replaceWith(trigger);
    const dialog=document.createElement('dialog');dialog.id='chapterProgressDialog';dialog.className='chapter-progress-dialog';
    dialog.setAttribute('aria-labelledby','chapterProgressTitle');dialog.setAttribute('aria-describedby','chapterProgressDescription');
    dialog.innerHTML='<header class="chapter-progress-header"><div><span class="chapter-progress-eyebrow">LATIHAN ANDA</span><h2 id="chapterProgressTitle">Kemajuan Bab</h2></div><button type="button" class="chapter-progress-close" aria-label="Tutup kemajuan bab">×</button></header><p id="chapterProgressDescription">Meter menunjukkan jumlah soalan dijawab betul berbanding jumlah soalan dalam bab, termasuk Basic dan Gold. Jawapan salah dan soalan yang dibuka melalui Lihat Jawapan tidak dikira sebagai jawapan betul.</p><div class="chapter-progress-controls"><label for="chapterProgressForm">Tingkatan</label><select id="chapterProgressForm"></select><button type="button" class="chapter-progress-refresh">Muat semula</button></div><p class="chapter-progress-summary" role="status" aria-live="polite"></p><div class="chapter-progress-list"></div><p class="chapter-progress-footnote">Berdasarkan rekod akaun yang tersedia pada peranti ini. Rekod peranti lain akan muncul selepas penyelarasan selesai.</p>';
    document.body.append(dialog);
    const select=dialog.querySelector('select'),list=dialog.querySelector('.chapter-progress-list'),summary=dialog.querySelector('.chapter-progress-summary'),refresh=dialog.querySelector('.chapter-progress-refresh');
    for(const form of Object.keys(chapters)){const option=document.createElement('option');option.value=form;option.textContent=`Tingkatan ${form}`;select.append(option);}
    let version=0,openedUid='';
    const close=()=>{version++;openedUid='';if(dialog.open)dialog.close();list.replaceChildren();summary.textContent='';};
    async function render(){
      const user=getUser();if(!dialog.open||!user||user.uid!==openedUid||!canOpen()){close();return;}
      const token=++version,uid=user.uid,form=Number(select.value);
      const current=()=>token===version&&dialog.open&&getUser()?.uid===uid&&canOpen();
      list.replaceChildren();summary.textContent='Memuatkan kemajuan bab…';list.setAttribute('aria-busy','true');
      try{
        const rows=await Promise.all((chapters[form]||[]).map(async(title,chapter)=>({title,chapter,...summarize(await loadChapter(form,chapter),storage,uid,form,chapter)})));
        if(!current())return;
        let correct=0,total=0;
        for(const row of rows){
          correct+=row.correct;total+=row.total;
          const article=document.createElement('article');article.className='chapter-progress-row';
          const top=document.createElement('div');top.className='chapter-progress-row-top';
          const heading=document.createElement('h3');heading.id=`chapterProgress-${form}-${row.chapter}`;heading.textContent=`Bab ${row.chapter+1}: ${row.title}`;
          const percent=document.createElement('strong');percent.textContent=`${row.percent}%`;top.append(heading,percent);
          const bar=document.createElement('progress');bar.max=100;bar.value=row.percent;bar.setAttribute('aria-labelledby',heading.id);bar.setAttribute('aria-valuetext',`${row.correct} daripada ${row.total} soalan dijawab betul`);
          const count=document.createElement('p');count.textContent=row.total?`${row.correct} / ${row.total} soalan dijawab betul`:'Soalan belum tersedia';
          article.append(top,bar,count);list.append(article);
        }
        summary.textContent=`Tingkatan ${form} · ${correct} / ${total} soalan dijawab betul`;
      }catch{
        if(current())summary.textContent='Kemajuan tidak dapat dimuatkan. Semak sambungan dan tekan Muat semula.';
      }finally{if(token===version)list.removeAttribute('aria-busy');}
    }
    trigger.onclick=()=>{if(!getUser()||!canOpen())return;openedUid=getUser().uid;select.value=String(chapters[getForm()]?getForm():1);dialog.showModal();void render();};
    select.onchange=()=>void render();refresh.onclick=()=>void render();dialog.querySelector('.chapter-progress-close').onclick=close;
    dialog.addEventListener('close',()=>{version++;openedUid='';list.replaceChildren();summary.textContent='';});
    root.addEventListener('storage',event=>{if(dialog.open&&event.key?.startsWith(`mathDayQuizAnswer:${openedUid}:`))void render();});
    return {close,refresh:()=>{if(dialog.open)void render();}};
  }
  root.MathDayChapterProgress=Object.freeze({summarize,create});
})(globalThis);
