// public/tv-ducking.js — CORRIGIDO: usa window.tvYTPlayer em vez de criar player duplicado
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

  // CORRIGIDO: não cria segundo YT.Player.
  // YoutubePlayer.js já gerencia o player e expõe via window.tvYTPlayer.
  function getYTPlayer() {
    return window.tvYTPlayer || null;
  }

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

  function fmt(name, sala){
    const { template } = getCfg();
    const salaTxt = sala ? `número ${sala}` : '';
    return template
      .replace('{{nome}}', name || '')
      .replace('{{sala}}', sala || '')
      .replace('{{salaTxt}}', salaTxt);
  }

  function fullyTTS(text){
    try {
      if (typeof fully !== 'undefined' && typeof fully.textToSpeech === 'function') {
        fully.textToSpeech(text, 'pt_BR');
        const est = Math.max(2000, text.length * 60);
        setTimeout(duckEnd, est);
        return true;
      }
    } catch {}
    return false;
  }

  function webTTS(text){
    try {
      if (!('speechSynthesis' in window)) return false;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'pt-BR'; u.rate = 1.06; u.pitch = 1.0;
      u.onend = duckEnd;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
      return true;
    } catch { return false; }
  }

  function beep(){
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      const ctx = new Ctx();
      const play = (tone=880, ms=180, when=0) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = tone;
        g.gain.setValueAtTime(0.001, ctx.currentTime + when);
        g.gain.linearRampToValueAtTime(0.2, ctx.currentTime + when + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + when + ms / 1000);
        o.connect(g); g.connect(ctx.destination);
        o.start(ctx.currentTime + when); o.stop(ctx.currentTime + when + ms / 1000);
      };
      play(880, 180, 0.00);
      play(660, 180, 0.25);
      setTimeout(duckEnd, 800);
      return true;
    } catch { return false; }
  }

  window.tvAnnounce = function(name, sala){
    if (!name) return;
    const { mode, lead } = getCfg();
    duckStart();
    setTimeout(() => {
      const text = fmt(name, sala);
      let ok = false;
      if (mode === 'fully')      ok = fullyTTS(text);
      else if (mode === 'web')   ok = webTTS(text);
      else if (mode === 'beep')  ok = beep();
      else { ok = fullyTTS(text) || webTTS(text) || beep(); }
      if (!ok) duckEnd();
    }, Math.max(0, Number(lead) || 0));
  };

})();
