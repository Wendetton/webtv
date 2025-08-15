// components/AnnounceSettings.js — Configurações do anúncio (com idleSeconds 60–300)
// 2025-08-15
import { useEffect, useState } from 'react';
import { db } from '../utils/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export default function AnnounceSettings() {
  const [open, setOpen] = useState(false);           // painel recolhível
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadError, setLoadError] = useState('');

  // campos
  const [announceMode, setAnnounceMode] = useState('auto'); // auto | beep | off (seu tv-ducking usa 'auto'/'beep')
  const [announceTemplate, setAnnounceTemplate] = useState('Atenção: paciente {{nome}}. Dirija-se à sala {{salaTxt}}.');
  const [duckVolume, setDuckVolume] = useState(20);      // 0–100
  const [restoreVolume, setRestoreVolume] = useState(60);// 0–100
  const [leadMs, setLeadMs] = useState(450);             // ms
  const [accentColor, setAccentColor] = useState('#44b2e7');
  const [idleSeconds, setIdleSeconds] = useState(120);   // NOVO: 60–300

  // carregar config/main
  useEffect(() => {
    (async () => {
      try {
        const ref = doc(db, 'config', 'main');
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data() || {};
          if (data.announceMode) setAnnounceMode(String(data.announceMode));
          if (data.announceTemplate) setAnnounceTemplate(String(data.announceTemplate));
          if (Number.isFinite(data.duckVolume)) setDuckVolume(Number(data.duckVolume));
          if (Number.isFinite(data.restoreVolume)) setRestoreVolume(Number(data.restoreVolume));
          if (Number.isFinite(data.leadMs)) setLeadMs(Number(data.leadMs));
          if (data.accentColor) setAccentColor(String(data.accentColor));
          if (Number.isFinite(data.idleSeconds)) setIdleSeconds(Math.min(300, Math.max(60, Number(data.idleSeconds))));
        }
      } catch (err) {
        setLoadError('Não foi possível carregar as configurações (verifique as permissões do Firestore).');
      }
    })();
  }, []);

  async function save() {
    setSaving(true);
    setSaved(false);
    setLoadError('');
    try {
      const ref = doc(db, 'config', 'main');
      await setDoc(ref, {
        announceMode,
        announceTemplate,
        duckVolume: Number(duckVolume),
        restoreVolume: Number(restoreVolume),
        leadMs: Number(leadMs),
        accentColor: String(accentColor),
        idleSeconds: Math.min(300, Math.max(60, Number(idleSeconds))), // clamp 60–300
      }, { merge: true });
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (err) {
      setLoadError('Falha ao salvar (verifique permissões do Firestore).');
    } finally {
      setSaving(false);
    }
  }

  // estilos simples
  const wrap = { marginTop: 24, border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, overflow: 'hidden' };
  const header = { padding: '12px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer', background:'rgba(255,255,255,0.04)', fontWeight:800 };
  const body = { padding: 16, display: open ? 'block' : 'none' };
  const grid2 = { display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 };
  const row = { display:'grid', gap:6, marginBottom:12 };
  const input = { padding:'10px 12px', borderRadius:8, border:'1px solid rgba(255,255,255,0.15)', background:'rgba(255,255,255,0.05)', color:'inherit' };
  const btnPrimary = { padding:'10px 14px', borderRadius:10, border:'none', background:'#22c55e', color:'#0b2b14', fontWeight:800, cursor:'pointer' };

  return (
    <section style={wrap}>
      <div style={header} onClick={() => setOpen(!open)}>
        <span>Configurações do anúncio</span>
        <span style={{opacity:.7, fontSize:13}}>{open ? 'recolher ▲' : 'expandir ▼'}</span>
      </div>

      <div style={body}>
        {loadError && <div style={{color:'#f87171', marginBottom:10}}>{loadError}</div>}

        {/* Linha 1: modo + cor */}
        <div style={grid2}>
          <div style={row}>
            <label>Modo de anúncio</label>
            <select value={announceMode} onChange={e=>setAnnounceMode(e.target.value)} style={input}>
              <option value="auto">Automático (voz + beep, ducking)</option>
              <option value="beep">Som simples (beep)</option>
              <option value="off">Sem som</option>
            </select>
          </div>
          <div style={row}>
            <label>Cor de destaque (TV)</label>
            <input type="color" value={accentColor} onChange={e=>setAccentColor(e.target.value)} style={{...input, padding:'6px'}} />
          </div>
        </div>

        {/* Template */}
        <div style={row}>
          <label>Frase do anúncio (template)</label>
          <textarea
            value={announceTemplate}
            onChange={(e) => setAnnounceTemplate(e.target.value)}
            rows={3}
            style={{...input, fontFamily:'inherit'}}
          />
          <div style={{opacity:.8, fontSize:12}}>
            Use <code>{'{{nome}}'}</code>, <code>{'{{sala}}'}</code> e <code>{'{{salaTxt}}'}</code>.
            Ex.: Atenção: paciente <b>{'{{nome}}'}</b>. Dirija-se à sala <b>{'{{sala}}'}</b>.
          </div>
        </div>

        {/* Linha 2: volumes */}
        <div style={grid2}>
          <div style={row}>
            <label>Volume do vídeo durante o anúncio (ducking)</label>
            <input type="range" min={0} max={100} value={duckVolume} onChange={e=>setDuckVolume(Number(e.target.value))} />
            <div style={{fontSize:12, opacity:.8}}>{duckVolume}%</div>
          </div>
          <div style={row}>
            <label>Volume do vídeo após o anúncio</label>
            <input type="range" min={0} max={100} value={restoreVolume} onChange={e=>setRestoreVolume(Number(e.target.value))} />
            <div style={{fontSize:12, opacity:.8}}>{restoreVolume}%</div>
          </div>
        </div>

        {/* Linha 3: lead e idle */}
        <div style={grid2}>
          <div style={row}>
            <label>Antecipação do ducking (ms)</label>
            <input type="number" min={0} max={2000} step={50} value={leadMs} onChange={e=>setLeadMs(Number(e.target.value))} style={input} />
          </div>

          {/* NOVO: tempo para voltar ao logo */}
          <div style={row}>
            <label>Tempo para voltar ao logo (segundos)</label>
            <input type="range" min={60} max={300} step={10} value={idleSeconds} onChange={e=>setIdleSeconds(Number(e.target.value))} />
            <div style={{fontSize:12, opacity:.8}}>{idleSeconds} s</div>
          </div>
        </div>

        <div style={{marginTop:8}}>
          <button onClick={save} disabled={saving} style={btnPrimary}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
          {saved && <span style={{marginLeft:10, color:'#4ade80', fontWeight:700}}>Salvo!</span>}
        </div>
      </div>
    </section>
  );
}
