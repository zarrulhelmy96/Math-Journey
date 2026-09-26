import {CATALOG,insist} from './payment-policy.mjs';
// Read-only view of stored orders. Listing history must never reconcile/credit a payment.
export function createPurchaseHistory({store,mode,now=Date.now}){
  return async function listPurchases(uid,cursor){
    let after=null;
    if(cursor){
      insist(typeof cursor==='string'&&cursor.length<200,'invalid_cursor');
      try{after=JSON.parse(Buffer.from(cursor,'base64url').toString());}catch{insist(false,'invalid_cursor');}
      insist(Array.isArray(after)&&after.length===2&&Number.isSafeInteger(after[0])&&after[0]>=0&&typeof after[1]==='string'&&/^[a-f0-9]{32}$/.test(after[1]),'invalid_cursor');
    }
    const rows=await store.listOrders(uid,after,11),page=rows.slice(0,10),last=page.at(-1);
    const timestamp=value=>Number.isSafeInteger(value)&&value>=0?value:null;
    const items=page.filter(o=>o.uid===uid&&o.mode===mode).map(o=>({
      orderId:o.id,packageId:o.packageId,purpose:o.purpose==='voucher'?'voucher':'self',
      label:(o.purpose==='voucher'?'Voucher ':'')+(CATALOG[o.packageId]?.label||'Pakej MathDay'),
      amountCents:o.amountCents,currency:'MYR',
      state:o.state==='creating'&&now()-o.createdAt>60000?'create_uncertain':o.state,
      createdAt:timestamp(o.createdAt),paidAt:timestamp(o.paidAt)
    }));
    return {items,nextCursor:rows.length>10?Buffer.from(JSON.stringify([last.createdAt,last.id])).toString('base64url'):null};
  };
}
