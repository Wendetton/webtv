// public/tv-ducking.js — Anúncio com volume ajustável (announceVolume) + ducking do YouTube.
// Strategy: Fully TTS → Web Speech → Beep. Restaura volume ao final.
(function(){
  function getCfg(){
    const d = (typeof window !== 'undefined' && window.tvConfig) || {};
    return {
      mode: d.announceMode || 'auto',
      template: d.announceTemplate || 'Atenção: paciente {{nome}}. Dirija-se à sala {{salaTxt}}.',
      duck: Number.isFinite(d.duckVolume) ? d.duckVolume : 20,
      restore: Number.isFinite(d.restoreVolume) ? d.restoreVolume : 60,
      lead: Number.isFinite(d.leadMs) ? d.leadMs : 450,
      vol:  Number.isFinite(d.announceVolume) ? Math.max(0, Math.min(100, d.announceVolume)) : 90
    };
  }

  // ==== YouTube ducking (usa o player já existente na página)
  var ytPlayer = null;
  function ensureYTPlayer(){
    try{
      if (ytPlayer && ytPlayer.getVolume) return ytPlayer;
      var ifr = document.getElementById('yt-player') || document.querySelector('#yt-player iframe')?.contentWindow;
      if (!window.YT || !window.YT.Player) return null;
      var id = 'yt-player';
      ytPlayer = new YT.Player(id, {}); // pega o mesmo iframe e cria referência
    }catch(e){}
    return ytPlayer;
  }
  function duckStart(){
    try{ ensureYTPlayer(); var v = getCfg().duck; if (ytPlayer && ytPlayer.setVolume){ ytPlayer.setVolume(v); ytPlayer.unMute?.(); } }catch(e){}
  }
  function duckEnd(){
    setTimeout(function(){
      try{ var v = getCfg().restore; if (ytPlayer && ytPlayer.setVolume){ ytPlayer.setVolume(v); } }catch(e){}
    }, 120);
  }

  // ==== Helpers
  function fmt(name, sala){
    var t = getCfg().template;
    var sTxt = sala ? ('número ' + sala) : '';
    return String(t).replace('{{nome}}', name||'').replace('{{sala}}', sala||'').replace('{{salaTxt}}', sTxt);
  }

  // ==== Fala no Fully (se disponível). Tenta setar volume do aparelho se a API existir.
  function fullyTTS(text){
    try{
      if (!window.fully) return false;
      // volume do dispositivo (se a API existir)
      var vol = Math.round(getCfg().vol);  // 0..100
      var hadSetter = false;
      try{
        if (typeof window.fully.setAudioVolume === 'function'){ window.fully.setAudioVolume(vol); hadSetter = true; }
      }catch(e){}
      // falar
      if (typeof window.fully.textToSpeech === 'function'){ window.fully.textToSpeech(text); }
      else if (typeof window.fully.speak === 'function'){ window.fully.speak(text); }
      else { return false; }
      // se não conseguimos setar o volume por API, respeita volume do dispositivo
      // não há callback de fim → usa um timeout aproximado
      var ms = Math.max(1800, Math.min(6000, 3000 + text.length * 25));
      setTimeout(duckEnd, ms);
      return true;
    }catch(e){ return false; }
  }

  // ==== Web Speech (Chrome/Android WebView)
  function webTTS(text){
    try{
      if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return false;
      var u = new SpeechSynthesisUtterance(text);
      u.lang = 'pt-BR';
      u.rate = 1.0;
      u.pitch = 1.0;
      u.volume = Math.max(0, Math.min(1, getCfg().vol / 100));  // << volume do anúncio
      u.onend = function(){ duckEnd(); };
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
      return true;
    }catch(e){ return false; }
  }

  // ==== Beep simples (fallback sem TTS), respeita volume
  function beep(){
    try{
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = 880;
      g.gain.value = Math.max(0.0001, Math.min(1, getCfg().vol / 100));
      o.connect(g); g.connect(ctx.destination);
      o.start();
      setTimeout(function(){ o.stop(); duckEnd(); }, 700);
      return true;
    }catch(e){ return false; }
  }

  // ==== API pública chamada pelo /tv.js
  window.tvAnnounce = function(nome, sala){
    try{ duckStart(); }catch(e){}
    var text = fmt(String(nome||''), String(sala||''));
    var mode = (getCfg().mode || 'auto');
    var lead = getCfg().lead;

    setTimeout(function(){
      var ok = false;
      try{
        if      (mode === 'fully') ok = fullyTTS(text);
        else if (mode === 'web')   ok = webTTS(text);
        else if (mode === 'beep')  ok = beep();
        else                       ok = fullyTTS(text) || webTTS(text) || beep();
      }catch(e){}
      if (!ok) duckEnd();
    }, Math.max(0, Number(lead)||0));
  };

  // tenta referenciar o player quando a página carregar
  window.addEventListener('load', function(){ try{ ensureYTPlayer(); }catch(e){} });
})();
