(function(root){
  'use strict';
  // Browser-session coordination, not server-side Firebase token revocation.
  function createSingleSession(deps){
    let version=0,active=null,unsubscribe=null,ready=false;
    const bounded=promise=>new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('session-timeout')),deps.timeoutMs||12000);
      Promise.resolve(promise).then(v=>{clearTimeout(timer);resolve(v);},e=>{clearTimeout(timer);reject(e);});
    });
    function stop(){version++;active=null;ready=false;if(unsubscribe)unsubscribe();unsubscribe=null;}
    function fail(epoch,reason){
      if(epoch!==version||!active)return;
      const uid=active.uid;stop();deps.onBlocked(true);deps.onLost(uid,reason);
    }
    function accept(epoch,snapshot){
      if(epoch!==version||!active)return false;
      if(!snapshot||snapshot.deviceId!==active.deviceId){fail(epoch,'replaced');return false;}
      return true;
    }
    async function start(uid,claim){
      stop();const epoch=version;deps.onBlocked(true);
      try{
        const deviceId=deps.deviceId(uid);active={uid,deviceId};
        if(claim)await bounded(deps.claim(uid,deviceId,()=>epoch===version));
        if(epoch!==version)return false;
        if(!accept(epoch,await bounded(deps.read(uid))))return false;
        unsubscribe=deps.watch(uid,snapshot=>{
          if(snapshot.fromCache||snapshot.pending)return;
          accept(epoch,snapshot.data);
        },()=>fail(epoch,'unavailable'));
        if(epoch!==version){unsubscribe?.();unsubscribe=null;return false;}
        ready=true;deps.onBlocked(false);return true;
      }catch(error){
        if(!active&&epoch===version)active={uid};
        fail(epoch,error?.code==='permission-denied'?'rules':'unavailable');return false;
      }
    }
    async function verify(){
      if(!active||!ready)return false;const epoch=version,uid=active.uid;deps.onBlocked(true);
      try{if(!accept(epoch,await bounded(deps.read(uid))))return false;deps.onBlocked(false);return true;}
      catch{fail(epoch,'unavailable');return false;}
    }
    return {start,stop,verify,isReady:()=>ready,offline:()=>fail(version,'offline')};
  }
  root.MathDaySingleSession={createSingleSession};
})(typeof globalThis!=='undefined'?globalThis:this);
