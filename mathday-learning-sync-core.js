/* Learning records only. Payments, Gold entitlement and Reset Coin balances are not synced here. */
(function(root){
  'use strict';
  const number=value=>Number.isFinite(Number(value))?Math.max(0,Math.min(1000000000,Math.floor(Number(value)))):0;
  const fields=['xp','answered','correct'];
  function credit(value={}){const answered=Math.min(1,number(value.answered));return {xp:number(value.xp),answered,correct:Math.min(answered,number(value.correct))};}
  function baseline(value={}){const answered=number(value.answered);return {xp:number(value.xp),answered,correct:Math.min(answered,number(value.correct))};}
  function normalize(value){
    if(!value||!Number.isInteger(value.form)||value.form<1||value.form>5||!Number.isInteger(value.chapter)||value.chapter<0||value.chapter>99||typeof value.questionId!=='string'||!value.questionId.length||value.questionId.length>300)return null;
    const r=value.result;if(!r||typeof r.correct!=='boolean')return null;
    const viewed=r.answerViewed===true||r.completedBy==='answer-reveal';
    const result={selected:Number.isSafeInteger(r.selected)?r.selected:0,correct:r.correct||viewed,xp:number(r.xp),rewarded:r.rewarded===true,answerViewed:viewed,retried:r.retried===true,completedBy:viewed?'answer-reveal':'answer'};
    const credits=value.credit?credit(value.credit):credit({xp:result.xp,answered:viewed?0:1,correct:!viewed&&result.correct?1:0});
    return {schema:1,form:value.form,chapter:value.chapter,questionId:value.questionId,result,credit:credits};
  }
  function id(record){return encodeURIComponent(`${record.form}:${record.chapter}:${record.questionId}`);}
  function merge(left,right){
    const a=normalize(left),b=normalize(right);if(!a)return b;if(!b)return a;
    if(id(a)!==id(b))throw Error('Cannot merge different questions');
    const rank=r=>r.answerViewed?2:r.correct?1:0;
    const winner=rank(a.result)!==rank(b.result)?(rank(a.result)>rank(b.result)?a:b):(a.result.selected<=b.result.selected?a:b);
    const result={...winner.result,correct:a.result.correct||b.result.correct,answerViewed:a.result.answerViewed||b.result.answerViewed,retried:a.result.retried||b.result.retried,rewarded:a.result.rewarded||b.result.rewarded,xp:Math.max(a.result.xp,b.result.xp)};
    if(result.answerViewed){result.completedBy='answer-reveal';result.xp=0;result.rewarded=false;}
    const credits=Object.fromEntries(fields.map(key=>[key,Math.max(a.credit[key],b.credit[key])]));
    return normalize({...a,result,credit:credits});
  }
  function key(uid,record){return `mathDayQuizAnswer:${uid}:${record.form}:${record.chapter}:${record.questionId}`;}
  function fromLocal(storage,uid,localKey){
    const prefix=`mathDayQuizAnswer:${uid}:`;if(!localKey.startsWith(prefix)||localKey.endsWith(':answer-viewed'))return null;
    const parts=localKey.slice(prefix.length).match(/^(\d+):(\d+):(.+)$/);if(!parts)return null;
    let result;try{result=JSON.parse(storage.getItem(localKey)||'null');}catch{return null;}
    const viewed=storage.getItem(localKey+':answer-viewed')==='true';
    if(!result&&viewed)result={correct:true,selected:0,xp:0,answerViewed:true};
    if(!result)return null;
    return normalize({form:Number(parts[1]),chapter:Number(parts[2]),questionId:parts[3],result:{...result,...(viewed?{answerViewed:true}: {})},credit:result.syncCredit});
  }
  function collect(storage,uid){
    const records=new Map(),keys=[];for(let i=0;i<storage.length;i++){const k=storage.key(i);if(k?.startsWith(`mathDayQuizAnswer:${uid}:`))keys.push(k.endsWith(':answer-viewed')?k.slice(0,-14):k);}
    for(const k of new Set(keys)){const record=fromLocal(storage,uid,k);if(record)records.set(id(record),record);}
    return records;
  }
  function put(storage,uid,record){
    const r=normalize(record);if(!r)throw Error('Invalid learning record');const localKey=key(uid,r);
    // Attach sync metadata without deleting any pre-existing quiz fields.
    let previous={};try{previous=JSON.parse(storage.getItem(localKey)||'{}')||{};}catch{}
    storage.setItem(localKey,JSON.stringify({...previous,...r.result,syncCredit:r.credit}));
    if(r.result.answerViewed)storage.setItem(localKey+':answer-viewed','true');
  }
  function totals(records){const total={xp:0,answered:0,correct:0};for(const r of records.values())for(const field of fields)total[field]+=r.credit[field];return total;}
  function captureLegacy(storage,uid){
    const k=`mathDayLearningLegacy:${uid}`,saved=storage.getItem(k);if(saved!==null)return baseline(JSON.parse(saved));
    let stats={};try{stats=JSON.parse(storage.getItem(`mathDayStats:${uid}`)||'{}')||{};}catch{}
    const sum=totals(collect(storage,uid)),legacy=baseline(Object.fromEntries(fields.map(f=>[f,Math.max(0,number(stats[f])-sum[f])])));
    storage.setItem(k,JSON.stringify(legacy));return legacy;
  }
  function mergeLegacy(a,b){a=baseline(a);b=baseline(b);return baseline(Object.fromEntries(fields.map(f=>[f,Math.max(a[f],b[f])])));}
  function rebuildStats(storage,uid,legacy){
    let previous={};try{previous=JSON.parse(storage.getItem(`mathDayStats:${uid}`)||'{}')||{};}catch{}
    const sum=totals(collect(storage,uid));for(const f of fields)sum[f]+=baseline(legacy)[f];sum.correct=Math.min(sum.correct,sum.answered);
    storage.setItem(`mathDayStats:${uid}`,JSON.stringify({...previous,...sum}));return sum;
  }
  function captureChange(storage,uid,localKey,before){
    let after=fromLocal(storage,uid,localKey);if(!after)return;
    // Existing syncCredit describes the previous attempt. Credit a newly-correct answer only if it wasn't revealed.
    if(after.result.correct&&!after.result.answerViewed&&after.credit.answered)after.credit.correct=1;
    after=merge(before,after);put(storage,uid,after);return after;
  }
  root.MathDayLearningSync={normalize,id,merge,key,fromLocal,collect,put,totals,captureLegacy,mergeLegacy,rebuildStats,captureChange,baseline};
})(globalThis);
