import {PaymentError,insist,checkCallback} from './payment-policy.mjs';
export function createHandler({config,service,verifyToken}){
  const origins=new Set(config.allowedOrigins);
  return async request=>{
    const origin=request.headers.get('origin'),headers={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
    if(origin&&origins.has(origin))headers['Access-Control-Allow-Origin']=origin;
    const send=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
    try{
      if(request.method==='OPTIONS'){
        insist(origin&&origins.has(origin),'origin_not_allowed',403);
        return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type'}});
      }
      const op=new URL(request.url).searchParams.get('op');
      if(op==='callback'){
        insist(request.method==='POST','method_not_allowed',405);
        insist(request.headers.get('content-type')?.includes('application/x-www-form-urlencoded'),'invalid_content_type',415);
        const raw=await request.text();insist(raw.length<=8192,'payload_too_large',413);const params=new URLSearchParams(raw),body=Object.create(null);
        for(const [k,v]of params){insist(!Object.hasOwn(body,k),'duplicate_callback_field');body[k]=v;}
        checkCallback(body,config.secret);return send(await service.callback(body));
      }
      insist(!origin||origins.has(origin),'origin_not_allowed',403);
      insist(['create','status','cancel','vouchers','redeem','quote'].includes(op),'not_found',404);
      const auth=request.headers.get('authorization')||'';insist(auth.startsWith('Bearer ')&&auth.length<10000,'login_required',401);
      let user;try{user=await verifyToken(auth.slice(7));}catch{throw new PaymentError('login_required',401);}
      insist(user?.uid&&user.email_verified===true&&typeof user.email==='string','verified_email_required',403);
      if(op==='quote'){
        insist(request.method==='GET','method_not_allowed',405);const params=new URL(request.url).searchParams;
        return send(await service.quote(user,params.get('packageId'),params.get('purpose')||'self'));
      }
      if(op==='status'){insist(request.method==='GET','method_not_allowed',405);return send(await service.status(user.uid,new URL(request.url).searchParams.get('orderId')));}
      if(op==='vouchers'){insist(request.method==='GET','method_not_allowed',405);return send(await service.listVouchers(user.uid,new URL(request.url).searchParams.get('cursor')));}
      insist(request.method==='POST','method_not_allowed',405);insist(request.headers.get('content-type')?.includes('application/json'),'invalid_content_type',415);
      const raw=await request.text();insist(raw.length<=2048,'payload_too_large',413);let body;try{body=JSON.parse(raw);}catch{throw new PaymentError('invalid_json');}
      insist(body&&typeof body==='object'&&!Array.isArray(body),'invalid_json');
      if(op==='create'){
        insist(config.enabled,'payments_not_enabled',503);
        insist(Object.keys(body).every(k=>['packageId','requestId','phone','purpose'].includes(k)),'unexpected_field');
        return send(await service.create(user,body));
      }
      if(op==='redeem'){
        insist(Object.keys(body).every(k=>k==='code'),'unexpected_field');
        return send(await service.redeemVoucher(user.uid,body.code));
      }
      insist(Object.keys(body).every(k=>k==='orderId'),'unexpected_field');return send(await service.cancel(user.uid,body.orderId));
    }catch(error){return send({error:error instanceof PaymentError?error.code:'payment_service_unavailable',...(error instanceof PaymentError&&/^[a-f0-9]{32}$/.test(error.orderId||'')?{orderId:error.orderId}:{})},error instanceof PaymentError?error.status:503);}
  };
}
