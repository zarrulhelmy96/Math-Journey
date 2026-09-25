import {randomBytes} from 'node:crypto';
import {CATALOG,digest,insist,grant} from './payment-policy.mjs';

// 160 random bits. The registry uses a digest; the plaintext is only in the
// purchaser's server-only history. Never put voucher codes in logs or URLs.
export function newVoucherCode(){return 'MDG-'+randomBytes(20).toString('hex').toUpperCase().match(/.{4}/g).join('-');}
export function normalizeVoucher(value){
  insist(typeof value==='string'&&value.length<=100,'invalid_voucher');
  const code=value.toUpperCase().replace(/[\s-]/g,'');
  insist(/^MDG[A-F0-9]{40}$/.test(code),'invalid_voucher');return code;
}
export const voucherKey=code=>digest(normalizeVoucher(code));
export const voucherItemPath=(uid,id)=>`voucherAccounts/${uid}/items/${id}`;
export function createVoucherService({store,mode,now}){
  return {
    async list(uid,cursor){
      let after=null;
      if(cursor){
        insist(typeof cursor==='string'&&cursor.length<200,'invalid_cursor');
        try{after=JSON.parse(Buffer.from(cursor,'base64url').toString());}catch{insist(false,'invalid_cursor');}
        insist(Array.isArray(after)&&after.length===2&&Number.isSafeInteger(after[0])&&after[0]>=0&&/^[a-f0-9]{32}$/.test(after[1]),'invalid_cursor');
      }
      const rows=await store.listVouchers(uid,after,26),page=rows.slice(0,25),last=page.at(-1);
      return {items:page.filter(v=>v.mode===mode).map(v=>({orderId:v.orderId,code:v.code,packageId:v.packageId,label:CATALOG[v.packageId]?.label,state:v.state,issuedAt:v.issuedAt,redeemedAt:v.redeemedAt||null})),nextCursor:rows.length>25?Buffer.from(JSON.stringify([last.issuedAt,last.orderId])).toString('base64url'):null};
    },
    async redeem(uid,code){
      // Commit attempts separately: failed lookups must consume the limit too.
      await store.transaction(async tx=>{
        const path=`voucherRedeemLimits/${uid}`,old=await tx.get(path),timestamp=now(),same=old&&timestamp-old.startedAt<900000;
        insist(!same||old.count<10,'voucher_attempt_limit',429);
        tx.set(path,{startedAt:same?old.startedAt:timestamp,count:same?old.count+1:1});
      });
      const key=voucherKey(code),path=`paymentVouchers/${key}`;
      return store.transaction(async tx=>{
        const v=await tx.get(path);
        insist(v&&v.mode===mode,'voucher_unavailable',404);
        if(v.state==='redeemed'){
          insist(v.redeemedBy===uid,'voucher_unavailable',409);
          return {redeemed:true,alreadyRedeemed:true,packageId:v.packageId,label:CATALOG[v.packageId]?.label};
        }
        insist(v.state==='available'&&(!v.expiresAt||v.expiresAt>now()),'voucher_unavailable',409);
        insist(v.catalogVersion===1&&Object.hasOwn(CATALOG,v.packageId),'voucher_requires_review',409);
        const walletPath=`accountWallets/${uid}`,wallet=await tx.get(walletPath),itemPath=voucherItemPath(v.issuerUid,v.orderId),item=await tx.get(itemPath);
        insist(item&&item.voucherKey===key&&item.state==='available','voucher_requires_review',409);
        const timestamp=now(),next=grant(wallet,CATALOG[v.packageId],timestamp);
        tx.set(walletPath,next);
        tx.set(path,{...v,state:'redeemed',redeemedBy:uid,redeemedAt:timestamp});
        tx.set(itemPath,{...item,state:'redeemed',redeemedAt:timestamp});
        return {redeemed:true,alreadyRedeemed:false,packageId:v.packageId,label:CATALOG[v.packageId].label};
      });
    }
  };
}
