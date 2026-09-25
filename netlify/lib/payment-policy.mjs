import {createHash,timingSafeEqual} from 'node:crypto';
export const CATALOG=Object.freeze({
  'gold-30':Object.freeze({label:'Gold 30 Hari',amountCents:3000,days:30,coins:0}),
  'gold-90-bonus':Object.freeze({label:'Gold 90 Hari dan 30 Percuma',amountCents:9000,days:120,coins:0}),
  'gold-lifetime':Object.freeze({label:'Gold Lifetime',amountCents:12900,lifetime:true,coins:10}),
  'reset-10':Object.freeze({label:'10 Reset Coin',amountCents:5000,coins:10}),
  'reset-20-bonus':Object.freeze({label:'20 Reset Coin dan 5 Percuma',amountCents:9000,coins:25})
});
export class PaymentError extends Error{constructor(code,status=400){super(code);this.code=code;this.status=status;}}
export function insist(condition,code,status=400){if(!condition)throw new PaymentError(code,status);}
export const digest=value=>createHash('sha256').update(value).digest('hex');
export function orderId(uid,key){insist(typeof key==='string'&&/^[a-f0-9-]{36}$/i.test(key),'invalid_request_id');return digest(`${uid}:${key}`).slice(0,32);}
export function cents(value){
  const m=String(value).match(/^(0|[1-9]\d{0,8})(?:\.(\d{1,2}))?$/);
  insist(m,'invalid_amount');return Number(m[1])*100+Number((m[2]||'').padEnd(2,'0'));
}
export function checkCallback(body,secret){
  for(const field of ['status','order_id','refno','billcode','hash'])insist(typeof body[field]==='string'&&body[field].length>0&&body[field].length<=200,'invalid_callback');
  insist(/^[a-f0-9]{32}$/.test(body.order_id)&&/^[a-zA-Z0-9]{6,32}$/.test(body.billcode)&&/^[123]$/.test(body.status),'invalid_callback');
  insist(/^[a-f0-9]{32}$/i.test(body.hash),'invalid_signature',401);
  const expected=createHash('md5').update(secret+body.status+body.order_id+body.refno+'ok').digest();
  insist(timingSafeEqual(expected,Buffer.from(body.hash,'hex')),'invalid_signature',401);
}
export function verifiedPayment(order,rows){
  insist(Array.isArray(rows),'provider_unavailable',502);
  const paid=rows.filter(row=>String(row.billpaymentStatus)==='1');
  if(!paid.length)return null;
  // Multiple successful payments on the same bill need review, never multiple grants.
  insist(paid.length===1,'multiple_payments',409);
  const row=paid[0];
  insist(row.billExternalReferenceNo===order.id,'reference_mismatch',409);
  insist(cents(row.billpaymentAmount)===order.amountCents,'amount_mismatch',409);
  insist(typeof row.billpaymentInvoiceNo==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(row.billpaymentInvoiceNo),'invalid_invoice',409);
  return {invoiceId:row.billpaymentInvoiceNo,amountCents:order.amountCents};
}
export function validWallet(w){
  return w&&w.schema===1&&['normal','timed','lifetime'].includes(w.goldPlan)&&Number.isSafeInteger(w.goldUntil)&&w.goldUntil>=0
    &&(w.goldPlan==='timed'?w.goldUntil>0:w.goldUntil===0)
    &&Number.isSafeInteger(w.resetCoins)&&w.resetCoins>=0&&w.resetCoins<=1000000&&Number.isSafeInteger(w.revision)&&w.revision>=0
    &&w.pending&&typeof w.pending==='object'&&!Array.isArray(w.pending)&&typeof w.lastQuestion==='string';
}
export function grant(wallet,plan,now){
  insist(validWallet(wallet),'wallet_requires_review',409);
  insist(!(wallet.goldPlan==='lifetime'&&(plan.lifetime||plan.days)),'already_lifetime',409);
  const next={...wallet,pending:{...wallet.pending},revision:wallet.revision+1,resetCoins:wallet.resetCoins+plan.coins};
  if(plan.lifetime){next.goldPlan='lifetime';next.goldUntil=0;}
  else if(plan.days){next.goldPlan='timed';next.goldUntil=Math.max(now,wallet.goldPlan==='timed'?wallet.goldUntil:0)+plan.days*86400000;}
  insist(validWallet(next),'wallet_limit',409);return next;
}
