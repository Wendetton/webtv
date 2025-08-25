// Anúncio com volume ajustável + ducking do YouTube, com suporte correto ao Fully (stream 9 = TTS).
// Requer no Fully: Settings → (Advanced) → Enable JavaScript Interface (JS API ligada).
(function(){
  function cfg(){
    const d = (typeof window !== 'undefined' && window.tvConfig) || {};
    return {
      mode: (d.announceMode || 'auto'),                 // 'auto' | 'fully' | 'web' | 'beep'
      template: d.announceTemplate || 'Atenção: paciente {{nome}}. Dirija-se à sala {{salaTxt}}.',
      duck: Number.isFinite(d.duckVolume) ? d.duckVolume : 20,
      restore: Number.isFinite(d.restoreVolume) ? d.restoreVolume : 60,
      lead: Number.isFinite(d.leadMs) ? d.leadMs : 450,
      vol:  Number.isFinite(d.announceVolume) ? Math.max(0, Math.min(100, d.announceVolume)) : 90
    };
  }

  // ==== YOUTUBE DUCKING =======================================================
  var ytRef = null;
  function ensureYT(){
    try{
      if (ytRef && ytRef.getVolume) return ytRef;
      if (!window.YT || !window.YT.Player) return null;
      ytRef = new YT.Player('yt-player', {}); // pega o iframe existente
    }catch(e){}
    return ytRef;
  }
  function duckStart(){
    try{ ensureYT(); var v = cfg().duck; if (ytRef && ytRef.setVolume){ ytRef.setVolume(v); ytRef.unMute?.(); } }catch(e){}
  }
  function duckEnd(){
    setTimeout(function(){
      try{ var v = cfg().restore; if (ytRef && ytRef.setVolume){ ytRef.setVolume(v); } }catch(e){}
    }, 120);
  }

  // ==== TEMPLATE ==============================================================
  function fmt(name, sala){
    var t = cfg().template;
    var sTxt = sala ? ('número ' + sala) : '';
    return String(t).replace('{{nome}}', name||'').replace('{{sala}}', sala||'').replace('{{salaTxt}}', sTxt);
  }

  // ==== FULLY TTS COM CONTROLE DE VOLUME (stream 9 = TTS) =====================
  function fullyAvailable(){ return (typeof window !== 'undefined' && typeof window.fully !== 'undefined'); }

  function fullySpeak(text){
    if (!fullyAvailable()) return false;
    try{
      var vol = Math.round(cfg().vol);                 // 0..100
      var oldVol = null;
      // lê e ajusta o stream de TTS (9). Documentado na ajuda do Fully.
      if (typeof fully.getAudioVolume === 'function'){
        try { oldVol = fully.getAudioVolume(9); } catch(e){}
      }
      if (typeof fully.setAudioVolume === 'function'){
        try { fully.setAudioVolume(vol, 9); } catch(e){}
      }

      // dispara a fala
      if      (typeof fully.textToSpeech === 'function'){ fully.textToSpeech(text); }
      else if (typeof fully.speak        === 'function'){ fully.speak(text); }
      else return false;

      // sem callback → calcula duração aproximada
      var ms = Math.max(1800, Math.min(6500, 3000 + text.length * 25));
      setTimeout(function(){
        // restaura volume do TTS se conseguimos ler antes
        try{
          if (oldVol != null && typeof fully.setAudioVolume === 'function'){
            fully.setAudioVolume(oldVol, 9);
          }
        }catch(e){}
        duckEnd();
      }, ms);
      return true;
    }catch(e){ return false; }
  }

  // ==== WEB SPEECH (PC/Chrome) ===============================================
  function webSpeak(text){
    try{
      if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return false;
      var u = new SpeechSynthesisUtterance(text);
      u.lang = 'pt-BR';
      u.rate = 1.0;
      u.pitch = 1.0;
      u.volume = Math.max(0, Math.min(1, cfg().vol / 100)); // slider do /admin
      u.onend = function(){ duckEnd(); };
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
      return true;
    }catch(e){ return false; }
  }

  // ==== BEEP (fallback) =======================================================
  function beep(){
    try{
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = 880;
      g.gain.value = Math.max(0.0001, Math.min(1, cfg().vol / 100));
      o.connect(g); g.connect(ctx.destination);
      o.start();
      setTimeout(function(){ o.stop(); duckEnd(); }, 700);
      return true;
    }catch(e){ return false; }
  }

  // ==== API PÚBLICA ===========================================================
  window.tvAnnounce = function(nome, sala){
    var text = fmt(String(nome||''), String(sala||''));
    var mode = (cfg().mode || 'auto');
    var lead = cfg().lead;

    duckStart();
    setTimeout(function(){
      var ok = false;
      try{
        if      (mode === 'fully') ok = fullySpeak(text);
        else if (mode === 'web')   ok = webSpeak(text);
        else if (mode === 'beep')  ok = beep();
        else                       ok = fullySpeak(text) || webSpeak(text) || beep(); // auto
      }catch(e){}
      if (!ok) duckEnd();
    }, Math.max(0, Number(lead)||0));
  };

  // tenta referenciar o player ao carregar
  window.addEventListener('load', function(){ try{ ensureYT(); }catch(e){} });
})();
