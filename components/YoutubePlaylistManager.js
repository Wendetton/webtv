// components/YoutubePlaylistManager.js — Admin: gerencia a playlist do YouTube
// Firestore: coleção 'ytPlaylist' com { url, videoId, order, createdAt }

import { useEffect, useMemo, useState } from 'react';
import { db } from '../utils/firebase';
import {
  collection, addDoc, serverTimestamp, query, orderBy, onSnapshot,
  updateDoc, doc, deleteDoc
} from 'firebase/firestore';

function extractVideoId(input) {
  const s = String(input || '').trim();

  // se já for um ID plausível (11 chars base64url), aceita
  if (/^[a-zA-Z0-9_-]{10,15}$/.test(s) && !s.includes('http')) return s;

  // padrões comuns: youtube.com/watch?v=ID, youtu.be/ID, short URLs com params
  const url = (() => { try { return new URL(s); } catch { return null; } })();
  if (!url) return null;

  // youtu.be/<id>
  if (url.hostname.includes('youtu.be')) {
    const id = url.pathname.split('/').filter(Boolean)[0];
    return id || null;
  }

  // youtube.com/watch?v=<id>
  if (url.hostname.includes('youtube.com')) {
    const v = url.searchParams.get('v');
    if (v) return v;
    // /embed/<id> ou /shorts/<id>
    const parts = url.pathname.split('/').filter(Boolean);
    const idx = parts.findIndex(p => p === 'embed' || p === 'shorts');
    if (idx >= 0 && parts[idx+1]) return parts[idx+1];
  }

  return null;
}

export default function YoutubePlaylistManager(){
  const [items, setItems] = useState([]);
  const [inputUrl, setInputUrl] = useState('');
  const [orderVal, setOrderVal] = useState(1);
  const [busy, setBusy] = useState(false);

  // Lê playlist
  useEffect(() => {
    const q = query(collection(db, 'ytPlaylist'), orderBy('order', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setItems(arr);
      const maxOrder = arr.reduce((m, it) => Math.max(m, Number(it.order)||0), 0);
      setOrderVal(maxOrder + 1);
    });
    return () => unsub();
  }, []);

  const playlistPreview = useMemo(() => items.map(x => x.videoId).filter(Boolean), [items]);

  async function addItem(){
    const videoId = extractVideoId(inputUrl);
    if (!videoId) return alert('URL ou ID de vídeo do YouTube inválido.');
    setBusy(true);
    try {
      await addDoc(collection(db, 'ytPlaylist'), {
        url: String(inputUrl).trim(),
        videoId,
        order: Number(orderVal) || 1,
        createdAt: serverTimestamp(),
      });
      setInputUrl('');
    } catch {
      alert('Não foi possível adicionar. Verifique permissões na coleção "ytPlaylist".');
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(id){
    if (!confirm('Remover este vídeo da playlist?')) return;
    try { await deleteDoc(doc(db,'ytPlaylist', id)); }
    catch { alert('Falha ao remover.'); }
  }

  async function move(id, delta){
    const it = items.find(x => x.id === id);
    if (!it) return;
    const newOrder = (Number(it.order) || 0) + delta;
    try { await updateDoc(doc(db,'ytPlaylist', id), { order: newOrder }); }
    catch { /* ignore */ }
  }

  async function saveOrder(id, value){
    try { await updateDoc(doc(db,'ytPlaylist', id), { order: Number(value)||1 }); }
    catch { alert('Falha ao salvar a ordem.'); }
  }

  // estilos básicos inline
  const card = { marginTop: 24, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, overflow: "hidden" };
  const header = { padding: "12px 14px", fontSize: 18, fontWeight: 800, background: "rgba(255,255,255,0.04)" };
  const body = { padding: 16 };
  const grid = { display: "grid", gridTemplateColumns: "2fr auto auto auto", gap: 10, alignItems: "center" };
  const input = { padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "inherit" };
  const btn = { padding: "10px 14px", borderRadius: 10, border: "none", background: "#22c55e", color: "#0b2b14", fontWeight: 800, cursor: "pointer" };
  const btnGhost = { padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "inherit", cursor: "pointer" };

  return (
    <section style={card}>
      <div style={header}>Playlist do YouTube</div>
      <div style={body}>

        {/* Adição */}
        <div style={{ display:'grid', gridTemplateColumns:'2fr 120px auto', gap:10, marginBottom:12 }}>
          <input
            placeholder="Cole aqui a URL ou o ID do vídeo (YouTube)"
            value={inputUrl}
            onChange={(e)=>setInputUrl(e.target.value)}
            style={input}
          />
          <input
            type="number" min={1} step={1}
            title="Ordem"
            value={orderVal}
            onChange={(e)=>setOrderVal(Number(e.target.value))}
            style={input}
          />
          <button onClick={addItem} disabled={busy || !inputUrl.trim()} style={btn}>
            {busy ? 'Adicionando…' : 'Adicionar vídeo'}
          </button>
        </div>

        {/* Lista */}
        <div style={{ display:'grid', gap:8 }}>
          {items.length ? items.map((it) => (
            <div key={it.id} style={{
              display:'grid', gridTemplateColumns:'60px 1fr auto auto auto', gap:10, alignItems:'center',
              border:'1px solid rgba(255,255,255,0.12)', borderRadius:8, padding:10
            }}>
              <div>
                <input
                  type="number"
                  value={Number(it.order)||1}
                  onChange={(e)=>saveOrder(it.id, e.target.value)}
                  style={{...input, width:58, padding:'8px 10px'}}
                  title="Ordem"
                />
              </div>
              <div style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                <span style={{opacity:.7, marginRight:8}}>{it.videoId}</span>
                <span title={it.url} style={{opacity:.75}}>({it.url})</span>
              </div>
              <button title="↑" onClick={()=>move(it.id, -1)} style={btnGhost}>↑</button>
              <button title="↓" onClick={()=>move(it.id, +1)} style={btnGhost}>↓</button>
              <button onClick={()=>removeItem(it.id)} style={{...btnGhost, borderColor:'rgba(255,75,75,.6)'}}>Remover</button>
            </div>
          )) : <div style={{opacity:.7}}>Nenhum vídeo na playlist ainda.</div>}
        </div>

        {/* Preview simples */}
        <div style={{marginTop:12, fontSize:12, opacity:.8}}>
          <b>Pré-visualização da sequência:</b> {playlistPreview.join(' → ') || '—'}
        </div>
      </div>
    </section>
  );
}
