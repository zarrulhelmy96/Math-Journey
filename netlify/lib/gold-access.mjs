import {CATALOG,insist} from './payment-policy.mjs';
export const goldAccessPath=uid=>`goldPackageAccess/${uid}`;
export async function readGoldAccess(tx,uid,wallet,mode,now){
  const saved=await tx.get(goldAccessPath(uid));
  const empty={schema:1,mode,goldUntil:wallet?.goldUntil||0,packages:{},unknown:false};
  if(wallet?.goldPlan!=='timed'||wallet.goldUntil<=now)return empty;
  if(saved?.schema===1&&saved.mode===mode&&saved.goldUntil===wallet.goldUntil)return saved;
  // Reconstruct pre-upgrade purchases/redemptions from trusted server history.
  // All reads occur inside the same transaction as the eventual wallet grant.
  const history=tx.goldHistory?await tx.goldHistory(uid):[];
  const events=history.filter(e=>e.mode===mode&&CATALOG[e.packageId]?.days&&Number.isSafeInteger(e.at)&&e.at>0).sort((a,b)=>a.at-b.at);
  let until=0;const packages={};
  for(const event of events){until=Math.max(until,event.at)+CATALOG[event.packageId].days*86400000;packages[event.packageId]=until;}
  if(until===wallet.goldUntil)return {...empty,packages};
  // Never guess a 30/90-day package from remaining days or change old benefits.
  return {...empty,unknown:true};
}
export function goldBlockReason(wallet,access,packageId,now){
  const plan=CATALOG[packageId];if(!plan?.days&&!plan?.lifetime)return null;
  if(wallet?.goldPlan==='lifetime')return 'already_lifetime';
  if(plan.days&&wallet?.goldPlan==='timed'&&wallet.goldUntil>now){
    if(access.unknown)return 'gold_active_unknown';
    if(access.packages?.[packageId]>now)return packageId==='gold-30'?'gold_30_active':'gold_90_active';
  }
  return null;
}
export function requireGoldAvailable(wallet,access,packageId,now){const reason=goldBlockReason(wallet,access,packageId,now);insist(!reason,reason,409);}
export function nextGoldAccess(access,wallet,packageId,now){
  const packages=Object.fromEntries(Object.entries(access.packages||{}).filter(([,until])=>until>now));
  if(CATALOG[packageId]?.days)packages[packageId]=wallet.goldUntil;
  return {...access,goldUntil:wallet.goldUntil,packages:wallet.goldPlan==='timed'?packages:{},unknown:wallet.goldPlan==='timed'?access.unknown:false};
}
