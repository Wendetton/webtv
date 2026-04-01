// public/tv-ducking.js — TTS nativo Android + Fully Kiosk + Web TTS + Beep
// Com callback real do TTS Android e indicador de conectividade
(function(){
  function getCfg(){
    const d = (typeof window !== 'undefined' && window.tvConfig) || {};
    return {
      mode: d.announceMode || 'auto',
      template: d.announceTemplate || 'Atenção: paciente {{nome}}. Dirija-se à sala {{salaTxt}}.',
      duck: Number.isFinite(d.duckVolume) ? d.duckVolume : 20,
      restore: Number.isFinite(d.restoreVolume) ? d.restoreVolume : 60,
      lead: Number.isFinite(d.leadMs) ? d.leadMs : 450
    };
  }

  function getYTPlayer() { return window.tvYTPlayer || null; }

  function duckStart(){
    const {duck} = getCfg();
    try { const p = getYTPlayer(); if (p) p.setVolume(duck); } catch {}
  }

  function duckEnd(){
    const {restore} = getCfg();
    setTimeout(() => {
      try { const p = getYTPlayer(); if (p) p.setVolume(restore); } catch {}
    }, 120);
  }

  // Expor duckEnd globalmente para o callback do APK
  window.tvDuckEnd = duckEnd;

  // Callback chamado pelo APK quando o TTS termina de falar
  // Resolve a promise pendente se houver, senão faz duckEnd direto
  var _ttsDoneResolve = null;
  window.tvTTSDone = function(){
    if (_ttsDoneResolve) {
      var r = _ttsDoneResolve;
      _ttsDoneResolve = null;
      r();
    }
    duckEnd();
  };

  function fmt(name, sala){
    const { template } = getCfg();
    const salaTxt = sala ? 'número ' + sala : '';
    return template
      .replace('{{nome}}', name || '')
      .replace('{{sala}}', sala || '')
      .replace('{{salaTxt}}', salaTxt);
  }

  // 1. TTS nativo Android (app OftalmoCenterTV) — com callback real
  function androidTTS(text) {
    try {
      if (typeof window.AndroidTTS !== 'undefined' &&
          typeof window.AndroidTTS.speak === 'function') {
        // Cria promise que será resolvida pelo callback tvTTSDone do APK
        var p = new Promise(function(resolve) {
          _ttsDoneResolve = resolve;
          // Fallback: se callback não chegar em 10s, resolve mesmo assim
          setTimeout(function() {
            if (_ttsDoneResolve === resolve) {
              _ttsDoneResolve = null;
              resolve();
            }
          }, 10000);
        });
        window.AndroidTTS.speak(text);
        p.then(function() { duckEnd(); });
        return true;
      }
    } catch {}
    return false;
  }

  // 2. Fully Kiosk TTS
  function fullyTTS(text){
    try {
      if (typeof fully !== 'undefined' && typeof fully.textToSpeech === 'function') {
        fully.textToSpeech(text, 'pt_BR');
        var est = Math.max(2000, text.length * 60);
        setTimeout(duckEnd, est);
        return true;
      }
    } catch {}
    return false;
  }

  // 3. Web Speech API
  function webTTS(text, onFail){
    try {
      if (!('speechSynthesis' in window)) { onFail && onFail(); return false; }
      window.speechSynthesis.cancel();
      function doSpeak() {
        var voices = window.speechSynthesis.getVoices();
        var u = new SpeechSynthesisUtterance(text);
        u.rate = 1.0; u.pitch = 1.0; u.volume = 1.0;
        var ptVoice = voices.find(function(v){ return v.lang.startsWith('pt'); }) || voices[0] || null;
        if (ptVoice) u.voice = ptVoice;
        u.lang = ptVoice ? ptVoice.lang : 'pt-BR';
        var ended = false;
        var timeout = setTimeout(function() {
          if (!ended) { ended = true; window.speechSynthesis.cancel(); onFail && onFail(); }
        }, 8000);
        u.onend = function() { if (!ended) { ended = true; clearTimeout(timeout); duckEnd(); } };
        u.onerror = function() { if (!ended) { ended = true; clearTimeout(timeout); onFail && onFail(); } };
        window.speechSynthesis.speak(u);
        var ri = setInterval(function() {
          if (ended) { clearInterval(ri); return; }
          if (window.speechSynthesis.paused) window.speechSynthesis.resume();
        }, 500);
        setTimeout(function(){ clearInterval(ri); }, 10000);
      }
      var voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) { doSpeak(); }
      else {
        window.speechSynthesis.onvoiceschanged = function() {
          window.speechSynthesis.onvoiceschanged = null; doSpeak();
        };
        setTimeout(function() { window.speechSynthesis.onvoiceschanged = null; doSpeak(); }, 2000);
      }
      return true;
    } catch { onFail && onFail(); return false; }
  }

  // 4. Beep (fallback universal)
  function beep(){
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      var ctx = new Ctx();
      var play = function(tone, ms, when) {
        var o = ctx.createOscillator();
        var g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = tone;
        g.gain.setValueAtTime(0.001, ctx.currentTime + when);
        g.gain.linearRampToValueAtTime(0.35, ctx.currentTime + when + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + when + ms / 1000);
        o.connect(g); g.connect(ctx.destination);
        o.start(ctx.currentTime + when);
        o.stop(ctx.currentTime + when + ms / 1000);
      };
      play(523, 200, 0.00);
      play(659, 200, 0.25);
      play(784, 300, 0.50);
      setTimeout(duckEnd, 1200);
      return true;
    } catch { return false; }
  }

  window.tvAnnounce = function(name, sala){
    if (!name) return;
    var cfg = getCfg();
    var lead = cfg.lead;
    duckStart();
    setTimeout(function() {
      var text = fmt(name, sala);
      if (cfg.mode === 'fully') {
        if (!fullyTTS(text)) beep();
      } else if (cfg.mode === 'web') {
        webTTS(text, function(){ beep(); });
      } else if (cfg.mode === 'beep') {
        beep();
      } else {
        // auto: Android nativo → Fully → Web TTS → Beep
        if (!androidTTS(text) && !fullyTTS(text)) {
          webTTS(text, function(){ beep(); });
        }
      }
    }, Math.max(0, Number(lead) || 0));
  };

  // === Indicador de conectividade (chamado pelo APK via evaluateJavascript) ===
  window.tvSetOffline = function(offline) {
    var el = document.getElementById('tv-offline-indicator');
    if (offline) {
      if (!el) {
        el = document.createElement('div');
        el.id = 'tv-offline-indicator';
        el.style.cssText = 'position:fixed;top:12px;right:12px;z-index:9999;' +
          'background:rgba(239,68,68,0.9);color:#fff;padding:6px 14px;' +
          'border-radius:20px;font-size:13px;font-weight:700;' +
          'font-family:system-ui,sans-serif;pointer-events:none;' +
          'display:flex;align-items:center;gap:6px;' +
          'animation:tvOfflinePulse 2s infinite;';
        el.innerHTML = '<span style="width:8px;height:8px;background:#fff;border-radius:50%;display:inline-block"></span> Reconectando...';
        // Adiciona animação
        var style = document.createElement('style');
        style.textContent = '@keyframes tvOfflinePulse{0%,100%{opacity:1}50%{opacity:0.5}}';
        document.head.appendChild(style);
        document.body.appendChild(el);
      }
      el.style.display = 'flex';
      window.tvNeedsReload = true;
    } else {
      if (el) el.style.display = 'none';
      window.tvNeedsReload = false;
    }
  };

})();
