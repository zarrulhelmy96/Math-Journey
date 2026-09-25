/* Public checkout UI. No gateway secret or Firebase Admin credential belongs in this file. */
(function(root){
  'use strict';
  const catalog=Object.freeze({
    'gold-30':{label:'Gold 30 Hari',price:30,benefit:'30 hari akses Gold.'},
    'gold-90-bonus':{label:'Gold 90 Hari + 30 Hari Percuma',price:90,benefit:'Jumlah 120 hari akses Gold.'},
    'gold-lifetime':{label:'Gold Lifetime',price:129,benefit:'Akses Lifetime dan extra 10 Reset Coin.'},
    'reset-10':{label:'10 Reset Coin',price:50,benefit:'10 Reset Coin ditambah ke akaun anda.'},
    'reset-20-bonus':{label:'20 Reset Coin + 5 Percuma',price:90,benefit:'Jumlah 25 Reset Coin ditambah ke akaun anda.'}
  });
  const errors={payments_not_enabled:'Pembayaran belum diaktifkan oleh admin.',payment_service_not_configured:'Tetapan pembayaran server belum lengkap.',payment_service_unavailable:'Server pembayaran belum dapat dihubungi. Cuba semak semula; jangan buat bayaran kedua.',login_required:'Sila log masuk semula.',verified_email_required:'Sahkan email sebelum membuat pembayaran.',invalid_phone:'Masukkan nombor telefon Malaysia yang sah.',wallet_not_ready:'Status akaun belum tersedia. Cuba buka profil semula.',already_lifetime:'Akaun anda sudah mempunyai Gold Lifetime.',daily_checkout_limit:'Had pesanan hari ini telah dicapai. Hubungi admin jika perlu.',checkout_too_fast:'Tunggu sebentar sebelum mencipta pesanan baharu.',bill_creation_uncertain:'Penciptaan bil belum dapat dipastikan. Hubungi admin dengan ID pesanan; jangan buat bayaran kedua.',provider_unavailable:'ToyyibPay belum dapat dihubungi. Cuba Semak Status nanti.',payment_pending_at_gateway:'Bayaran masih diproses di ToyyibPay. Tunggu sebelum membatalkan.',cannot_cancel_order:'Pesanan ini memerlukan semakan admin.',order_not_found:'Pesanan bukan milik akaun ini atau tidak dijumpai.',wrong_environment:'Pesanan ini menggunakan persekitaran pembayaran lain.'};
  function validCheckoutUrl(value){try{const u=new URL(value);return ['https://toyyibpay.com','https://dev.toyyibpay.com'].includes(u.origin)&&/^\/[A-Za-z0-9]{6,32}$/.test(u.pathname)&&!u.search&&!u.hash&&!u.username&&!u.password;}catch{return false;}}
  function create(options){
    const {auth,canCheckout,onPaid=()=>{},toast=()=>{},terms=()=>{}}=options,document=options.document||root.document,storage=options.storage||root.localStorage;
    const api=options.apiBase||'https://mathdays.netlify.app/.netlify/functions/payments',request=options.fetch||root.fetch.bind(root),navigate=options.navigate||(url=>root.location.assign(url));
    let selected='',owner='',busy=false,lastOrder=null,refreshing=false,lastRefresh=0,lastUser='',pollTimer=null,polls=0,generation=0;
    const key=uid=>`mathDayPaymentRequest:${uid}`,lastKey=uid=>`mathDayLastPayment:${uid}`,$=id=>document.getElementById(id);
    const overlay=document.createElement('div');overlay.id='secureCheckoutOverlay';overlay.className='announcement-overlay hidden';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-labelledby','secureCheckoutTitle');
    overlay.innerHTML='<div class="announcement-card"><h2 id="secureCheckoutTitle">Pembayaran MathDay</h2><p id="secureCheckoutPackage"></p><p id="secureCheckoutBenefit"></p><label for="secureCheckoutPhone" style="display:block;text-align:left;font-weight:800">Nombor telefon</label><input id="secureCheckoutPhone" type="tel" inputmode="tel" autocomplete="tel" maxlength="18" placeholder="Contoh: 0123456789" style="width:100%;margin:8px 0;padding:12px;border:2px solid #dfd3ff;border-radius:12px"><p style="font-size:12px;line-height:1.5">Nama, email dan nombor telefon dihantar ke ToyyibPay untuk pembayaran FPX. Bayaran sebenar akan dikenakan.</p><label style="display:flex;align-items:center;gap:8px;text-align:left;font-size:13px"><input type="checkbox" id="secureCheckoutAgree">Saya bersetuju dengan terma pembelian.</label><button type="button" id="secureCheckoutTerms" class="secondary">Lihat Terma</button><p id="secureCheckoutError" role="status" style="font-size:13px;color:#a52738"></p><div class="retry-actions"><button type="button" id="secureCheckoutCancel">Batal</button><button type="button" id="secureCheckoutPay">Terus ke ToyyibPay</button></div></div>';
    document.body.appendChild(overlay);
    $('secureCheckoutPay').className='primary';$('secureCheckoutCancel').className='secondary';
    document.addEventListener('keydown',event=>{
      if(overlay.classList.contains('hidden'))return;
      if(event.key==='Escape'&&!busy){event.preventDefault();overlay.classList.add('hidden');return;}
      if(event.key==='Tab'){
        const controls=[...overlay.querySelectorAll('button:not(:disabled),input:not(:disabled)')],first=controls[0],last=controls.at(-1);
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
      }
    });
    const panel=document.createElement('section');panel.id='securePaymentStatus';panel.hidden=true;panel.setAttribute('aria-label','Status pembayaran');panel.style.cssText='margin:16px 0;padding:16px;border:2px solid #dfd3ff;border-radius:16px;background:#faf8ff;text-align:left;overflow-wrap:anywhere';
    panel.innerHTML='<strong id="securePaymentState"></strong><p id="securePaymentDetail" style="font-size:13px;line-height:1.5"></p><small id="securePaymentOrderId" style="display:block;user-select:all"></small><div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px"><button type="button" id="securePaymentRefresh" class="secondary">Semak Status</button><button type="button" id="securePaymentResume" class="secondary" hidden>Sambung Bayaran</button><button type="button" id="securePaymentCancel" class="secondary" hidden>Batalkan Pesanan</button></div>';
    $('storeBalance').after(panel);
    async function call(op,body,user=auth.currentUser){
      if(!user||!user.emailVerified)throw Error('verified_email_required');const version=generation;
      const token=await user.getIdToken();if(auth.currentUser?.uid!==user.uid||version!==generation)throw Error('account_changed');
      const url=new URL(api);url.searchParams.set('op',op);if(op==='status'&&body?.orderId)url.searchParams.set('orderId',body.orderId);
      const response=await request(url.href,{method:op==='status'?'GET':'POST',headers:{Authorization:`Bearer ${token}`,...(op==='status'?{}:{'Content-Type':'application/json'})},body:op==='status'?undefined:JSON.stringify(body),signal:AbortSignal.timeout(25000)});
      if(auth.currentUser?.uid!==user.uid||version!==generation)throw Error('account_changed');
      const result=await response.json();if(!response.ok||result.error){if(/^[a-f0-9]{32}$/.test(result.orderId||''))storage.setItem(lastKey(user.uid),result.orderId);throw Error(result.error||'payment_service_unavailable');}return result;
    }
    function message(error){return errors[error?.message]||'Belum dapat menyemak bayaran. Cuba lagi apabila online; jangan buat bayaran kedua.';}
    function savedOrder(uid){try{return storage.getItem(lastKey(uid));}catch{return null;}}
    function remember(order,uid){lastUser=uid;if(order.orderId)storage.setItem(lastKey(uid),order.orderId);if(['paid','cancelled'].includes(order.state))storage.removeItem(key(uid));}
    function show(order){
      lastOrder=order;panel.hidden=order.state==='none';if(panel.hidden)return;
      const titles={paid:'Pembayaran disahkan ✓',pending:'Menunggu pembayaran',creating:'Sedang menyediakan bil',create_uncertain:'Bil memerlukan semakan admin',review:'Pembayaran memerlukan semakan admin',cancelled:'Pesanan dibatalkan'};
      $('securePaymentState').textContent=titles[order.state]||'Semakan pembayaran';
      $('securePaymentDetail').textContent=`${order.label||'Pakej MathDay'} · RM${(Number(order.amountCents)/100).toFixed(2)}. ${order.state==='paid'?'Pakej telah dimasukkan ke akaun Firebase anda.':order.state==='review'||order.state==='create_uncertain'?'Jangan bayar sekali lagi. Berikan ID pesanan ini kepada admin.':'Gold atau coin hanya ditambah selepas bayaran disahkan oleh server.'}`;
      $('securePaymentOrderId').textContent=`ID pesanan: ${order.orderId}`;
      $('securePaymentResume').hidden=!(order.state==='pending'&&validCheckoutUrl(order.checkoutUrl));$('securePaymentCancel').hidden=order.state!=='pending';
      if(order.state==='paid')onPaid();
    }
    async function refresh(manual=false){
      const user=auth.currentUser;if(!user?.emailVerified||refreshing||!options.sessionReady())return;
      if(!manual&&user.uid===lastUser&&Date.now()-lastRefresh<15000)return;
      refreshing=true;lastRefresh=Date.now();lastUser=user.uid;
      try{
        const queryId=new URL(root.location.href).searchParams.get('payment_order');
        const id=queryId&&/^[a-f0-9]{32}$/.test(queryId)?queryId:savedOrder(user.uid);
        const result=await call('status',{orderId:id},user);remember(result,user.uid);show(result);
        if(result.state==='pending'&&polls++<6){clearTimeout(pollTimer);pollTimer=setTimeout(()=>void refresh(true),10000);}
        if(['paid','cancelled'].includes(result.state)&&queryId){const clean=new URL(root.location.href);for(const k of ['payment_order','status_id','billcode','order_id'])clean.searchParams.delete(k);root.history.replaceState(null,'',clean.href);}
      }catch(error){if(error.message!=='account_changed'&&manual)toast(message(error));}
      finally{refreshing=false;}
    }
    function open(packageId){
      if(!Object.hasOwn(catalog,packageId))return false;
      if(!auth.currentUser?.emailVerified||!canCheckout()){toast('Log masuk dan tunggu status akaun disemak dahulu.');return true;}
      selected=packageId;owner=auth.currentUser.uid;const plan=catalog[packageId];
      $('secureCheckoutPackage').textContent=`${plan.label} · RM${plan.price}`;$('secureCheckoutBenefit').textContent=plan.benefit;
      $('secureCheckoutAgree').checked=false;$('secureCheckoutError').textContent='';overlay.classList.remove('hidden');$('secureCheckoutPhone').focus();return true;
    }
    $('secureCheckoutPay').onclick=async()=>{
      if(busy||!selected)return;const user=auth.currentUser;
      if(!user||user.uid!==owner||!canCheckout()){overlay.classList.add('hidden');return;}
      if(!$('secureCheckoutAgree').checked){$('secureCheckoutError').textContent='Sila setuju dengan terma pembelian dahulu.';return;}
      const phone=$('secureCheckoutPhone').value;if(!/^(?:\+?60|0)\d{8,10}$/.test(phone.replace(/[ ()-]/g,''))){$('secureCheckoutError').textContent=errors.invalid_phone;return;}
      busy=true;$('secureCheckoutPay').disabled=true;$('secureCheckoutCancel').disabled=true;$('secureCheckoutTerms').disabled=true;$('secureCheckoutError').textContent='Menyediakan bil pembayaran…';
      try{
        let saved;try{saved=JSON.parse(storage.getItem(key(user.uid))||'null');}catch{}
        if(!saved||saved.packageId!==selected){saved={packageId:selected,requestId:root.crypto.randomUUID()};storage.setItem(key(user.uid),JSON.stringify(saved));}
        const result=await call('create',{...saved,phone},user);remember(result,user.uid);show(result);
        overlay.classList.add('hidden');$('secureCheckoutPhone').value='';
        if(result.packageId===selected&&result.state==='pending'&&validCheckoutUrl(result.checkoutUrl))navigate(result.checkoutUrl);
        else toast('Sila semak pesanan sedia ada di bahagian Status Pembayaran.');
      }catch(error){if(error.message!=='account_changed'){$('secureCheckoutError').textContent=message(error);void refresh(true);}}
      finally{busy=false;$('secureCheckoutPay').disabled=false;$('secureCheckoutCancel').disabled=false;$('secureCheckoutTerms').disabled=false;}
    };
    $('secureCheckoutCancel').onclick=()=>overlay.classList.add('hidden');$('secureCheckoutTerms').onclick=()=>{overlay.classList.add('hidden');terms();};
    $('securePaymentRefresh').onclick=()=>void refresh(true);
    $('securePaymentResume').onclick=()=>{if(lastOrder?.state==='pending'&&validCheckoutUrl(lastOrder.checkoutUrl)&&auth.currentUser?.uid===lastUser)navigate(lastOrder.checkoutUrl);};
    $('securePaymentCancel').onclick=async()=>{
      if(busy||!lastOrder?.orderId)return;if(!root.confirm('Batalkan pesanan ini? Jangan batalkan jika bank sedang memproses bayaran.'))return;
      busy=true;try{const user=auth.currentUser,result=await call('cancel',{orderId:lastOrder.orderId},user);remember(result,user.uid);show(result);}catch(error){toast(message(error));}finally{busy=false;}
    };
    options.onAuthChanged(()=>{generation++;clearTimeout(pollTimer);polls=0;lastUser='';lastRefresh=0;lastOrder=null;panel.hidden=true;selected='';owner='';overlay.classList.add('hidden');$('secureCheckoutPhone').value='';});
    root.addEventListener?.('online',()=>void refresh());root.addEventListener?.('focus',()=>void refresh());
    return {refresh,handleClick(event,target){
      const id=target.hasAttribute('data-unlimited-lifetime')?'gold-lifetime':target.dataset.extraPackage;
      if(!Object.hasOwn(catalog,id))return false;event.preventDefault();event.stopImmediatePropagation();open(id);return true;
    }};
  }
  root.MathDayPayments={catalog,validCheckoutUrl,create};
})(globalThis);
