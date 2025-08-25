// components/AnnounceVolume.js
import { useEffect, useState } from 'react';
import { db } from '../utils/firebase';
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';

export default function AnnounceVolume(){
  const [val, setVal] = useState(90);      // padrão 90
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    const ref = doc(db, 'config', 'main');
    const unsub = onSnapshot(ref, (snap) => {
      const d = snap.exists() ? snap.data() : {};
      const v = Number.isFinite(d.announceVolume) ? Number(d.announceVolume) : 90;
      setVal(v);
    });
    return () => unsub();
  }, []);

  async function save(){
    setSaving(true); setErr(''); setSaved(false);
    const ref = doc(db, 'config', 'main');
    try{
      const snap = await getDoc(ref);
      if (snap.exists()){
        await updateDoc(ref, { announceVolume: Number(val) });
      } else {
        await setDoc(ref, { announceVolume: Number(val) }, { merge: true });
      }
      setSaved(true);
      setTimeout(()=>setSaved(false), 1500);
    }catch(e){
      setErr('Falha ao salvar. Verifique permissões do Firestore na doc config/main.');
    }finally{
      setSaving(false);
    }
  }

  const card = { marginTop: 24, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, overflow: "hidden" };
  const header = { padding: "12px 14px", fontSize: 18, fontWeight: 800, background: "rgba(255,255,255,0.04)" };
  const body = { padding: 16 };
  const row = { display:'grid', gridTemplateColumns:'1fr 90px auto', gap:10, alignItems:'center' };
  const input = { width:'100%', accentColor: 'var(--tv-accent, #44b2e7)' };
  const num = { padding:'10px 12px', borderRadius:8, border:'1px solid rgba(255,255,255,.15)', background:'rgba(255,255,255,.05)', color:'inherit' };
  const btn  = { padding:'10px 14px', borderRadius:10, border:'none', background:'#22c55e', color:'#0b2b14', fontWeight:800, cursor:'pointer' };

  return (
    <section style={card}>
      <div style={header}>Volume do anúncio</div>
      <div style={body}>
        <div style={{ marginBottom: 10, opacity:.8, fontSize:14 }}>
          Ajusta somente o volume da <b>fala do anúncio</b>. O volume do YouTube continua controlado por
          <code style={{margin:'0 6px'}}>duckVolume</code> e <code>restoreVolume</code>.
        </div>
        <div style={row}>
          <input type="range" min={0} max={100} value={val} onChange={e=>setVal(Number(e.target.value))} style={input}/>
          <input type="number" min={0} max={100} value={val} onChange={e=>setVal(Number(e.target.value))} style={num}/>
          <button onClick={save} disabled={saving} style={btn}>{saving ? 'Salvando…' : 'Salvar'}</button>
        </div>
        {saved && <div style={{marginTop:8, color:'#4ade80', fontWeight:700}}>Salvo!</div>}
        {err && <div style={{marginTop:8, color:'#f87171'}}>{err}</div>}
      </div>
    </section>
  );
}
