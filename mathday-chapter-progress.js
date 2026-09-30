/* Read-only chapter mastery: never changes answers, rewards or learning selection. */
(function(root){
  'use strict';
  // Begin neutral; each correct/wrong question shifts an equal share of its chapter.
  // Actual percentages remain separate from this visual balance.
  function balance({correct,wrong,total}){
    const green=total?Math.max(0,Math.min(100,50+(correct-wrong)/total*50)):50;
    return {green,red:100-green};
  }
  function summarize(items,storage,uid,form,chapter){
    const ids=new Set(items.filter(q=>q&&typeof q.id==='string'&&q.id).map(q=>q.id));
    let correct=0,wrong=0;
    if(uid)for(const id of ids){
      const key=`mathDayQuizAnswer:${uid}:${form}:${chapter}:${id}`;
      const viewed=storage.getItem(key+':answer-viewed')==='true';
      let result;try{result=JSON.parse(storage.getItem(key)||'null');}catch{}
      // Reveals may store correct:true; they are not independently correct answers.
      if(!viewed&&result&&typeof result==='object'&&!Array.isArray(result)&&typeof result.correct==='boolean'&&!result.answerViewed&&result.completedBy!=='answer-reveal'){
        if(result.correct)correct++;else wrong++;
      }
    }
    const total=ids.size;
    return {correct,wrong,total,percent:total?Math.round(correct/total*1000)/10:0,wrongPercent:total?Math.round(wrong/total*1000)/10:0};
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
    dialog.innerHTML='<header class="chapter-progress-header"><div><span class="chapter-progress-eyebrow">LATIHAN ANDA</span><h2 id="chapterProgressTitle">Kemajuan Bab</h2></div><button type="button" class="chapter-progress-close" aria-label="Tutup kemajuan bab">×</button></header><p id="chapterProgressDescription">Lihat prestasi dan kenal pasti di mana cuba baiki di mana kelemahan anda.</p><div class="chapter-progress-controls"><label for="chapterProgressForm">Tingkatan</label><select id="chapterProgressForm"></select><button type="button" class="chapter-progress-refresh">Muat semula</button></div><p class="chapter-progress-summary" role="status" aria-live="polite"></p><div class="chapter-progress-list"></div><p class="chapter-progress-footnote">Berdasarkan rekod akaun yang tersedia pada peranti ini. Rekod peranti lain akan muncul selepas penyelarasan selesai.</p>';
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
        let correct=0,wrong=0,total=0;
        for(const row of rows){
          correct+=row.correct;wrong+=row.wrong;total+=row.total;
          const article=document.createElement('article');article.className='chapter-progress-row';
          const top=document.createElement('div');top.className='chapter-progress-row-top';
          const heading=document.createElement('h3');heading.id=`chapterProgress-${form}-${row.chapter}`;heading.textContent=`Bab ${row.chapter+1}: ${row.title}`;
          top.append(heading);
          const split=balance(row);
          const bar=document.createElement('div');bar.className='chapter-progress-meter';bar.setAttribute('role','img');bar.setAttribute('aria-label',`${row.title}: Bar imbangan bermula 50–50. Betul ${row.percent}% (${row.correct} daripada ${row.total}); salah ${row.wrongPercent}% (${row.wrong} daripada ${row.total}); belum dinilai ${row.total-row.correct-row.wrong} soalan.`);
          const legend=document.createElement('div');legend.className='chapter-progress-legend';
          for(const [kind,label,amount,percent] of [['correct','Betul',row.correct,row.percent],['wrong','Salah',row.wrong,row.wrongPercent]]){
            const segment=document.createElement('span');segment.className=`chapter-progress-segment ${kind}`;segment.style.width=`${kind==='correct'?split.green:split.red}%`;segment.setAttribute('aria-hidden','true');bar.append(segment);
            const stat=document.createElement('div');stat.className=`chapter-progress-stat ${kind}`;
            const value=document.createElement('strong');value.textContent=`${label} ${percent}%`;
            const fraction=document.createElement('span');fraction.textContent=`${amount} / ${row.total} soalan`;
            stat.append(value,fraction);legend.append(stat);
          }
          const count=document.createElement('p');count.textContent=row.total?`${row.total} soalan · ${row.total-row.correct-row.wrong} belum dinilai`:'Soalan belum tersedia';
          article.append(top,bar,legend,count);list.append(article);
        }
        const summaryTitle=document.createElement('strong');summaryTitle.className='chapter-progress-summary-title';summaryTitle.textContent=`Tingkatan ${form} · ${total} soalan`;
        const summaryCorrect=document.createElement('span');summaryCorrect.className='chapter-progress-summary-correct';summaryCorrect.textContent=`${correct} betul`;
        const summaryWrong=document.createElement('span');summaryWrong.className='chapter-progress-summary-wrong';summaryWrong.textContent=`${wrong} salah`;
        summary.replaceChildren(summaryTitle,document.createTextNode(' '),summaryCorrect,document.createTextNode(' · '),summaryWrong);
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
  root.MathDayChapterProgress=Object.freeze({summarize,balance,create});
})(globalThis);
