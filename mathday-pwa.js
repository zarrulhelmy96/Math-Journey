(() => {
  'use strict';
  if (!window.isSecureContext || !['https:', 'http:'].includes(location.protocol)) return;
  const scriptUrl = document.currentScript?.src || new URL('./mathday-pwa.js', location.href).href;
  const base = new URL('./', scriptUrl);
  let installPrompt = null, installed = false, registration = null, updateDismissed = false;
  const standalone = () => installed || matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const installButtons = [];
  function refreshInstall() {
    document.querySelectorAll('[data-mathday-install]').forEach(el => {el.hidden = standalone();});
  }
  addEventListener('beforeinstallprompt', event => {event.preventDefault();installPrompt = event;refreshInstall();});
  addEventListener('appinstalled', () => {installed = true;installPrompt = null;refreshInstall();});
  matchMedia('(display-mode: standalone)').addEventListener?.('change', refreshInstall);

  function initialize() {
    const dialog = document.createElement('dialog');
    dialog.className = 'mathday-pwa-dialog';
    dialog.id = 'mathdayInstallHelp';
    dialog.setAttribute('aria-labelledby', 'mathdayInstallHelpTitle');
    dialog.innerHTML = '<h2 id="mathdayInstallHelpTitle">Pasang MathDay</h2><div id="mathdayInstallSteps"></div><small>Pasang daripada browser biasa, bukan browser dalam aplikasi lain. MathDay masih memerlukan internet untuk akaun, kuiz dan pembayaran. Pemasangan aplikasi adalah percuma.</small><button class="mathday-install-button" type="button">Faham</button>';
    document.body.append(dialog);
    dialog.querySelector('button').addEventListener('click', () => dialog.close());
    async function install() {
      if (standalone()) return;
      if (installPrompt) {
        const pending = installPrompt;
        installPrompt = null;
        installButtons.forEach(button => {button.disabled = true;});
        try {await pending.prompt();await pending.userChoice;}
        catch {showHelp();}
        finally {installButtons.forEach(button => {button.disabled = false;});}
      } else showHelp();
    }
    function showHelp() {
      dialog.querySelector('#mathdayInstallSteps').innerHTML = ios
        ? '<p>Pada iPhone atau iPad:</p><ol><li>Buka MathDay dalam <strong>Safari</strong>.</li><li>Tekan <strong>Share / Kongsi</strong>.</li><li>Pilih <strong>Add to Home Screen / Tambah ke Skrin Utama</strong>.</li><li>Jika ada, hidupkan <strong>Open as Web App</strong>, kemudian tekan <strong>Add / Tambah</strong>.</li></ol>'
        : '<p>Jika tetingkap pemasangan belum tersedia:</p><ol><li>Buka MathDay dalam <strong>Chrome atau Edge</strong>.</li><li>Buka menu browser <strong>⋮ / …</strong>.</li><li>Pilih <strong>Install app / Pasang aplikasi</strong> atau <strong>Add to Home screen</strong>, jika tersedia.</li></ol><p>Nama menu mungkin berbeza mengikut peranti dan browser.</p>';
      if (!dialog.open) dialog.showModal();
    }
    const profile = document.querySelector('#profileScreen .profile-actions');
    if (profile) {
      const card = document.createElement('aside');
      card.className = 'mathday-install-card';
      card.dataset.mathdayInstall = '';
      card.innerHTML = '<img alt="" width="48" height="48"><div><h3>MathDay, satu sentuhan sahaja.</h3><p>Tambah ke skrin utama telefon untuk akses lebih mudah.</p><button type="button" class="mathday-install-button">Pasang MathDay</button></div>';
      card.querySelector('img').src = new URL('pwa-icons/icon-192.png', base).href;
      const button = card.querySelector('button');button.addEventListener('click', install);installButtons.push(button);
      profile.after(card);
    }
    const login = document.getElementById('loginScreen');
    if (login) {
      const button = document.createElement('button');
      button.type = 'button';button.textContent = 'Pasang MathDay';button.className = 'mathday-install-button mathday-login-install';button.dataset.mathdayInstall = '';
      button.addEventListener('click', install);installButtons.push(button);login.append(button);
    }
    refreshInstall();
    const notices = document.createElement('div');
    notices.className = 'mathday-pwa-notices';
    notices.innerHTML = '<div class="mathday-pwa-notice mathday-pwa-offline" id="mathdayOfflineNotice" role="status" hidden>Sambungan internet terputus. Sambung semula untuk menyelaraskan akaun, Gold dan pembayaran.</div><div class="mathday-pwa-notice" id="mathdayUpdateNotice" role="status" hidden><p>Versi baharu MathDay tersedia. Selesaikan soalan atau pembayaran dahulu sebelum memuat semula.</p><button type="button" class="mathday-install-button" id="mathdayApplyUpdate">Muat semula</button><button type="button" class="mathday-pwa-later" id="mathdayLaterUpdate">Nanti</button></div>';
    document.body.append(notices);
    const offline = notices.querySelector('#mathdayOfflineNotice'), update = notices.querySelector('#mathdayUpdateNotice');
    function refreshConnection() {offline.hidden = navigator.onLine;}
    refreshConnection();addEventListener('online', refreshConnection);addEventListener('offline', refreshConnection);
    function showUpdate() {if (registration?.waiting && !updateDismissed) update.hidden = false;}
    notices.querySelector('#mathdayLaterUpdate').addEventListener('click', () => {updateDismissed = true;update.hidden = true;});
    let reloadOnChange = false, activationTimer = null;
    function cancelUpdateWait(){reloadOnChange=false;clearTimeout(activationTimer);notices.querySelector('#mathdayApplyUpdate').disabled=false;}
    addEventListener('mathday:update-cancel',cancelUpdateWait);
    notices.querySelector('#mathdayApplyUpdate').addEventListener('click', () => {
      if (!navigator.onLine) return;
      if (!confirm('Muat semula MathDay sekarang? Selesaikan soalan atau pembayaran yang sedang dibuat dahulu.')) return;
      window.MathDayUpdateLoader?.start();
      notices.querySelector('#mathdayApplyUpdate').disabled=true;
      if (registration?.waiting) {
        reloadOnChange = true;
        activationTimer=setTimeout(()=>{cancelUpdateWait();window.MathDayUpdateLoader?.fail('Kemas kini belum dapat diaktifkan. Semak internet dan tekan Cuba semula, atau Tutup untuk kembali.');},20000);
        try{registration.waiting.postMessage({type:'MATHDAY_ACTIVATE_UPDATE'});}catch{cancelUpdateWait();window.MathDayUpdateLoader?.fail();}
      }
      else requestAnimationFrame(()=>location.reload());
    });
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.addEventListener('controllerchange', () => {if (reloadOnChange) {cancelUpdateWait();location.reload();}});
    navigator.serviceWorker.register(new URL('sw.js', base).href, {scope:base.pathname,updateViaCache:'none'}).then(reg => {
      registration = reg;showUpdate();
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        worker?.addEventListener('statechange', () => {if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdate();});
      });
      let checkedAt = Date.now();
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && navigator.onLine && Date.now() - checkedAt > 60000) {checkedAt = Date.now();reg.update().catch(() => {});}
      });
    }).catch(() => { /* Keep the existing online site usable if browser policy blocks PWA. */ });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, {once:true});
  else initialize();
})();
