// tv-ducking.js — controla APENAS o volume do YouTube via eventos para o player real,
// e mantém a fala (Fully/Web/Beep) como você já usa.

// ===== Config lendo do window.tvConfig (setado pelo /tv.js) =====
(function(){
  function cfg(){
    const d = (typeof window !== 'undefined' && window.tvConfig) || {};
    return {
      mode: (d.announceMode || 'auto'), // 'auto' | 'fully' | 'web' | 'beep'
      template: d.announceTemplate || 'Atenção: paciente {{nome}}. Dirija-se à sala {{salaTxt}}.',
      duck: Number.isFinite(d.duckVolume) ? d.duckVolume : 20,     // YT durante anúncio
      restore: Number.isFinite(d.restoreVolume) ? d.restoreVolume : 60, // YT padrão
      lead: Number.isFinite(d.leadMs) ? d.leadMs : 450,
      vol:  Number.isFinite(d.announceVolume) ? Math.max(0, Math.min(100, d.announceVolume)) : 90, // volume da fala (quando aplicável)
    };
  }

  // ===== Utilitários =====
  function dispatch(name, v){
    try {
      const ev = new CustomEvent(name, { detail: { v } });
      window.dispatchEvent(ev);
    } catch {
      // fallback caso o WebView não suporte CustomEvent nativo
      try {
        const ev = document.createEvent('CustomEvent');
        ev.initCustomEvent(name, false, false, { v });
        window.dispatchEvent(ev);
      } catch {}
    }
  }

  function duckStart(){ dispatch('tv:duck', cfg().duck); }
  function duckEnd(){ setTimeout(() => dispatch('tv:restore', cfg().restore), 120); }

  // Aplica o volume padrão do YouTube assim que a página carregar
  window.addEventListener('load', function(){
    setTimeout(() => dispatch('tv:restore', cfg().restore), 400);
  });

  // ===== Formatação do texto =====
  function fmt(name, sala){
    const t = cfg().template;
    const sTxt = sala ? ('número ' + sala) : '';
    return String(t).replace('{{nome}}', name||'').replace('{{sala}}', sala||'').replace('{{salaTxt}}', sTxt);
  }

  // ===== Fala: Fully → Web → Beep (como já estava) =====
  function fullyAvailable(){ return typeof window !== 'undefined' && typeof window.fully !== 'undefined'; }

  function fullySpeak(text){
    try{
      if (!fullyAvailable()) return false;
      if      (typeof fully.textToSpeech === 'function') fully.textToSpeech(text);
      else if (typeof fully.speak        === 'function') fully.speak(text);
      else return false;
      return true;
    }catch(e){ return false; }
  }

  function webSpeak(text){
    try{
      if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return false;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'pt-BR'; u.rate = 1.0; u.pitch = 1.0;
      u.volume = Math.max(0, Math.min(1, cfg().vol / 100));
      // ao terminar a fala, restauramos o volume do YT
      u.onend = () => duckEnd();
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
      return true;
    }catch(e){ return false; }
  }

  function beep(){
    try{
      const Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return false;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine'; osc.frequency.value = 880;
      gain.gain.value = Math.max(0.0001, Math.min(1, cfg().vol / 100));
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start();
      setTimeout(()=>{ try{ osc.stop(); }catch{} duckEnd(); }, 700);
      return true;
    }catch(e){ return false; }
  }

  // ===== API chamada pelo /tv.js quando há um chamado =====
  window.tvAnnounce = function(nome, sala){
    const text = fmt(String(nome||''), String(sala||''));
    const mode = (cfg().mode || 'auto');
    const lead = cfg().lead;

    // 1) baixa o volume do YT antes de falar
    duckStart();

    // 2) dispara a fala com o atraso configurado
    setTimeout(function(){
      let ok = false;
      try{
        if      (mode === 'fully') ok = fullySpeak(text);
        else if (mode === 'web')   ok = webSpeak(text);
        else if (mode === 'beep')  ok = beep();
        else                       ok = fullySpeak(text) || webSpeak(text) || beep(); // auto
      }catch(e){}

      // 3) se não houve onend (caso Fully/Beep), estima a duração e restaura depois
      const est = Math.max(1800, Math.min(6500, 3000 + text.length * 25));
      setTimeout(duckEnd, est);

      if (!ok) { duckEnd(); }
    }, Math.max(0, Number(lead)||0));
  };
})();
