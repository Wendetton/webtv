
// === /public/tv-ducking.js — Fully TTS first, then browser TTS, then Beep (2025-08-13) ===
// Objetivo: fazer o anúncio de voz funcionar no Fire TV/Fully SEM mudar hardware.
// Ordem de preferência:
//  1) Fully Kiosk JavaScript Interface: fully.textToSpeech(text, 'pt_BR')   (requer Settings > Advanced Web Settings > Enable JavaScript Interface)
//  2) speechSynthesis do navegador
//  3) Beep (tone) como última camada
//
// Mantém ducking do YouTube: reduz o volume durante o anúncio e restaura depois.

(function(){
  const DUCK_VOLUME = 20;   // volume do YouTube durante anúncio (0–100)
  const RESTORE_VOLUME = 60;// volume padrão
  const LEAD_MS = 300;      // antecedência antes de falar/tocar
  let ytPlayer = null;
  let restoreTimer = null;

  // --- YouTube control ------------------------------------------------------
  function loadScript(src){
    return new Promise((res, rej) => { const s=document.createElement('script'); s.src=src; s.async=true; s.onload=res; s.onerror=rej; document.head.appendChild(s); });
  }
  function ensureYouTubeAPI(){
    const ifr = Array.from(document.querySelectorAll('iframe')).find(f => /youtube\.com|youtube-nocookie\.com/.test(f.src||''));
    if (!ifr) return null;
    if (!/enablejsapi=1/.test(ifr.src)) { const u = new URL(ifr.src); u.searchParams.set('enablejsapi','1'); ifr.src = u.toString(); }
    ifr.id = ifr.id || 'yt-player';
    return ifr;
  }
  function setupYTPlayer(){
    const iframe = ensureYouTubeAPI();
    if (!iframe) return;
    function init(){
      ytPlayer = new YT.Player(iframe.id, { events: { onReady: (e) => {
        try { e.target.setVolume(RESTORE_VOLUME); e.target.unMute(); } catch {}
      } } });
    }
    if (window.YT && window.YT.Player) init();
    else { window.onYouTubeIframeAPIReady = init; loadScript('https://www.youtube.com/iframe_api').catch(()=>{}); }
  }
  function duckStart(){ try { ytPlayer && ytPlayer.setVolume(DUCK_VOLUME); } catch {} }
  function duckEnd(){ clearTimeout(restoreTimer); restoreTimer = setTimeout(() => { try { ytPlayer && ytPlayer.setVolume(RESTORE_VOLUME); } catch {} }, 120); }

  // --- Utils ----------------------------------------------------------------
  function formatPhrase(name, sala){
    const cfg = window.tvVoice || {};
    const defaultTpl = 'Atenção: paciente {{nome}}. Por favor, dirija-se ao consultório{{salaTxt}}.';
    const template = cfg.template || defaultTpl;
    const salaTxt = sala ? (' número ' + sala) : '';
    return template.replace('{{nome}}', name || '').replace('{{sala}}', sala || '').replace('{{salaTxt}}', salaTxt);
  }
  function estimateMs(text, rate){
    // estimativa de duração (ms) para restaurar volume quando não há callback do TTS do Fully
    const w = (text || '').trim().split(/\s+/).filter(Boolean).length || 1;
    const baseWpm = 150 * (rate ? (1/rate) : 1); // mais rápido = menor duração
    const minutes = w / baseWpm;
    return Math.min(7000, Math.max(2000, minutes * 60 * 1000));
  }

  // --- Layer 1: Fully Kiosk TTS --------------------------------------------
  function canUseFully(){
    return typeof window !== 'undefined' && window.fully && typeof window.fully.textToSpeech === 'function';
  }
  function fullySpeak(text){
    try {
      // Locale pt_BR costuma estar presente no Fire OS
      window.fully.textToSpeech(String(text || ''), 'pt_BR');
      return true;
    } catch { return false; }
  }

  // --- Layer 2: Browser speechSynthesis ------------------------------------
  function canUseSpeech(){
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }
  function speechSpeak(text){
    try{
      const u = new SpeechSynthesisUtterance(String(text || ''));
      const cfg = window.tvVoice || {};
      u.lang = 'pt-BR';
      if (typeof cfg.rate === 'number') u.rate = cfg.rate;
      if (typeof cfg.pitch === 'number') u.pitch = cfg.pitch;
      u.onend = () => duckEnd();
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
      return true;
    } catch { return false; }
  }

  // --- Layer 3: Beep --------------------------------------------------------
  function beepMs(ms){
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(880, ctx.currentTime); // tom agudo
      g.gain.setValueAtTime(0.001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.04);
      o.connect(g); g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + ms/1000);
      setTimeout(()=>{ try{ ctx.close(); }catch{} }, ms+200);
      return true;
    } catch { return false; }
  }
  function doubleBeep(){
    const first = 260, gap = 190, second = 320;
    beepMs(first);
    setTimeout(()=>beepMs(second), first + gap);
  }

  // API pública: tocar MP3 (se houver URL pronta, ex. de função serverless)
  window.playAnnouncementMp3 = function(url){
    if (!url) return;
    const audio = new Audio(url);
    audio.preload = 'auto';
    audio.onplay = () => duckStart();
    audio.onended = () => duckEnd();
    audio.onerror = () => duckEnd();
    audio.play().catch(()=>{ duckEnd(); });
  };

  // API pública principal: faz o anúncio com fallback inteligente
  window.tvAnnounce = function(name, sala){
    const phrase = formatPhrase(name, sala);
    const rate = (window.tvVoice && typeof window.tvVoice.rate === 'number') ? window.tvVoice.rate : 1.0;

    duckStart();
    setTimeout(() => {
      if (canUseFully()) {
        const ok = fullySpeak(phrase);
        // não temos callback do Fully; estima duração e restaura depois
        setTimeout(duckEnd, estimateMs(phrase, rate));
        if (ok) return;
      }
      if (canUseSpeech()) {
        const ok = speechSpeak(phrase);
        if (ok) return; // duckEnd será chamado no onend
      }
      // último recurso: beep duplo
      doubleBeep();
      setTimeout(duckEnd, 1200);
    }, LEAD_MS);
  };

  // bootstrap
  window.addEventListener('load', () => { setupYTPlayer(); });
})();
