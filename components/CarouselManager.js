// components/CarouselManager.js — Gerencia itens do carrossel (imagens e vídeos) no Admin
import { useEffect, useState } from 'react';
import { db } from '../utils/firebase';
import {
  collection, addDoc, serverTimestamp, query, orderBy, onSnapshot,
  updateDoc, doc, deleteDoc
} from 'firebase/firestore';

export default function CarouselManager(){
  const [items, setItems] = useState([]);
  const [url, setUrl] = useState('');
  const [kind, setKind] = useState('image'); // image | video
  const [durationSec, setDurationSec] = useState(7);
  const [orderVal, setOrderVal] = useState(1);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'carousel'), orderBy('order','asc'));
    const unsub = onSnapshot(q, (snap) => {
      const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setItems(arr);
      const maxOrder = arr.reduce((m, it) => Math.max(m, Number(it.order)||0), 0);
      setOrderVal(maxOrder + 1);
    });
    return () => unsub();
  }, []);

  async function addItem(){
    const u = url.trim();
    if (!u) return alert('Informe a URL da mídia.');
    setBusy(true);
    try {
      await addDoc(collection(db,'carousel'), {
        url: u,
        kind,
        durationSec: Number(durationSec) || null,
        order: Number(orderVal) || 1,
        createdAt: serverTimestamp(),
      });
      setUrl('');
    } catch {
      alert('Falha ao adicionar item. Verifique permissões na coleção "carousel".');
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(id){
    if (!confirm('Remover este item do carrossel?')) return;
    try { await deleteDoc(doc(db,'carousel', id)); }
    catch { alert('Falha ao remover.'); }
  }

  async function move(id, delta){
    const it = items.find(x => x.id === id);
    if (!it) return;
    const newOrder = (Number(it.order) || 0) + delta;
    try { await updateDoc(doc(db,'carousel', id), { order: newOrder }); }
    catch { /* ignore */ }
  }

  async function saveRow(id, patch){
    try { await updateDoc(doc(db,'carousel', id), patch); }
    catch { alert('Falha ao salvar.'); }
  }

  // ===== estilos =====
  const card = { marginTop: 24, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, overflow: "hidden" };
  const header = { padding: "12px 14px", fontSize: 18, fontWeight: 800, background: "rgba(255,255,255,0.04)" };
  const body = { padding: 16 };
  const grid2 = { display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr auto', gap:10, alignItems:'center' };
  const input = { padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "inherit" };
  const btn = { padding: "10px 14px", borderRadius: 10, border: "none", background: "#22c55e", color: "#0b2b14", fontWeight: 800, cursor: "pointer" };
  const btnGhost = { padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "inherit", cursor: "pointer" };

  return (
    <section style={card}>
      <div style={header}>Carrossel (imagens e vídeos mudos)</div>
      <div style={body}>

        {/* Form de adição */}
        <div style={{...grid2, marginBottom:12}}>
          <input
            placeholder="URL da mídia (JPG, PNG, MP4, WEBM...)"
            value={url}
            onChange={(e)=>setUrl(e.target.value)}
            style={{...input, gridColumn:'1 / span 1'}}
          />
          <select value={kind} onChange={e=>setKind(e.target.value)} style={input}>
            <option value="image">Imagem</option>
            <option value="video">Vídeo (sem som)</option>
          </select>
          <input
            type="number" min={1} max={60} step={1}
            title="Duração (segundos)"
            value={durationSec}
            onChange={(e)=>setDurationSec(Number(e.target.value))}
            style={input}
          />
          <input
            type="number" min={1} step={1}
            title="Ordem"
            value={orderVal}
            onChange={(e)=>setOrderVal(Number(e.target.value))}
            style={input}
          />
          <button onClick={addItem} disabled={busy} style={btn}>
            {busy ? 'Adicionando…' : 'Adicionar'}
          </button>
        </div>

        {/* Tabela simples de itens */}
        <div style={{ display:'grid', gap:8 }}>
          {items.length ? items.map((it) => (
            <div key={it.id} style={{
              display:'grid',
              gridTemplateColumns:'auto 1fr auto auto auto auto',
              gap:10, alignItems:'center',
              border:'1px solid rgba(255,255,255,0.12)', borderRadius:8, padding:10
            }}>
              <div style={{opacity:.8, fontWeight:700, width:28, textAlign:'right'}}>{it.order ?? '—'}</div>
              <div style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                <span style={{opacity:.7, marginRight:8}}>[{it.kind || 'image'}]</span>
                <span title={it.url}>{it.url}</span>
              </div>
              <button title="↑" onClick={()=>move(it.id, -1)} style={btnGhost}>↑</button>
              <button title="↓" onClick={()=>move(it.id, +1)} style={btnGhost}>↓</button>
              <button onClick={()=>saveRow(it.id, { durationSec: (Number(it.durationSec)||DEFAULT_IMAGE_SEC) })} style={btnGhost}>Salvar duração</button>
              <button onClick={()=>removeItem(it.id)} style={{...btnGhost, borderColor:'rgba(255,75,75,.6)'}}>Remover</button>
            </div>
          )) : <div style={{opacity:.7}}>Nenhum item no carrossel ainda.</div>}
        </div>
      </div>
    </section>
  );
}
