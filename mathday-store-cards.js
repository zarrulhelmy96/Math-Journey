/* Presentation only: retain the original checkout buttons and their package identifiers. */
(function(root){
  'use strict';
  function mount({document:doc=root.document,catalog,onBasic}){
    const store=doc.getElementById('storeScreen'),grid=store?.querySelector('.store-grid');
    if(!grid||store.querySelector('.gold-plan-cards'))return;
    const plans=[
      {id:'basic',tier:'NORMAL',name:'Basic',note:'Permulaan untuk rutin anda',features:['Kuiz Basic','Nota, contoh soalan & hint','XP & leaderboard']},
      {id:'gold-30',tier:'GOLD',name:'30 Hari',note:'30 hari akses Gold',features:['Semua ciri Basic','Kuiz Basic & Gold','Lihat Jawapan & Penjelasan']},
      {id:'gold-90-bonus',tier:'GOLD',name:'90 + 30 Hari',note:'120 hari termasuk bonus 30 hari',features:['Semua ciri Basic','Kuiz Basic & Gold','Lihat Jawapan & Penjelasan'],kind:'bestseller'},
      {id:'gold-lifetime',tier:'GOLD',name:'Lifetime',note:'Akses tanpa tarikh tamat',features:['Semua ciri Basic & Gold','Lihat Jawapan & Penjelasan','Tambahan 10 Reset Coin'],kind:'lifetime'}
    ];
    const buttons=plans.slice(1).map(p=>store.querySelector(p.id==='gold-lifetime'?'[data-unlimited-lifetime]':`[data-extra-package="${p.id}"]`));
    if(buttons.some(b=>!b)||plans.slice(1).some(p=>!catalog?.[p.id]))return;
    const section=doc.createElement('section');section.className='gold-plan-cards';section.setAttribute('aria-label','Pilihan pakej MathDay');
    plans.forEach((plan,index)=>{
      const card=doc.createElement('article');card.className='gold-plan-card '+(plan.kind||'');
      if(plan.kind){const badge=doc.createElement('span');badge.className='gold-plan-badge';badge.textContent=plan.kind==='bestseller'?'★ BEST SELLER':'SEKALI BAYAR';card.append(badge);}
      const tier=doc.createElement('span');tier.className='gold-plan-tier';tier.textContent=plan.tier;
      const title=doc.createElement('h2');title.textContent=plan.name;
      const price=doc.createElement('p');price.className='store-price gold-plan-price';price.textContent=index?'RM'+catalog[plan.id].price:'Percuma';
      const note=doc.createElement('p');note.className='gold-plan-note';note.textContent=plan.note;
      const benefits=doc.createElement('ul');plan.features.forEach(text=>{const li=doc.createElement('li');li.textContent=text;benefits.append(li);});
      const button=index?buttons[index-1]:doc.createElement('button');
      button.type='button';button.classList.add('gold-buy-button');button.replaceChildren(doc.createTextNode(index?'Beli':'Mula percuma'));
      button.setAttribute('aria-label',index?'Beli '+catalog[plan.id].label:'Mula belajar percuma');
      if(!index)button.onclick=onBasic;
      card.append(tier,title,price,note,benefits,button);section.append(card);
    });
    store.querySelector('.plan-comparison')?.remove();
    if(grid.firstElementChild?.tagName==='H2'&&grid.firstElementChild.textContent==='Pakej Gold')grid.firstElementChild.remove();
    grid.before(section);
  }
  root.MathDayStoreCards={mount};
})(globalThis);
