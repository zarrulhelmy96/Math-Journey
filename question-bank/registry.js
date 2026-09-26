/* New question registration. Classic scripts deliberately support file:// previews. */
(function(root){
  'use strict';
  if(typeof freshQuizBank==='undefined'||typeof formatQuizMathText!=='function')throw Error('Question bank dependencies are missing.');
  const ids=new Set(),extra=[],loaded=new Set();
  for(const q of freshQuizBank){if(!q.id||ids.has(q.id))throw Error('Duplicate legacy question ID: '+q.id);ids.add(q.id);}
  // Reserve IDs from historical loader fallbacks too, even when a newer bank covers that topic.
  for(const rows of [integerArithmeticQuestions,integerArithmeticGoldQuestions,positiveNegativeFractionQuestions,positiveNegativeFractionGoldQuestions,positiveNegativeDecimalQuestions,positiveNegativeDecimalGoldQuestions,rationalNumberQuestions,rationalNumberGoldQuestions,factorMultipleIntroductionQuestions,factorMultipleIntroductionGoldQuestions,multiplesLcmQuestions,multiplesLcmGoldQuestions,squareSquareRootQuestions,squareSquareRootGoldQuestions,ratioNormalQuestions,ratioGoldQuestions,rateNormalQuestions,rateGoldQuestions,proportionNormalQuestions,proportionGoldQuestions,ratioRateProportionNormalQuestions,ratioRateProportionGoldQuestions,percentRelationNormalQuestions,percentRelationGoldQuestions,cubeCubeRootQuestions,cubeCubeRootGoldQuestions,savingsInvestmentQuestions,savingsInvestmentGoldQuestions,creditDebtQuestions,creditDebtGoldQuestions])for(const q of rows)ids.add(q.id);
  const matches=(q,s)=>q.form===Number(s.form)&&q.chapter===Number(s.chapter)+1&&q.subtopic===Number(s.subtopic??0);
  function register(paper,questions){
    if(!['paper1','paper2'].includes(paper)||loaded.has(paper)||!Array.isArray(questions))throw Error('Invalid or repeated question pack: '+paper);
    const nextIds=new Set(ids);
    // Validate the whole pack before accepting any record. Never silently replace an old ID.
    for(const q of questions){
      if(!q||typeof q.id!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,119}$/.test(q.id)||nextIds.has(q.id))throw Error('Invalid or duplicate question ID: '+q?.id);
      if(!Number.isInteger(q.form)||q.form<1||q.form>5||!Number.isInteger(q.chapter)||q.chapter<1||q.chapter>[0,13,13,9,10,8][q.form]||!Number.isInteger(q.subtopic)||q.subtopic<0)throw Error('Invalid chapter metadata: '+q.id);
      if(q.paper!==paper||q.section!=='quiz'||q.status!=='published'||!['normal','genius'].includes(q.category)||(paper==='paper2'&&q.category!=='genius'))throw Error('Invalid paper/category metadata: '+q.id);
      if(q.costType!==(q.category==='genius'?'gold':'free'))throw Error('Invalid access category: '+q.id);
      if(!Number.isFinite(q.order)||!['questionText','hintText','solutionText'].every(key=>typeof q[key]==='string'&&q[key].trim()))throw Error('Missing question content: '+q.id);
      if(!['xpCorrect','xpWrong'].every(key=>Number.isSafeInteger(q[key])&&q[key]>=0))throw Error('Invalid XP values: '+q.id);
      // Initial extension format uses the already-supported multiple-choice renderer.
      // Written-answer/marking workflows need a separate renderer before publication.
      if(q.type&&q.type!=='multiple-choice')throw Error('Unsupported new question type: '+q.id);
      if(!Array.isArray(q.options)||q.options.length<2||!q.options.every(o=>typeof o==='string'&&o.trim())||!Number.isInteger(q.correctIndex)||q.correctIndex<0||q.correctIndex>=q.options.length)throw Error('Invalid answer choices: '+q.id);
      nextIds.add(q.id);
    }
    for(const q of questions){ids.add(q.id);extra.push(q);}
    loaded.add(paper);
  }
  root.MathDayQuestionBank=Object.freeze({
    register,
    get ready(){return loaded.has('paper1')&&loaded.has('paper2');},
    paperOf:q=>q.paper==='paper2'?'paper2':'paper1',
    hasPaper2:s=>extra.some(q=>q.paper==='paper2'&&matches(q,s)),
    merge(rows,selection){
      const additions=extra.filter(q=>matches(q,selection));
      if(!additions.length)return rows;
      const existing=new Set(rows.map(q=>q.id));
      for(const q of additions)if(existing.has(q.id))throw Error('Question ID conflicts with published content: '+q.id);
      return [...rows,...additions].sort((a,b)=>(a.order||0)-(b.order||0));
    }
  });
})(globalThis);
