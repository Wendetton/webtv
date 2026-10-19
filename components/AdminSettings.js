// components/AdminSettings.js — Configurações que realmente valem para a TV da sala de espera
// config/main: announceTemplate, idleSeconds, duckVolume/restoreVolume (música durante a chamada)
import { useEffect, useState } from 'react';
import { db } from '../utils/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const DEFAULT_TEMPLATE = 'Atenção: paciente {{nome}}. Dirija-se ao consultório {{salaTxt}}.';

const box = {
  background: 'rgba(255,255,255,0.02)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 14,
  padding: 20,
};
const title = {
  fontSize: 13,
  fontWeight: 700,
  color: '#94a3b8',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 14,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};
const hint = { fontSize: 12, color: '#64748b', marginTop: 8, lineHeight: 1.5 };
const valueTag = { fontSize: 15, fontWeight: 800, minWidth: 64, textAlign: 'right' };
const code = { background: 'rgba(255,255,255,0.1)', padding: '1px 6px', borderRadius: 4 };

function exemplo(template) {
  return String(template || '')
    .replace('{{nome}}', 'Letícia Simão')
    .replace('{{sala}}', '2')
    .replace('{{salaTxt}}', 'número 2');
}

export default function AdminSettings({ onSaved }) {
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [idleSeconds, setIdleSeconds] = useState(60);
  const [musicDuringCall, setMusicDuringCall] = useState(0); // % do volume normal
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'config', 'main'));
        const d = snap.exists() ? snap.data() || {} : {};
        if (d.announceTemplate) setTemplate(String(d.announceTemplate));
        if (Number.isFinite(d.idleSeconds)) setIdleSeconds(Math.min(300, Math.max(60, Number(d.idleSeconds))));
        const duck = Number.isFinite(d.duckVolume) ? Number(d.duckVolume) : 20;
        const restore = Number.isFinite(d.restoreVolume) ? Number(d.restoreVolume) : 60;
        setMusicDuringCall(Math.round(Math.max(0, Math.min(1, duck / Math.max(1, restore))) * 100));
      } catch {
        setError('Não foi possível carregar as configurações.');
      }
    })();
  }, []);

  async function save() {
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      await setDoc(doc(db, 'config', 'main'), {
        announceTemplate: template.trim() || DEFAULT_TEMPLATE,
        idleSeconds: Number(idleSeconds),
        // A TV usa a proporção duck/restore para abaixar a música durante a voz
        duckVolume: Number(musicDuringCall),
        restoreVolume: 100,
      }, { merge: true });
      setSaved(true);
      onSaved && onSaved();
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError('Falha ao salvar. Verifique a internet.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {error && <div style={{ color: '#f87171', fontSize: 14 }}>{error}</div>}

      {/* Frase falada na chamada */}
      <section style={box}>
        <div style={title}><span>🔊</span> Frase falada na chamada</div>
        <textarea
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          rows={2}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '12px 14px',
            background: 'rgba(255,255,255,0.03)',
            border: '2px solid rgba(255,255,255,0.12)',
            borderRadius: 10,
            color: '#f8fafc',
            fontSize: 14,
            fontFamily: 'inherit',
            resize: 'vertical',
          }}
        />
        <div style={hint}>
          Exemplo: <em style={{ color: '#cbd5e1' }}>“{exemplo(template)}”</em><br />
          Use <code style={code}>{'{{nome}}'}</code> para o nome e <code style={code}>{'{{salaTxt}}'}</code> para “número 2”
          (ou <code style={code}>{'{{sala}}'}</code> para só “2”).
        </div>
      </section>

      {/* Tempo até voltar para a tela de espera */}
      <section style={box}>
        <div style={title}><span>⏱️</span> Volta para a tela de espera</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input
            type="range"
            min={60}
            max={300}
            step={15}
            value={idleSeconds}
            onChange={(e) => setIdleSeconds(Number(e.target.value))}
            style={{ flex: 1, accentColor: '#3b82f6' }}
          />
          <span style={valueTag}>
            {idleSeconds >= 120 && idleSeconds % 60 === 0 ? `${idleSeconds / 60} min` : `${idleSeconds} s`}
          </span>
        </div>
        <div style={hint}>Tempo que o último paciente chamado fica em destaque antes da TV voltar ao “Seja bem-vindo”.</div>
      </section>

      {/* Música durante a chamada */}
      <section style={box}>
        <div style={title}><span>🎵</span> Música durante a chamada</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input
            type="range"
            min={0}
            max={60}
            step={5}
            value={musicDuringCall}
            onChange={(e) => setMusicDuringCall(Number(e.target.value))}
            style={{ flex: 1, accentColor: '#3b82f6' }}
          />
          <span style={valueTag}>{musicDuringCall === 0 ? 'Silencia' : `${musicDuringCall}%`}</span>
        </div>
        <div style={hint}>Enquanto a voz chama o paciente, a música abaixa para essa porcentagem do volume normal e depois volta sozinha.</div>
      </section>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
        {saved && <span style={{ color: '#86efac', fontWeight: 700, fontSize: 14 }}>✓ Salvo</span>}
        <button
          onClick={save}
          disabled={saving}
          style={{
            padding: '13px 26px',
            background: 'linear-gradient(135deg, #5bb8d4 0%, #2563eb 100%)',
            border: 'none',
            borderRadius: 12,
            color: '#ffffff',
            fontSize: 15,
            fontWeight: 800,
            fontFamily: 'inherit',
            cursor: 'pointer',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}
