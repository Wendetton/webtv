
// === TV Audio Ducking + Centralização + Observer (Aug 12, 2025) ===
// Salve como /public/tv-ducking.js e inclua na página /tv.
// Objetivos:
// 1) Impedir sobreposição do painel no vídeo (feito via CSS do tv-enhancer.css)
// 2) Layout moderno para “já chamados” (CSS + ganchos de classe)
// 3) Nome atual centralizado no bloco .current-call .name (CSS)
// 4) Ducking do áudio do YouTube antes e durante o anúncio por voz (TTS)

(function(){
  const DUCK_VOLUME = 20; // volume do YouTube durante o anúncio (0–100)
  const RESTORE_VOLUME = 60; // volume padrão ao voltar (ajuste aqui se quiser)
  const DUCK_LEAD_MS = 600; // reduzir o volume um pouco antes de falar
  const SPEECH_RATE = 1.08; // velocidade da fala
  const SPEECH_LANG = "pt-BR";

  let ytPlayer = null;
  let restoreTimer = null;
  let lastAnnounced = "";

  // Util: carregar script de forma dinâmica
  function loadScript(src){
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  // Localizar ou reconstruir um iframe do YouTube com enablejsapi=1
  function ensureYouTubeAPI() {
    const iframes = Array.from(document.querySelectorAll('iframe')).filter(f => /youtube\.com|youtube-nocookie\.com/.test(f.src));
    if (!iframes.length) return null;
    const iframe = iframes[0];

    // injeta enablejsapi=1 caso não exista
    if (!/enablejsapi=1/.test(iframe.src)) {
      const url = new URL(iframe.src);
      url.searchParams.set('enablejsapi', '1');
      // Preserva autoplay/mute/etc
      iframe.src = url.toString();
    }
    iframe.id = iframe.id || 'yt-player';

    return iframe;
  }

  function setupYTPlayer(){
    const iframe = ensureYouTubeAPI();
    if (!iframe) return;

    function init(){
      ytPlayer = new YT.Player(iframe.id, {
        events: {
          'onReady': (e) => {
            try {
              e.target.setVolume(RESTORE_VOLUME);
            } catch(_) {}
          }
        }
      });
    }

    if (window.YT && window.YT.Player) {
      init();
    } else {
      window.onYouTubeIframeAPIReady = init;
      loadScript('https://www.youtube.com/iframe_api').catch(()=>{});
    }
  }

  // Tocar anúncio por voz (TTS)
  function speak(text, onend){
    try {
      if (!("speechSynthesis" in window)) {
        if (onend) onend();
        return;
      }
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = SPEECH_LANG;
      utter.rate = SPEECH_RATE;
      utter.onend = () => onend && onend();
      window.speechSynthesis.cancel(); // cancela qualquer fala anterior
      window.speechSynthesis.speak(utter);
    } catch(_) {
      if (onend) onend();
    }
  }

  // Ducking do áudio do YouTube
  function duckAndAnnounce(name){
    if (!name || name === lastAnnounced) return;
    lastAnnounced = name;

    const doRestore = () => {
      clearTimeout(restoreTimer);
      restoreTimer = setTimeout(() => {
        try { ytPlayer && ytPlayer.setVolume(RESTORE_VOLUME); } catch(_) {}
      }, 250);
    };

    const doAnnounce = () => {
      const phrase = `Atenção: paciente ${name}. Por favor, dirija-se ao consultório.`;
      speak(phrase, doRestore);
    };

    // reduz ligeiramente antes de falar
    try { ytPlayer && ytPlayer.setVolume(DUCK_VOLUME); } catch(_) {}
    setTimeout(doAnnounce, DUCK_LEAD_MS);
  }

  // Observa mudanças no nome atual pelo DOM (id: current-call-name)
  function watchCurrentName(){
    const el = document.getElementById('current-call-name');
    if (!el) return;

    const obs = new MutationObserver(() => {
      const name = (el.textContent || '').trim();
      if (name) {
        const row = el.closest('.current-call');
        if (row) {
          row.classList.remove('pulse');
          // força reflow para reiniciar a animação
          void row.offsetWidth;
          row.classList.add('pulse');
        }
        duckAndAnnounce(name);
      }
    });

    obs.observe(el, { childList: true, subtree: true, characterData: true });
  }

  // Exponho uma função global opcional, caso queira acionar manualmente:
  window.tvAnnounce = duckAndAnnounce;

  // boot
  window.addEventListener('load', () => {
    setupYTPlayer();
    watchCurrentName();
  });
})();
