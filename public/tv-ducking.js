// public/tv-ducking.js — TTS com ducking de volume do YouTube
// ✅ Compatível com: FreeKiosk, Fully Kiosk, Silk Browser, qualquer WebView
// Cadeia de fallback: Fully TTS → Google Translate TTS → Web Speech API → Beep
(function(){
  'use strict';

  function getCfg(){
    var d = (typeof window !== 'undefined' && window.tvConfig) || {};
    return {
      mode: d.announceMode || 'auto',
      template: d.announceTemplate || 'Atenção: paciente {{nome}}. Dirija-se à sala {{salaTxt}}.',
      duck: Number.isFinite(d.duckVolume) ? d.duckVolume : 20,
      restore: Number.isFinite(d.restoreVolume) ? d.restoreVolume : 60,
      lead: Number.isFinite(d.leadMs) ? d.leadMs : 450
    };
  }

  // ========== DUCKING DO YOUTUBE ==========
  function getPlayer() {
    return window.tvYTPlayer || null;
  }

  function duckStart(){
    var duck = getCfg().duck;
    var player = getPlayer();
    try { if (player) player.setVolume(duck); } catch(e){}
  }

  function duckEnd(){
    var restore = getCfg().restore;
    setTimeout(function(){
      var player = getPlayer();
      try { if (player) player.setVolume(restore); } catch(e){}
    }, 200);
  }

  // ========== FORMATAÇÃO ==========
  function fmt(name, sala){
    var template = getCfg().template;
    var salaTxt = sala ? 'número ' + sala : '';
    return template
      .replace('{{nome}}', name || '')
      .replace('{{sala}}', sala || '')
      .replace('{{salaTxt}}', salaTxt);
  }

  // ========== MÉTODOS DE TTS ==========

  // 1) Fully Kiosk TTS (API nativa do Fully)
  function fullyTTS(text){
    try {
      if (typeof fully !== 'undefined' && typeof fully.textToSpeech === 'function') {
        fully.textToSpeech(text, 'pt_BR');
        var est = Math.max(2000, text.length * 60);
        setTimeout(duckEnd, est);
        return true;
      }
    } catch(e){}
    return false;
  }

  // 2) Google Translate TTS (funciona em QUALQUER WebView com internet)
  // Gera um MP3 via endpoint do Google Translate — perfeito para chamada de pacientes
  function googleTTS(text, onFail){
    try {
      // Limita texto a 200 chars (limite do endpoint)
      var safeText = text.length > 200 ? text.substring(0, 200) : text;
      var encoded = encodeURIComponent(safeText);
      var url = 'https://translate.google.com/translate_tts'
        + '?ie=UTF-8'
        + '&q=' + encoded
        + '&tl=pt-BR'
        + '&client=tw-ob'
        + '&ttsspeed=1';

      var audio = new Audio(url);
      audio.volume = 1.0;

      var resolved = false;
      function done(){
        if (resolved) return;
        resolved = true;
        duckEnd();
      }

      audio.onended = done;
      audio.onerror = function(){
        if (resolved) return;
        resolved = true;
        console.warn('[TTS] Google TTS falhou');
        if (typeof onFail === 'function') onFail();
        else duckEnd();
      };

      // Timeout de segurança (máx 12s)
      setTimeout(function(){
        if (!resolved) {
          console.warn('[TTS] Google TTS timeout');
          done();
        }
      }, 12000);

      var playPromise = audio.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise.then(function(){
          console.log('[TTS] Google TTS reproduzindo');
        }).catch(function(err){
          if (resolved) return;
          resolved = true;
          console.warn('[TTS] Google TTS play bloqueado:', err.message || err);
          if (typeof onFail === 'function') onFail();
          else duckEnd();
        });
      }

      return true;
    } catch(e){
      console.warn('[TTS] Google TTS erro:', e);
    }
    return false;
  }

  // 3) Web Speech API (funciona em Chrome desktop, alguns Android)
  function webTTS(text){
    try {
      if (!('speechSynthesis' in window)) return false;
      var synth = window.speechSynthesis;
      // Testa se tem vozes disponíveis (Fire TV WebView geralmente não tem)
      var voices = synth.getVoices ? synth.getVoices() : [];
      // Alguns WebViews reportam speechSynthesis mas sem vozes
      // Vamos tentar mesmo assim
      var u = new SpeechSynthesisUtterance(text);
      u.lang = 'pt-BR';
      u.rate = 1.06;
      u.pitch = 1.0;
      u.onend = duckEnd;
      u.onerror = function(){ duckEnd(); };
      synth.cancel();
      synth.speak(u);
      // Verifica se realmente está falando após 800ms
      setTimeout(function(){
        if (!synth.speaking && !synth.pending) {
          console.warn('[TTS] Web Speech API não está ativa — usando beep');
          beep();
        }
      }, 800);
      return true;
    } catch(e){}
    return false;
  }

  // 4) Beep (último recurso — sequência mais audível)
  function beep(){
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) { duckEnd(); return false; }
      var ctx = new Ctx();
      var play = function(tone, ms, when){
        tone = tone || 880; ms = ms || 180; when = when || 0;
        var o = ctx.createOscillator();
        var g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = tone;
        g.gain.setValueAtTime(0.001, ctx.currentTime + when);
        g.gain.linearRampToValueAtTime(0.25, ctx.currentTime + when + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + when + ms / 1000);
        o.connect(g);
        g.connect(ctx.destination);
        o.start(ctx.currentTime + when);
        o.stop(ctx.currentTime + when + ms / 1000);
      };
      // 3 tons ascendentes — mais perceptível que o original
      play(660, 200, 0.00);
      play(880, 200, 0.28);
      play(1100, 250, 0.56);
      setTimeout(duckEnd, 1200);
      return true;
    } catch(e){ duckEnd(); }
    return false;
  }

  // ========== ORQUESTRADOR ==========
  function announce(text, mode) {
    // Modo explícito
    if (mode === 'fully') {
      if (fullyTTS(text)) return;
    }
    if (mode === 'web') {
      if (webTTS(text)) return;
      beep(); return;
    }
    if (mode === 'google') {
      if (googleTTS(text, function(){ beep(); })) return;
      beep(); return;
    }
    if (mode === 'beep') {
      beep(); return;
    }

    // Modo AUTO (padrão)
    // 1. Tenta Fully Kiosk (só funciona se estiver no Fully)
    if (fullyTTS(text)) return;

    // 2. Tenta Google Translate TTS (funciona em qualquer WebView com internet)
    //    Se falhar, faz fallback para Web Speech ou beep
    var googleOk = googleTTS(text, function(){
      // onFail: tenta Web Speech, depois beep
      if (!webTTS(text)) beep();
    });
    if (googleOk) return;

    // 3. Tenta Web Speech API
    if (webTTS(text)) return;

    // 4. Beep
    beep();
  }

  // ========== API PÚBLICA ==========
  window.tvAnnounce = function(name, sala){
    if (!name) return;
    var cfg = getCfg();
    console.log('[TTS] Anunciando:', name, '| Sala:', sala, '| Modo:', cfg.mode);

    duckStart();

    setTimeout(function(){
      var text = fmt(name, sala);
      announce(text, cfg.mode);
    }, Math.max(0, Number(cfg.lead) || 0));
  };

  console.log('[TTS] tv-ducking.js carregado — pronto para anúncios');
})();
