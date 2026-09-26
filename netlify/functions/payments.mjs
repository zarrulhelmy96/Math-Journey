import {initializeApp,cert,getApps} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore,FieldPath} from 'firebase-admin/firestore';
import {createProvider} from '../lib/toyyibpay.mjs';
import {createPaymentService} from '../lib/payment-service.mjs';
import {createHandler} from '../lib/payment-http.mjs';
import {PaymentError} from '../lib/payment-policy.mjs';
let handler;
function initialize(){
  const env=process.env,mode=env.TOYYIBPAY_MODE,site=new URL(env.PAYMENT_SITE_URL||'https://mathdays.netlify.app');
  if(!['live','sandbox'].includes(mode)||site.protocol!=='https:'||site.username||site.password||site.search||site.hash||site.pathname!=='/')throw Error('Invalid payment configuration');
  for(const key of ['TOYYIBPAY_SECRET_KEY','TOYYIBPAY_CATEGORY_CODE','FIREBASE_PROJECT_ID','FIREBASE_CLIENT_EMAIL','FIREBASE_PRIVATE_KEY'])if(!env[key])throw Error('Missing payment configuration');
  if(mode==='sandbox'&&env.FIREBASE_PROJECT_ID==='mathday-e808f')throw Error('Sandbox payments require a separate Firebase project');
  const app=getApps().find(a=>a.name==='mathday-payments')||initializeApp({credential:cert({projectId:env.FIREBASE_PROJECT_ID,clientEmail:env.FIREBASE_CLIENT_EMAIL,privateKey:env.FIREBASE_PRIVATE_KEY.replace(/\\n/g,'\n')})},'mathday-payments');
  const db=getFirestore(app),store={
    async get(path){const snapshot=await db.doc(path).get();return snapshot.exists?snapshot.data():null;},
    async listOrders(uid,after,limit){
      let query=db.collection('paymentOrders').where('uid','==',uid).orderBy('createdAt','desc').orderBy(FieldPath.documentId(),'desc');
      if(after)query=query.startAfter(...after);
      try{return (await query.limit(limit).get()).docs.map(doc=>({...doc.data(),id:doc.id}));}
      catch(error){if(error.code===9&&/index/i.test(error.message||''))throw new PaymentError('purchase_history_index_required',503);throw error;}
    },
    async listVouchers(uid,after,limit){
      let query=db.collection(`voucherAccounts/${uid}/items`).orderBy('issuedAt','desc').orderBy(FieldPath.documentId(),'desc');
      if(after)query=query.startAfter(...after);
      return (await query.limit(limit).get()).docs.map(doc=>doc.data());
    },
    transaction:fn=>db.runTransaction(async transaction=>fn({
      get:async path=>{const snapshot=await transaction.get(db.doc(path));return snapshot.exists?snapshot.data():null;},
      goldHistory:async uid=>{
        const orders=await transaction.get(db.collection('paymentOrders').where('uid','==',uid));
        const vouchers=await transaction.get(db.collection('paymentVouchers').where('redeemedBy','==',uid));
        return [
          ...orders.docs.map(doc=>doc.data()).filter(o=>o.state==='paid'&&o.purpose!=='voucher').map(o=>({mode:o.mode,packageId:o.packageId,at:o.fulfilledAt||o.paidAt})),
          ...vouchers.docs.map(doc=>doc.data()).filter(v=>v.state==='redeemed').map(v=>({mode:v.mode,packageId:v.packageId,at:v.redeemedAt}))
        ];
      },
      set:(path,data)=>transaction.set(db.doc(path),data)
    }))
  };
  const config={mode,enabled:env.PAYMENTS_ENABLED==='true',secret:env.TOYYIBPAY_SECRET_KEY,category:env.TOYYIBPAY_CATEGORY_CODE,appUrl:site.origin+'/index.html',callbackUrl:site.origin+'/.netlify/functions/payments?op=callback',allowedOrigins:[site.origin,...(env.PAYMENT_ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean)]};
  const provider=createProvider(config),service=createPaymentService({store,provider,mode,testPriceEnabled:(env.GOLD30_TEST_PRICE_ENABLED||'true')==='true'});
  return createHandler({config,service,verifyToken:token=>getAuth(app).verifyIdToken(token,true)});
}
export default async request=>{
  try{handler??=initialize();return await handler(request);}
  catch{return new Response(JSON.stringify({error:'payment_service_not_configured'}),{status:503,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});}
};
