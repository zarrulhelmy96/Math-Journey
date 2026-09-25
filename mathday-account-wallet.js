/* Authoritative account wallet. Firebase adapter lives in index.html.
 * Never imports a browser's legacy Gold/coin claims into the database. */
(function(root){
  'use strict';
  const fields=['schema','resetCoins','goldPlan','goldUntil','pending','lastQuestion','revision'];
  function initial(){return {schema:1,resetCoins:10,goldPlan:'normal',goldUntil:0,pending:{},lastQuestion:'',revision:0};}
  function valid(w){
    return !!w&&Object.keys(w).length===fields.length&&fields.every(k=>Object.hasOwn(w,k))&&w.schema===1
      &&Number.isSafeInteger(w.resetCoins)&&w.resetCoins>=0&&w.resetCoins<=1000000
      &&['normal','timed','lifetime'].includes(w.goldPlan)&&Number.isSafeInteger(w.goldUntil)&&w.goldUntil>=0
      &&(w.goldPlan==='timed'?w.goldUntil>0:w.goldUntil===0)
      &&Number.isSafeInteger(w.revision)&&w.revision>=0
      &&typeof w.lastQuestion==='string'&&w.lastQuestion.length<=1200
      &&w.pending!==null&&typeof w.pending==='object'&&!Array.isArray(w.pending)
      &&Object.keys(w.pending).length<=1000&&Object.entries(w.pending).every(([k,v])=>k.length>0&&k.length<=1200&&!k.includes('/')&&v===true);
  }
  function checked(w){if(!valid(w))throw Error('wallet/invalid');return structuredClone(w);}
  function question(id){if(typeof id!=='string'||!id.length||id.length>1200||id.includes('/'))throw Error('wallet/question');}
  function reserve(w,id){
    w=checked(w);question(id);if(w.pending[id]===true)return w;
    if(w.resetCoins<1)throw Error('wallet/insufficient');
    if(Object.keys(w.pending).length>=1000)throw Error('wallet/too-many-pending');
    return {...w,resetCoins:w.resetCoins-1,pending:{...w.pending,[id]:true},lastQuestion:id,revision:w.revision+1};
  }
  function consume(w,id){
    w=checked(w);question(id);if(w.pending[id]!==true)throw Error('wallet/no-reset');
    delete w.pending[id];return {...w,lastQuestion:id,revision:w.revision+1};
  }
  function entitlement(w,now=Date.now()){
    const gold=valid(w)&&(w.goldPlan==='lifetime'||w.goldPlan==='timed'&&w.goldUntil>now);
    return {gold,unlimited:gold,unlimitedUntil:gold&&w.goldPlan==='timed'?w.goldUntil:0};
  }
  function createController(adapter){
    let uid='',generation=0,value=null,status='signed-out',unsubscribe=null,starting=null;
    const current=(id,version)=>uid===id&&generation===version&&adapter.currentUid()===id;
    function emit(){adapter.onChange?.(status);}
    function accept(w){w=checked(w);if(!value||w.revision>=value.revision)value=w;status='ready';emit();}
    function stop(){generation++;unsubscribe?.();unsubscribe=null;uid='';value=null;starting=null;status='signed-out';emit();}
    async function start(id){
      if(!id){stop();return false;}
      if(uid===id&&status==='ready')return true;
      if(uid===id&&starting)return starting;
      stop();uid=id;status='loading';const version=generation;emit();
      const check=()=>{if(!current(id,version))throw Error('wallet/account-changed');};
      starting=(async()=>{try{
        const w=await adapter.initialize(id,check);check();accept(w);
        unsubscribe=adapter.listen(id,w=>{if(current(id,version)){try{accept(w);}catch(error){fail(error);}}},fail);
        return true;
      }catch(error){fail(error);return false;}finally{if(current(id,version))starting=null;}})();
      function fail(error){if(!current(id,version))return;value=null;status='error';unsubscribe?.();unsubscribe=null;emit();adapter.onError?.(error);}
      return starting;
    }
    async function change(id,operation,record){
      const user=uid,version=generation;
      const check=()=>{if(!current(user,version)||status!=='ready'||adapter.online?.()===false)throw Error('wallet/not-ready');};
      check();question(id);const w=await adapter.change(user,id,operation,check,record);check();accept(w);return true;
    }
    return {start,stop,reserve:(id,record)=>change(id,'reserve',record),consume:(id,record)=>change(id,'consume',record),
      read(){return adapter.currentUid()===uid&&status==='ready'&&value?checked(value):null;},
      status(){return status;}};
  }
  root.MathDayAccountWallet={initial,valid,reserve,consume,entitlement,createController};
})(globalThis);
