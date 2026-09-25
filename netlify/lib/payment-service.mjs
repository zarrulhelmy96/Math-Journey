import {CATALOG,insist,orderId,digest,grant,validWallet,verifiedPayment,PaymentError} from './payment-policy.mjs';
export function createPaymentService({store,provider,mode,now=Date.now}){
  const path=id=>`paymentOrders/${id}`;
  const publicOrder=o=>({orderId:o.id,packageId:o.packageId,label:CATALOG[o.packageId]?.label,amountCents:o.amountCents,state:o.state==='creating'&&now()-o.createdAt>60000?'create_uncertain':o.state,reviewReason:o.reviewReason||null,checkoutUrl:o.state==='pending'&&o.billCode?provider.url(o.billCode):null});
  async function owned(uid,id){insist(/^[a-f0-9]{32}$/.test(id||''),'invalid_order');const order=await store.get(path(id));insist(order&&order.uid===uid,'order_not_found',404);insist(order.mode===mode,'wrong_environment',409);return order;}
  async function review(id,reason){await store.transaction(async tx=>{const o=await tx.get(path(id));if(!o||o.state==='paid')return;tx.set(path(id),{...o,state:'review',reviewReason:reason,updatedAt:now()});});}
  async function fulfill(id,payment){
    return store.transaction(async tx=>{
      const o=await tx.get(path(id));insist(o&&o.mode===mode,'order_not_found',404);
      if(o.state==='paid')return o;
      insist(['pending','cancelled'].includes(o.state),'order_requires_review',409);
      const plan=CATALOG[o.packageId];insist(plan&&o.catalogVersion===1&&o.amountCents===plan.amountCents,'catalog_requires_review',409);
      const receiptPath=`paymentReceipts/${digest(`${mode}:${payment.invoiceId}`)}`,receipt=await tx.get(receiptPath);
      const walletPath=`accountWallets/${o.uid}`,wallet=await tx.get(walletPath),lockPath=`paymentLocks/${o.uid}`,lock=await tx.get(lockPath);
      insist(!receipt,'invoice_already_used',409);
      const timestamp=now(),next=grant(wallet,plan,timestamp);
      const paid={...o,state:'paid',invoiceId:payment.invoiceId,paidAt:timestamp,fulfilledAt:timestamp,updatedAt:timestamp};
      tx.set(walletPath,next);tx.set(path(id),paid);tx.set(receiptPath,{orderId:id,uid:o.uid,amountCents:o.amountCents,invoiceId:payment.invoiceId,mode,createdAt:timestamp});
      if(lock?.orderId===id)tx.set(lockPath,{orderId:null});
      return paid;
    });
  }
  async function reconcile(order,force=false){
    if(['paid','review','creating','create_uncertain','create_failed'].includes(order.state)||!order.billCode)return order;
    if(!force){
      const lease=await store.transaction(async tx=>{const current=await tx.get(path(order.id));if(current.state==='paid'||current.state==='review'||current.lastCheckAt&&now()-current.lastCheckAt<8000)return {skip:true,order:current};const next={...current,lastCheckAt:now()};tx.set(path(order.id),next);return {skip:false,order:next};});
      order=lease.order;if(lease.skip)return order;
    }
    try{
      const payment=verifiedPayment(order,await provider.transactions(order.billCode));
      if(!payment)return order;
      const paid=await fulfill(order.id,payment);
      // Reduce accidental repeat payments on a bill that has already been fulfilled.
      // Failure to deactivate must never undo a committed wallet grant.
      try{await provider.deactivate(order.billCode);}catch{}
      return paid;
    }catch(error){
      if(error instanceof PaymentError&&error.status===409){await review(order.id,error.code);return await store.get(path(order.id));}
      throw error;
    }
  }
  return {
    publicOrder,
    async create(user,input){
      insist(typeof input.packageId==='string'&&Object.hasOwn(CATALOG,input.packageId),'invalid_package');const plan=CATALOG[input.packageId];
      const phone=String(input.phone||'').replace(/[ +()-]/g,'');insist(/^(60\d{8,10}|0\d{8,10})$/.test(phone),'invalid_phone');
      const id=orderId(user.uid,input.requestId),created=await store.transaction(async tx=>{
        const existing=await tx.get(path(id));
        if(existing){insist(existing.uid===user.uid&&existing.packageId===input.packageId&&existing.mode===mode,'request_conflict',409);return {fresh:false,order:existing};}
        const wallet=await tx.get(`accountWallets/${user.uid}`),lock=await tx.get(`paymentLocks/${user.uid}`),limit=await tx.get(`paymentLimits/${user.uid}`);
        const active=lock?.orderId?await tx.get(path(lock.orderId)):null;
        if(active&&!['paid','cancelled','create_failed'].includes(active.state))return {fresh:false,order:active,active:true};
        insist(validWallet(wallet),'wallet_not_ready',409);insist(!(wallet.goldPlan==='lifetime'&&(plan.days||plan.lifetime)),'already_lifetime',409);
        const timestamp=now(),sameDay=limit&&timestamp-limit.startedAt<86400000;
        insist(!sameDay||limit.count<10,'daily_checkout_limit',429);insist(!limit||timestamp-limit.lastAt>=10000,'checkout_too_fast',429);
        const order={id,uid:user.uid,packageId:input.packageId,catalogVersion:1,amountCents:plan.amountCents,currency:'MYR',mode,state:'creating',billCode:null,createdAt:timestamp,updatedAt:timestamp};
        tx.set(path(id),order);tx.set(`paymentLocks/${user.uid}`,{orderId:id});tx.set(`paymentLimits/${user.uid}`,{startedAt:sameDay?limit.startedAt:timestamp,lastAt:timestamp,count:sameDay?limit.count+1:1});
        return {fresh:true,order};
      });
      if(!created.fresh){const checked=await reconcile(created.order);return {...publicOrder(checked),existingOrder:true};}
      let bill;
      try{bill=await provider.create(created.order,{name:String(user.name||'MathDay Member').replace(/[\r\n\x00-\x1f]/g,' ').slice(0,100),email:user.email,phone});}
      catch{
        // A timeout can mean the provider created a bill. Never automatically create another for this order.
        await store.transaction(async tx=>{const o=await tx.get(path(id));if(o?.state==='creating')tx.set(path(id),{...o,state:'create_uncertain',updatedAt:now()});});
        const error=new PaymentError('bill_creation_uncertain',503);error.orderId=id;throw error;
      }
      const ready=await store.transaction(async tx=>{const o=await tx.get(path(id));insist(o?.state==='creating','order_requires_review',409);const next={...o,billCode:bill,state:'pending',updatedAt:now()};tx.set(path(id),next);return next;});
      return publicOrder(ready);
    },
    async status(uid,id){
      if(!id){const lock=await store.get(`paymentLocks/${uid}`);if(!lock?.orderId)return {state:'none'};id=lock.orderId;}
      return publicOrder(await reconcile(await owned(uid,id)));
    },
    async callback(body){
      const o=await store.get(path(body.order_id));insist(o&&o.mode===mode,'order_not_found',404);
      insist(o.billCode,'bill_not_ready',503);insist(o.billCode===body.billcode,'bill_mismatch',409);
      // Signed callback is a trigger, not the source of truth. Verify the bill with the provider even on failure/pending notifications.
      const result=await reconcile(o,true);return {received:true,state:result.state};
    },
    async cancel(uid,id){
      const before=await reconcile(await owned(uid,id),true);if(before.state==='paid')return publicOrder(before);
      insist(before.state==='pending'&&before.billCode,'cannot_cancel_order',409);
      insist(await provider.deactivate(before.billCode),'payment_pending_at_gateway',409);
      // A success just before deactivation must still be credited, not discarded.
      const checked=await reconcile(await owned(uid,id),true);if(checked.state==='paid')return publicOrder(checked);
      insist(checked.state==='pending','order_requires_review',409);
      const cancelled=await store.transaction(async tx=>{const o=await tx.get(path(id)),lock=await tx.get(`paymentLocks/${uid}`);if(o.state==='paid')return o;insist(o.state==='pending','cannot_cancel_order',409);const next={...o,state:'cancelled',updatedAt:now()};tx.set(path(id),next);if(lock?.orderId===id)tx.set(`paymentLocks/${uid}`,{orderId:null});return next;});
      return publicOrder(cancelled);
    }
  };
}
