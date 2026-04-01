// public/tv-ducking.js — TTS nativo Android + Fully Kiosk + Web TTS + Beep
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

  function fmt(name, sala){
    const { template } = getCfg();
    const salaTxt = sala ? `número ${sala}` : '';
    return template
      .replace('{{nome}}', name || '')
      .replace('{{sala}}', sala || '')
      .replace('{{salaTxt}}', salaTxt);
  }

  // 1. TTS nativo Android (app OftalmoCenterTV)
  function androidTTS(text) {
    try {
      if (typeof window.AndroidTTS !== 'undefined' &&
          typeof window.AndroidTTS.speak === 'function') {
        window.AndroidTTS.speak(text);
        const est = Math.max(2000, text.length * 65);
        setTimeout(duckEnd, est);
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
        const est = Math.max(2000, text.length * 60);
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
        const voices = window.speechSynthesis.getVoices();
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 1.0; u.pitch = 1.0; u.volume = 1.0;
        const ptVoice = voices.find(v => v.lang.startsWith('pt')) || voices[0] || null;
        if (ptVoice) u.voice = ptVoice;
        u.lang = ptVoice ? ptVoice.lang : 'pt-BR';
        let ended = false;
        const timeout = setTimeout(() => {
          if (!ended) { ended = true; window.speechSynthesis.cancel(); onFail && onFail(); }
        }, 8000);
        u.onend = () => { if (!ended) { ended = true; clearTimeout(timeout); duckEnd(); } };
        u.onerror = () => { if (!ended) { ended = true; clearTimeout(timeout); onFail && onFail(); } };
        window.speechSynthesis.speak(u);
        const ri = setInterval(() => {
          if (ended) { clearInterval(ri); return; }
          if (window.speechSynthesis.paused) window.speechSynthesis.resume();
        }, 500);
        setTimeout(() => clearInterval(ri), 10000);
      }
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) { doSpeak(); }
      else {
        window.speechSynthesis.onvoiceschanged = () => {
          window.speechSynthesis.onvoiceschanged = null; doSpeak();
        };
        setTimeout(() => { window.speechSynthesis.onvoiceschanged = null; doSpeak(); }, 2000);
      }
      return true;
    } catch { onFail && onFail(); return false; }
  }

  // 4. Beep (fallback universal)
  function beep(){
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      const ctx = new Ctx();
      const play = (tone, ms, when) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
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
    const { mode, lead } = getCfg();
    duckStart();
    setTimeout(() => {
      const text = fmt(name, sala);
      if (mode === 'fully') {
        if (!fullyTTS(text)) beep();
      } else if (mode === 'web') {
        webTTS(text, () => beep());
      } else if (mode === 'beep') {
        beep();
      } else {
        // auto: Android nativo → Fully → Web TTS → Beep
        if (!androidTTS(text) && !fullyTTS(text)) {
          webTTS(text, () => beep());
        }
      }
    }, Math.max(0, Number(lead) || 0));
  };

})();
