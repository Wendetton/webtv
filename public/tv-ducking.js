// Ducking e controle de volume do YouTube.
// Agora o YouTube obedece SEMPRE ao "restoreVolume" (padrão) e baixa para "duckVolume" durante o anúncio.
// Não mexe mais no volume do dispositivo — só no player do YouTube.
// O TTS continua como antes (Fully/Web/Beep), mas o foco é o volume do YouTube.

(function(){
  // ====== Config ======
  function cfg(){
    const d = (typeof window !== 'undefined' && window.tvConfig) || {};
    return {
      mode: (d.announceMode || 'auto'), // 'auto' | 'fully' | 'web' | 'beep'
      template: d.announceTemplate || 'Atenção: paciente {{nome}}. Dirija-se à sala {{salaTxt}}.',
      duck: Number.isFinite(d.duckVolume) ? d.duckVolume : 20,     // volume do YT DURANTE anúncio (0..100)
      restore: Number.isFinite(d.restoreVolume) ? d.restoreVolume : 60, // volume PADRÃO do YT (0..100)
      lead: Number.isFinite(d.leadMs) ? d.leadMs : 450,
      // abaixo seguem configs que você já usa para TTS; mantemos por compatibilidade
      vol:  Number.isFinite(d.announceVolume) ? Math.max(0, Math.min(100, d.announceVolume)) : 90
    };
  }

  // ====== YouTube: obter referência e setar volume ======
  var ytRef = null;
  function getYT(){
    try{
      if (ytRef && ytRef.getVolume) return ytRef;
      if (!window.YT || !window.YT.Player) return null;
      // cria um "wrapper" para o iframe existente com id 'yt-player'
      ytRef = new YT.Player('yt-player', {});
    }catch(e){}
    return ytRef;
  }
  function setYTVolume(level){
    try{
      const p = getYT();
      if (!p || typeof p.setVolume !== 'function') return;
      const v = Math.max(0, Math.min(100, Math.round(level)));
      p.setVolume(v);
      // garantir que não esteja mutado
      if (typeof p.unMute === 'function') p.unMute();
    }catch(e){}
  }

  // ====== Texto do anúncio (igual antes) ======
  function fmt(name, sala){
    var t = cfg().template;
    var sTxt = sala ? ('número ' + sala) : '';
    return String(t).replace('{{nome}}', name||'').replace('{{sala}}', sala||'').replace('{{salaTxt}}', sTxt);
  }

  // ====== TTS (mantido) ======
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
      var u = new SpeechSynthesisUtterance(text);
      u.lang = 'pt-BR'; u.rate = 1.0; u.pitch = 1.0;
      u.volume = Math.max(0, Math.min(1, cfg().vol / 100)); // se quiser controlar o TTS depois
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
      return true;
    }catch(e){ return false; }
  }
  function beep(){
    try{
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = 880;
      g.gain.value = Math.max(0.0001, Math.min(1, cfg().vol / 100));
      o.connect(g); g.connect(ctx.destination);
      o.start();
      setTimeout(function(){ o.stop(); }, 700);
      return true;
    }catch(e){ return false; }
  }

  // ====== Lógica de ducking/restauração do YouTube ======
  var duckingUntil = 0; // timestamp até quando estamos "em anúncio"

  function duckStart(){
    duckingUntil = Date.now() + 8000; // janela conservadora (ajustada ao fim real mais abaixo)
    setYTVolume(cfg().duck);
  }
  function duckEnd(){
    duckingUntil = Date.now() + 200; // evitar corrida; restaura em seguida
    setTimeout(function(){ setYTVolume(cfg().restore); }, 120);
  }

  // Atualiza o volume "padrão" do YouTube periodicamente, se não estiver em anúncio.
  // Isso faz o slider "Restaurar volume" do /admin virar o controle GERAL do YouTube.
  setInterval(function(){
    if (Date.now() > duckingUntil) {
      setYTVolume(cfg().restore);
    }
  }, 1500);

  // Tenta aplicar o volume padrão assim que a página terminar de carregar/YouTube disponível.
  window.addEventListener('load', function(){
    setTimeout(function(){ setYTVolume(cfg().restore); }, 400);
  });

  // ====== API pública chamada pelo /tv.js (quando há um chamado) ======
  window.tvAnnounce = function(nome, sala){
    var text = fmt(String(nome||''), String(sala||''));
    var mode = (cfg().mode || 'auto');
    var lead = cfg().lead;

    // baixa o YouTube ANTES de falar
    duckStart();

    setTimeout(function(){
      // fala (Fully → Web → Beep)
      var ok = false;
      try{
        if      (mode === 'fully') ok = fullySpeak(text);
        else if (mode === 'web')   ok = webSpeak(text);
        else if (mode === 'beep')  ok = beep();
        else                       ok = fullySpeak(text) || webSpeak(text) || beep(); // auto
      }catch(e){}

      // estimar duração para segurar o ducking o tempo suficiente
      var est = Math.max(1800, Math.min(6500, 3000 + text.length * 25));
      duckingUntil = Date.now() + est + 150;
      setTimeout(duckEnd, est);

      if (!ok) { // se não conseguiu falar, ao menos restaura o YT
        duckEnd();
      }
    }, Math.max(0, Number(lead)||0));
  };
})();
