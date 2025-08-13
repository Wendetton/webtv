
/* ======= pages/tv.js — Auto-Firebase Listener (RESTORED) =======
   Data: 2025-08-12
   O que este arquivo faz:
   - Mantém o layout novo e o Script de ducking.
   - NÃO importa CSS aqui (global está em pages/_app.js).
   - Detecta e assina o Firebase automaticamente (Firestore e/ou Realtime DB).
   - Observa múltiplos caminhos comuns: 'tv/state', 'state/current', 'config/tv', 'app/tv' (Firestore)
     e '/tv', '/state', '/config/tv' (Realtime DB). Usa o primeiro que retornar dados válidos.
   - Mantém fallback: window.__applyTVState(state).
*/

import Head from 'next/head';
import Script from 'next/script';
import { useEffect, useState } from 'react';

export default function TVPage(){
  const [currentName, setCurrentName] = useState('—');
  const [calledList, setCalledList] = useState([]);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [sourceInfo, setSourceInfo] = useState('');

  // Aplica estado normalizado na UI
  function applyState(state){
    if (!state) return;
    if (state.currentName != null) setCurrentName(String(state.currentName || '—'));
    if (Array.isArray(state.calledList)) setCalledList(state.calledList);
    if (state.youtubeUrl != null) setYoutubeUrl(String(state.youtubeUrl || ''));
  }

  // Normaliza formatos diferentes de estado
  function normalize(data){
    if (!data || typeof data !== 'object') return null;
    const out = {};
    if ('currentName' in data) out.currentName = data.currentName;
    if ('nomeAtual' in data) out.currentName = data.nomeAtual;
    if ('chamando' in data) out.currentName = data.chamando;
    if ('calledList' in data && Array.isArray(data.calledList)) out.calledList = data.calledList;
    if ('jaChamados' in data && Array.isArray(data.jaChamados)) out.calledList = data.jaChamados;
    if ('youtubeUrl' in data) out.youtubeUrl = data.youtubeUrl;
    if ('video' in data) out.youtubeUrl = data.video;
    return out;
  }

  // Efeito visual ao trocar o nome
  useEffect(() => {
    const row = document.querySelector('.current-call');
    if (!row) return;
    row.classList.remove('pulse');
    void row.offsetWidth;
    row.classList.add('pulse');
  }, [currentName]);

  // Listener Firebase (client-side only)
  useEffect(() => {
    let unsubscribes = [];
    let resolved = false;

    // Fallback manual por janela (caso o Admin injete assim)
    if (typeof window !== 'undefined') {
      window.__applyTVState = (state) => applyState(state);
    }

    async function tryFirestorePaths(app, firestore){
      const paths = ['tv/state', 'state/current', 'config/tv', 'app/tv'];
      for (const p of paths) {
        try {
          const { doc, onSnapshot } = await import('firebase/firestore');
          const dref = doc(firestore, p);
          const unsub = onSnapshot(dref, (snap) => {
            if (!snap.exists()) return;
            const norm = normalize(snap.data());
            if (norm) {
              if (!resolved) {
                resolved = true;
                setSourceInfo('Firestore:' + p);
              }
              applyState(norm);
            }
          });
          unsubscribes.push(unsub);
        } catch {}
      }
    }

    async function tryRealtimePaths(app, db){
      const paths = ['/tv', '/state', '/config/tv'];
      for (const p of paths) {
        try {
          const { ref, onValue } = await import('firebase/database');
          const r = ref(db, p);
          const off = onValue(r, (snap) => {
            const val = snap.val();
            const norm = normalize(val);
            if (norm) {
              if (!resolved) {
                resolved = true;
                setSourceInfo('RTDB:' + p);
              }
              applyState(norm);
            }
          });
          unsubscribes.push(() => off());
        } catch {}
      }
    }

    async function boot(){
      if (typeof window === 'undefined') return;

      // 1) Tenta reutilizar um módulo util do projeto, se existir
      let app = null, firestore = null, rtdb = null;
      try {
        const mod = await import('../utils/firebase');
        app = mod.app || mod.default || mod;
        firestore = mod.db || mod.firestore || null;
        rtdb = mod.database || mod.rtdb || null;
      } catch {}

      // 2) Se não existir, tenta inicializar por variáveis de ambiente públicas
      if (!app) {
        try {
          const { initializeApp, getApps } = await import('firebase/app');
          const config = {
            apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
            authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
            messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
            appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
            databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
          };
          if (Object.values(config).filter(Boolean).length >= 3) {
            app = getApps().length ? getApps()[0] : initializeApp(config);
          }
        } catch {}
      }

      // 3) Firestore e RTDB
      if (app && !firestore) {
        try { const { getFirestore } = await import('firebase/firestore'); firestore = getFirestore(app); } catch {}
      }
      if (app && !rtdb) {
        try { const { getDatabase } = await import('firebase/database'); rtdb = getDatabase(app); } catch {}
      }

      // 4) Ativa listeners (tentamos os dois tipos)
      if (firestore) await tryFirestorePaths(app, firestore);
      if (rtdb) await tryRealtimePaths(app, rtdb);
    }

    boot();

    return () => { unsubscribes.forEach(fn => { try { fn(); } catch {} }); };
  }, []);

  function buildYouTubeSrc(url){
    if (!url) return '';
    try{
      const u = new URL(url);
      if (!u.searchParams.has('enablejsapi')) u.searchParams.set('enablejsapi','1');
      if (!u.searchParams.has('autoplay')) u.searchParams.set('autoplay','1');
      if (!u.searchParams.has('mute')) u.searchParams.set('mute','0');
      if (!u.searchParams.has('playsinline')) u.searchParams.set('playsinline','1');
      return u.toString();
    }catch{
      return url;
    }
  }
  const ytSrc = buildYouTubeSrc(youtubeUrl);

  return (
    <div className="tv-screen">
      <Head>
        <title>Chamador na TV</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="tv-video-wrap">
        <div className="tv-video-inner">
          {ytSrc ? (
            <iframe
              id="yt-player"
              src={ytSrc}
              allow="autoplay; encrypted-media"
              allowFullScreen
              title="TV Video"
            />
          ) : (
            <div className="flex center" style={{width:'100%', height:'100%', opacity:.6, textAlign:'center', padding:'1rem'}}>
              <div>
                Configure o vídeo no painel Admin…
                <div style={{fontSize:12, color:'var(--tv-muted)', marginTop:8}}>
                  Fonte: {sourceInfo || 'Aguardando dados do Firebase…'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="tv-footer">
        <div className="current-call">
          <div className="title">Chamando agora</div>
          <div id="current-call-name" className="name">{currentName || '—'}</div>
          <div className="title" style={{opacity:0}}>.</div>
        </div>

        <div className="called-list" aria-label="Já chamados">
          {calledList && calledList.length > 0 ? (
            calledList.map((item, idx) => (
              <div className="called-card" key={idx}>
                <div className="label">Já chamado</div>
                <div className="value">{String(item)}</div>
              </div>
            ))
          ) : (
            <div style={{marginTop:8, color:'var(--tv-muted)'}}>Sem chamados recentes…</div>
          )}
        </div>
      </div>

      <Script src="/tv-ducking.js" strategy="afterInteractive" />
    </div>
  );
}
