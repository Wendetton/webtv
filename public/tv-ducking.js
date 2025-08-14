
// public/tv-ducking.js — Anúncio com modos: Fully TTS / Web TTS / Beep (com ducking e configs)
// Lê configurações de window.tvAnnounceCfg (preenchida pela /tv via Firestore)
(function(){
  const DEFAULTS = { duckVolume: 20, restoreVolume: 60, leadMs: 450, voiceTemplate: 'Atenção: paciente {{nome}}. Por favor, dirija-se ao consultório{{salaTxt}}.', announceMode: 'auto' };
  let ytPlayer = null, restoreTimer = null, lastPlayed = '';

  function getCfg(){
    const c = (window.tvAnnounceCfg || {});
    return {
      duckVolume: isFinite(c.duckVolume) ? Number(c.duckVolume) : DEFAULTS.duckVolume,
      restoreVolume: isFinite(c.restoreVolume) ? Number(c.restoreVolume) : DEFAULTS.restoreVolume,
      leadMs: isFinite(c.leadMs) ? Number(c.leadMs) : DEFAULTS.leadMs,
      voiceTemplate: c.voiceTemplate || DEFAULTS.voiceTemplate,
      announceMode: c.announceMode || DEFAULTS.announceMode,
    };
  }

  function loadScript(src){ return new Promise((res, rej)=>{ const s=document.createElement('script'); s.src=src; s.async=true; s.onload=res; s.onerror=rej; document.head.appendChild(s); }); }
  function ensureYouTubeAPI(){
    const ifr = Array.from(document.querySelectorAll('iframe')).find(f => /youtube\.com|youtube-nocookie\.com/.test(f.src||''));
    if (!ifr) return null;
    if (!/enablejsapi=1/.test(ifr.src)) { const u = new URL(ifr.src); u.searchParams.set('enablejsapi','1'); ifr.src = u.toString(); }
    ifr.id = ifr.id || 'yt-player';
    return ifr;
  }
  function setupYTPlayer(){
    const iframe = ensureYouTubeAPI(); if (!iframe) return;
    function init(){ ytPlayer = new YT.Player(iframe.id, { events:{ onReady:(e)=>{ try{ e.target.setVolume(getCfg().restoreVolume); e.target.unMute(); }catch{} } } }); }
    if (window.YT && window.YT.Player) init(); else { window.onYouTubeIframeAPIReady = init; loadScript('https://www.youtube.com/iframe_api').catch(()=>{}); }
  }

  function duckStart(){ try{ ytPlayer && ytPlayer.setVolume(getCfg().duckVolume); }catch{} }
  function duckEnd(){ clearTimeout(restoreTimer); restoreTimer = setTimeout(()=>{ try{ ytPlayer && ytPlayer.setVolume(getCfg().restoreVolume); }catch{} }, 140); }

  function formatPhrase(name, sala){
    const { voiceTemplate } = getCfg();
    const salaTxt = sala ? ` número ${sala}` : '';
    return voiceTemplate.replace('{{nome}}', name||'').replace('{{sala}}', sala||'').replace('{{salaTxt}}', salaTxt);
  }

  // ==== Fully TTS ====
  function canFully(){ try { return typeof fully !== 'undefined' && fully && typeof fully.textToSpeech === 'function'; } catch { return false; } }
  function speakFully(text){ try { fully.textToSpeech(text, 'pt_BR'); return true; } catch { return false; } }

  // ==== Web TTS ====
  function canWebTTS(){ try { return 'speechSynthesis' in window; } catch { return false; } }
  function speakWeb(text){
    try{
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'pt-BR'; u.rate = 1.06; u.pitch = 1.0;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
      return true;
    }catch{ return false; }
  }

  // ==== Beep ====
  function beepTwice(){
    try{
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return false;
      const ctx = new C();
      const be = (freq, dur, when) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = freq;
        g.gain.value = 0.0001; g.gain.linearRampToValueAtTime(0.2, ctx.currentTime + when + 0.01);
        g.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + when + dur);
        o.connect(g); g.connect(ctx.destination); o.start(ctx.currentTime + when); o.stop(ctx.currentTime + when + dur);
      };
      be(880, 0.18, 0); be(660, 0.22, 0.25);
      return true;
    } catch { return false; }
  }

  function chooseMode(){
    const mode = getCfg().announceMode;
    if (mode === 'fully') return 'fully';
    if (mode === 'web') return 'web';
    if (mode === 'beep') return 'beep';
    // auto
    if (canFully()) return 'fully';
    if (canWebTTS()) return 'web';
    return 'beep';
  }

  function announce(name, sala){
    if (!name || name === lastPlayed) return;
    lastPlayed = name;
    const phrase = formatPhrase(name, sala);

    const play = () => {
      const mode = chooseMode();
      let ok = false;
      if (mode === 'fully') ok = speakFully(phrase);
      else if (mode === 'web') ok = speakWeb(phrase);
      else ok = beepTwice();
      if (!ok) beepTwice();
    };

    duckStart();
    setTimeout(play, getCfg().leadMs);
    setTimeout(duckEnd, getCfg().leadMs + 1200);
  }

  // Observa mudanças em #current-call-name (para sites que não chamam a função)
  function watchDOM(){
    const el = document.getElementById('current-call-name');
    if (!el) return;
    const obs = new MutationObserver(()=>{
      const name = (el.textContent||'').trim();
      const salaEl = document.querySelector('.current-call .sub');
      const sala = salaEl ? (salaEl.textContent||'').replace(/Sala\s*/i,'').trim() : '';
      if (name) announce(name, sala);
    });
    obs.observe(el, { childList:true, subtree:true, characterData:true });
  }

  // API global para a TV chamar explicitamente
  window.tvAnnounce = announce;

  window.addEventListener('load', ()=>{ setupYTPlayer(); watchDOM(); });
})();
