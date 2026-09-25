import {insist,PaymentError} from './payment-policy.mjs';
export function createProvider(config,request=fetch){
  const base=config.mode==='live'?'https://toyyibpay.com':'https://dev.toyyibpay.com';
  async function post(action,body){
    let response;try{response=await request(`${base}/index.php/api/${action}`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(body),signal:AbortSignal.timeout(15000)});}catch{throw new PaymentError('provider_unavailable',502);}
    insist(response.ok,'provider_unavailable',502);const text=await response.text();
    try{return JSON.parse(text);}catch{throw new PaymentError('provider_rejected',502);}
  }
  return {
    base,
    async create(order,payer){
      const result=await post('createBill',{
        userSecretKey:config.secret,categoryCode:config.category,billName:((order.purpose==='voucher'?'MD Voucher ':'MathDay ')+order.packageId.replaceAll('-',' ')).slice(0,30),
        billDescription:`MathDay ${order.purpose==='voucher'?'voucher ':''}${order.packageId.replaceAll('-',' ')} ${order.id}`,
        billPriceSetting:'1',billPayorInfo:'1',billAmount:String(order.amountCents),
        billReturnUrl:`${config.appUrl}?payment_order=${order.id}`,billCallbackUrl:config.callbackUrl,
        billExternalReferenceNo:order.id,billTo:payer.name,billEmail:payer.email,billPhone:payer.phone,
        billPaymentChannel:'0',billChargeToCustomer:'',billSplitPayment:'0',billExpiryDays:'1'
      });
      insist(Array.isArray(result)&&result.length===1&&/^[a-zA-Z0-9]{6,32}$/.test(result[0]?.BillCode||''),'provider_rejected',502);
      return result[0].BillCode;
    },
    transactions:bill=>post('getBillTransactions',{billCode:bill}),
    async deactivate(bill){const result=await post('inactiveBill',{secretKey:config.secret,billCode:bill});return result?.status==='success'||(result?.status==='failed'&&result?.result==='Bill is inactive');},
    url:bill=>`${base}/${bill}`
  };
}
