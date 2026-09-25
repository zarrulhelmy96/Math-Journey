/* Permanent display IDs. Authentication continues to use Firebase UID, never this code. */
(function(root){
  'use strict';
  const valid=id=>typeof id==='string'&&/^\d{12}$/.test(id);
  function format(id){return valid(id)?`MD-${id.slice(0,4)}-${id.slice(4,8)}-${id.slice(8)}`:'';}
  function generate(random=root.crypto){
    let id='';
    while(id.length<12){const bytes=random.getRandomValues(new Uint8Array(24));for(const byte of bytes){if(byte<250)id+=byte%10;if(id.length===12)break;}}
    return id;
  }
  function createService(adapter){
    let uid='',id='',generation=0,status='signed-out',job=null;
    const current=(user,version)=>uid===user&&generation===version&&adapter.currentUid()===user;
    function stop(){generation++;uid='';id='';job=null;status='signed-out';adapter.onChange?.();}
    async function start(user){
      if(!user){stop();return '';}
      if(uid===user&&id)return id;
      if(uid===user&&job)return job;
      stop();uid=user;status='loading';const version=generation;adapter.onChange?.();
      const check=()=>{if(!current(user,version))throw Error('member/account-changed');};
      job=(async()=>{await Promise.resolve();try{
        for(let attempt=0;attempt<8;attempt++){
          check();const candidate=(adapter.generate||generate)();if(!valid(candidate))throw Error('member/invalid-candidate');
          const assigned=await adapter.claim(user,candidate,check);check();
          if(assigned===null)continue; // The numeric ID belongs to another account; retry without overwriting it.
          if(!valid(assigned))throw Error('member/invalid-record');
          id=assigned;status='ready';adapter.onChange?.();return id;
        }
        throw Error('member/collisions');
      }catch(error){if(current(user,version)){status='error';id='';adapter.onChange?.();adapter.onError?.(error);}return '';}
      finally{if(current(user,version))job=null;}})();
      return job;
    }
    return {start,stop,read:()=>adapter.currentUid()===uid?id:'',status:()=>status};
  }
  function cardState(user,wallet,memberId,memberStatus,now=Date.now()){
    const gold=!!wallet&&(wallet.goldPlan==='lifetime'||wallet.goldPlan==='timed'&&wallet.goldUntil>now);
    const tier=!wallet?'pending':gold?'gold':'silver';
    return {tier,name:user?.displayName||'Pelajar MathDay',label:!wallet?'MENYEMAK':gold?'GOLD':'NORMAL',
      detail:!wallet?'Menyemak status keahlian…':!gold?'Akses Normal percuma':wallet.goldPlan==='lifetime'?'Unlimited Lifetime':`Aktif hingga ${new Date(wallet.goldUntil).toLocaleDateString('ms-MY')}`,
      id:format(memberId)||(memberStatus==='error'?'ID belum tersedia':'Menyediakan ID…')};
  }
  root.MathDayMemberId={valid,format,generate,createService,cardState};
})(globalThis);
