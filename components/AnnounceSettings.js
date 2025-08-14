/* components/AnnounceSettings.js — Painel de configurações do anúncio (para usar dentro de /admin)
   - Salva em Firestore: doc('config','main')
   - Campos: announceMode, voiceTemplate, duckVolume, restoreVolume, leadMs, highlightColor
   - Botão "Testar anúncio": cria um doc em 'calls' com {test:true} (TV fala mas não mostra no histórico)
*/
import { useEffect, useState } from 'react';
import { db } from '../utils/firebase';
import {
  doc, getDoc, setDoc, updateDoc, collection, getDocs, addDoc, serverTimestamp
} from 'firebase/firestore';

const DEFAULTS = {
  announceMode: 'auto', // 'auto' | 'fully' | 'web' | 'beep'
  voiceTemplate: 'Atenção: paciente {{nome}}. Por favor, dirija-se ao consultório{{salaTxt}}.',
  duckVolume: 20,
  restoreVolume: 60,
  leadMs: 450,
  highlightColor: '#44b2e7',
};

export default function AnnounceSettings(){
  const [loading, setLoading] = useState(true);
  const [cfgId, setCfgId] = useState('main');
  const [form, setForm] = useState(DEFAULTS);
  const [testName, setTestName] = useState('Fulano de Tal');
  const [testSala, setTestSala] = useState('1');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function boot(){
      setLoading(true);
      // tenta 'config/main'; se não existir, usa o primeiro doc de 'config'
      let ref = doc(db, 'config', 'main');
      let snap = await getDoc(ref);
      if (!snap.exists()) {
        const snapAll = await getDocs(collection(db, 'config'));
        if (!snapAll.empty) {
          ref = doc(db, 'config', snapAll.docs[0].id);
          snap = await getDoc(ref);
          setCfgId(ref.id);
        } else {
          // cria config inicial
          await setDoc(ref, DEFAULTS, { merge: true });
          snap = await getDoc(ref);
          setCfgId('main');
        }
      } else {
        setCfgId('main');
      }
      const data = snap.data() || {};
      setForm({ ...DEFAULTS, ...data });
      setLoading(false);
    }
    boot();
  }, []);

  async function save(){
    setSaving(true);
    try {
      const ref = doc(db, 'config', cfgId);
      await setDoc(ref, {
        announceMode: form.announceMode,
        voiceTemplate: form.voiceTemplate,
        duckVolume: Number(form.duckVolume) || 0,
        restoreVolume: Number(form.restoreVolume) || 0,
        leadMs: Number(form.leadMs) || 0,
        highlightColor: form.highlightColor || DEFAULTS.highlightColor,
      }, { merge: true });
      setSaved(true);
      setTimeout(()=> setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function test(){
    setTesting(true);
    try {
      await addDoc(collection(db, 'calls'), {
        nome: testName,
        sala: testSala,
        timestamp: serverTimestamp(),
        test: true,
      });
    } finally {
      setTesting(false);
    }
  }

  if (loading) return <div style={boxStyle}><b>Carregando configurações…</b></div>;

  return (
    <div style={wrapStyle}>
      <h2 style={{margin:'0 0 12px'}}>Configurações do anúncio</h2>

      <div style={gridStyle}>
        <label style={labelStyle}>
          Modo de anúncio
          <select
            value={form.announceMode}
            onChange={e=> setForm(f=> ({...f, announceMode: e.target.value}))}
            style={inputStyle}
          >
            <option value="auto">Automático (Fully → Voz do navegador → Beep)</option>
            <option value="fully">Forçar Fully TTS</option>
            <option value="web">Forçar Voz do navegador</option>
            <option value="beep">Forçar Beep</option>
          </select>
        </label>

        <label style={labelStyle}>
          Frase do anúncio
          <input
            type="text"
            value={form.voiceTemplate}
            onChange={e=> setForm(f=> ({...f, voiceTemplate: e.target.value}))}
            style={inputStyle}
            placeholder="Atenção: paciente {{nome}}. Dirija-se à sala {{sala}}."
          />
          <small style={hintStyle}>Use: {'{{nome}}'}, {'{{sala}}'} ou {'{{salaTxt}}'}</small>
        </label>

        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12}}>
          <label style={labelStyle}>
            Volume durante anúncio
            <input type="number" min="0" max="100" value={form.duckVolume}
              onChange={e=> setForm(f=>({...f, duckVolume: e.target.value}))}
              style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Volume normal
            <input type="number" min="0" max="100" value={form.restoreVolume}
              onChange={e=> setForm(f=>({...f, restoreVolume: e.target.value}))}
              style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Antecedência (ms)
            <input type="number" min="0" max="3000" value={form.leadMs}
              onChange={e=> setForm(f=>({...f, leadMs: e.target.value}))}
              style={inputStyle} />
          </label>
        </div>

        <label style={labelStyle}>
          Cor de destaque
          <input type="color" value={form.highlightColor}
            onChange={e=> setForm(f=> ({...f, highlightColor: e.target.value}))}
            style={{...inputStyle, padding:0, height:44}} />
        </label>
      </div>

      <div style={{display:'flex', gap:12, marginTop:12}}>
        <button onClick={save} disabled={saving} style={btnPrimary}>
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
        {saved && <span style={{color:'#4ade80', fontWeight:700'}}>Salvo!</span>}
      </div>

      <hr style={{margin:'18px 0', border:'none', borderTop:'1px solid rgba(255,255,255,0.15)'}} />

      <h3 style={{margin:'0 0 8px'}}>Testar anúncio</h3>
      <div style={{display:'flex', gap:12, flexWrap:'wrap'}}>
        <input
          type="text" value={testName} onChange={e=> setTestName(e.target.value)}
          placeholder="Nome do paciente"
          style={{...inputStyle, minWidth:240}}
        />
        <input
          type="text" value={testSala} onChange={e=> setTestSala(e.target.value)}
          placeholder="Sala"
          style={{...inputStyle, width:140}}
        />
        <button onClick={test} disabled={testing} style={btn}>
          {testing ? 'Testando…' : 'Testar anúncio'}
        </button>
        <small style={hintStyle}>O teste fala na TV, mas **não** entra no histórico (a TV ignora itens com <code>test:true</code>).</small>
      </div>
    </div>
  );
}

const wrapStyle = { border:'1px solid rgba(255,255,255,0.15)', borderRadius:12, padding:16, marginTop:16, background:'rgba(255,255,255,0.03)' };
const gridStyle = { display:'grid', gap:12 };
const labelStyle = { display:'grid', gap:6, fontWeight:700 };
const inputStyle = { background:'rgba(0,0,0,0.35)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, padding:'10px 12px', color:'#fff' };
const btnPrimary = { background:'#3b82f6', color:'#fff', border:'0', borderRadius:10, padding:'10px 16px', fontWeight:800 };
const btn = { background:'rgba(255,255,255,0.1)', color:'#fff', border:'0', borderRadius:10, padding:'10px 16px', fontWeight:800 };
const boxStyle = { padding:16, border:'1px dashed rgba(255,255,255,0.3)', borderRadius:12 };
const hintStyle = { color:'#93a0b3' };
