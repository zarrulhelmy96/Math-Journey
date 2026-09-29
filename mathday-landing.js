(() => {
  'use strict';
  const toggle=document.querySelector('.menu-toggle');
  const menu=document.getElementById('mobile-nav');
  toggle.hidden=false;
  const setMenu=open=>{menu.hidden=!open;toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Tutup menu':'Buka menu');};
  toggle.addEventListener('click',()=>setMenu(menu.hidden));
  menu.addEventListener('click',event=>{if(event.target.closest('a'))setMenu(false);});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!menu.hidden){setMenu(false);toggle.focus();}});
  window.matchMedia('(min-width:901px)').addEventListener('change',event=>{if(event.matches)setMenu(false);});
  const fraction=(n,d)=>`<span class="sample-fraction"><span>${n}</span><span>${d}</span></span>`;
  const matrix=values=>`<span class="sample-matrix">${values.map(v=>`<span>${v}</span>`).join('')}</span>`;
  const questions=[
    {topic:'Persamaan linear',title:'Berapa nilai x?',expression:'3(<i>x</i> + 2) = 18',options:['2','4','6','8'],correct:1,explanation:'Bahagikan kedua-dua belah dengan 3: x + 2 = 6. Kemudian tolak 2: <strong>x = 4</strong>.'},
    {topic:'Pecahan',title:'Hitung beza dua pecahan ini.',expression:`${fraction(3,4)} <span>−</span> ${fraction(1,2)}`,options:['1/4','1/2','2/3','3/8'],correct:0,explanation:'Samakan penyebut: 1/2 = 2/4. Maka 3/4 − 2/4 = <strong>1/4</strong>.'},
    {topic:'Peratus',title:'Berapakah nilai ini?',expression:'20% × 80',options:['4','8','16','20'],correct:2,explanation:'20% = 20/100. Darabkan 20/100 dengan 80 untuk mendapat <strong>16</strong>.'},
    {topic:'Teorem Pythagoras',title:'Cari panjang hipotenus, c.',expression:'c² = 3² + 4²',options:['7 cm','25 cm','12 cm','5 cm'],correct:3,note:'Segi tiga bersudut tegak dengan dua sisi berserenjang 3 cm dan 4 cm.',explanation:'c² = 9 + 16 = 25. Panjang ialah positif, jadi c = √25 = <strong>5 cm</strong>.'},
    {topic:'Matriks',title:'Cari unsur baris 1, lajur 2 bagi A + B.',expression:`<span>A = ${matrix([1,2,3,4])}</span><span>B = ${matrix([2,1,0,5])}</span>`,options:['2','3','4','6'],correct:1,explanation:'Ambil unsur baris pertama, lajur kedua: A mempunyai 2 dan B mempunyai 1. Tambahkan: 2 + 1 = <strong>3</strong>.'}
  ];
  const answers=[...document.querySelectorAll('[data-answer]')];
  const feedback=document.getElementById('quiz-feedback');
  const working=document.getElementById('quiz-working');
  const next=document.getElementById('quiz-next');
  const counter=document.getElementById('quiz-counter');
  const marks=[...document.querySelectorAll('.quiz-progress span')];
  let index=0,selections=Array(questions.length).fill(null),finished=false;
  const updateProgress=()=>marks.forEach((mark,i)=>{mark.classList.toggle('is-current',!finished&&i===index);mark.classList.toggle('is-done',selections[i]!==null);});
  function renderQuestion(focus=false){
    const question=questions[index];
    document.getElementById('quiz-question').hidden=false;document.getElementById('quiz-summary').hidden=true;
    counter.textContent=`Soalan ${index+1} daripada ${questions.length}`;
    document.getElementById('quiz-topic').textContent=question.topic.toUpperCase();document.getElementById('quiz-title').textContent=question.title;
    const expression=document.getElementById('quiz-expression');expression.innerHTML=question.expression+(question.note?`<small>${question.note}</small>`:'');expression.classList.toggle('is-matrix',question.topic==='Matriks');
    answers.forEach((button,i)=>{button.replaceChildren();const letter=document.createElement('span');letter.textContent=String.fromCharCode(65+i);button.append(letter,document.createTextNode(question.options[i]));button.disabled=false;button.setAttribute('aria-pressed','false');button.classList.remove('is-correct','is-wrong');});
    feedback.textContent='Pilih satu jawapan. Jawapan pertama akan dikira.';delete feedback.dataset.status;working.hidden=true;next.hidden=true;updateProgress();if(focus)answers[0].focus({preventScroll:true});
  }
  answers.forEach(button=>button.addEventListener('click',()=>{
    if(finished||selections[index]!==null)return;
    const question=questions[index],selectedIndex=Number(button.dataset.answer),correct=selectedIndex===question.correct;selections[index]=selectedIndex;
    answers.forEach((answer,i)=>{const selected=answer===button;answer.disabled=true;answer.setAttribute('aria-pressed',String(selected));answer.classList.toggle('is-correct',i===question.correct);answer.classList.toggle('is-wrong',selected&&!correct);});
    feedback.dataset.status=correct?'correct':'wrong';
    feedback.textContent=correct?'Betul! +1 markah. Lihat penjelasan di bawah.':`Belum tepat. Jawapan betul ialah ${question.options[question.correct]}. Jom lihat caranya.`;
    document.getElementById('quiz-explanation').innerHTML=question.explanation;working.hidden=false;next.hidden=false;next.textContent=index===questions.length-1?'Lihat keputusan':'Soalan seterusnya';updateProgress();next.focus({preventScroll:true});
  }));
  next.addEventListener('click',()=>{
    if(finished||selections[index]===null)return;
    if(index<questions.length-1){index++;renderQuestion(true);return;}
    finished=true;const score=selections.reduce((sum,selected,i)=>sum+Number(selected===questions[i].correct),0);
    document.getElementById('quiz-question').hidden=true;document.getElementById('quiz-summary').hidden=false;
    counter.textContent=`Percubaan selesai. ${score} daripada ${questions.length} jawapan betul.`;
    document.getElementById('quiz-score').textContent=`${score} / ${questions.length}`;
    document.getElementById('quiz-summary-message').textContent=score===5?'Semua betul! Teruskan cabaran anda dalam MathDay.':'Dah cuba, dah belajar. Teruskan latihan mengikut rentak anda.';
    const review=document.getElementById('quiz-review');review.replaceChildren();questions.forEach((question,i)=>{const row=document.createElement('div'),topic=document.createElement('span'),status=document.createElement('strong');const correct=selections[i]===question.correct;topic.textContent=question.topic;status.textContent=correct?'✓ Betul':'Belum tepat';status.className=correct?'review-correct':'review-wrong';row.append(topic,status);review.append(row);});
    updateProgress();document.querySelector('#quiz-summary .button').focus({preventScroll:true});
  });
  document.getElementById('quiz-retry').addEventListener('click',()=>{
    index=0;selections=Array(questions.length).fill(null);finished=false;renderQuestion(true);
  });
  renderQuestion();
  document.getElementById('copyright-year').textContent=String(new Date().getFullYear());
})();
