// components/AnnounceSettings.js - Configurações personalizadas da TV
import { useEffect, useState } from 'react';
import { db } from '../utils/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// Cores padrão baseadas na logo São Peregrino
const DEFAULT_COLORS = {
  bg: '#0a1a14',        // Fundo escuro com tom verde
  panel: '#0d2118',     // Painel escuro esverdeado
  accent: '#5cb85c',    // Verde claro da logo
  text: '#fefefe',      // Texto branco
  room: '#2d5a3d',      // Verde escuro da logo para consultório
};

export default function AnnounceSettings() {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadError, setLoadError] = useState('');

  // Frase do anúncio
  const [announceTemplate, setAnnounceTemplate] = useState('Atenção: paciente {{nome}}. Dirija-se à sala {{salaTxt}}.');

  // Personalização do Consultório
  const [roomFontSize, setRoomFontSize] = useState(100);
  const [roomColor, setRoomColor] = useState(DEFAULT_COLORS.room);

  // Tempo do carrossel
  const [carouselDuration, setCarouselDuration] = useState(7);

  // Cores do layout da TV
  const [tvBgColor, setTvBgColor] = useState(DEFAULT_COLORS.bg);
  const [tvPanelColor, setTvPanelColor] = useState(DEFAULT_COLORS.panel);
  const [tvAccentColor, setTvAccentColor] = useState(DEFAULT_COLORS.accent);
  const [tvTextColor, setTvTextColor] = useState(DEFAULT_COLORS.text);

  // Carregar config/main
  useEffect(() => {
    (async () => {
      try {
        const ref = doc(db, 'config', 'main');
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data() || {};
          if (data.announceTemplate) setAnnounceTemplate(String(data.announceTemplate));
          if (Number.isFinite(data.roomFontSize)) setRoomFontSize(Number(data.roomFontSize));
          if (data.roomColor) setRoomColor(String(data.roomColor));
          if (Number.isFinite(data.carouselDuration)) setCarouselDuration(Number(data.carouselDuration));
          if (data.tvBgColor) setTvBgColor(String(data.tvBgColor));
          if (data.tvPanelColor) setTvPanelColor(String(data.tvPanelColor));
          if (data.tvAccentColor) setTvAccentColor(String(data.tvAccentColor));
          if (data.tvTextColor) setTvTextColor(String(data.tvTextColor));
        }
      } catch (err) {
        setLoadError('Não foi possível carregar as configurações.');
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
        announceTemplate,
        roomFontSize: Number(roomFontSize),
        roomColor: String(roomColor),
        carouselDuration: Number(carouselDuration),
        tvBgColor: String(tvBgColor),
        tvPanelColor: String(tvPanelColor),
        tvAccentColor: String(tvAccentColor),
        tvTextColor: String(tvTextColor),
      }, { merge: true });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setLoadError('Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  function resetColors() {
    setTvBgColor(DEFAULT_COLORS.bg);
    setTvPanelColor(DEFAULT_COLORS.panel);
    setTvAccentColor(DEFAULT_COLORS.accent);
    setTvTextColor(DEFAULT_COLORS.text);
    setRoomColor(DEFAULT_COLORS.room);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {loadError && <div style={{ color: '#f87171', fontSize: 14, marginBottom: 12 }}>{loadError}</div>}

      {/* Frase do Anúncio */}
      <section style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>🔊</span> Frase do Anúncio
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          <label style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>Template da mensagem de voz</label>
          <textarea
            value={announceTemplate}
            onChange={(e) => setAnnounceTemplate(e.target.value)}
            rows={3}
            style={{
              padding: '14px 16px',
              background: 'rgba(255,255,255,0.03)',
              border: '2px solid rgba(255,255,255,0.12)',
              borderRadius: 10,
              color: '#f8fafc',
              fontSize: 14,
              fontFamily: 'inherit',
              resize: 'vertical',
              minHeight: 80,
            }}
          />
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            Use <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4 }}>{'{{nome}}'}</code> para o nome, 
            <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4, marginLeft: 4 }}>{'{{sala}}'}</code> para o número e 
            <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4, marginLeft: 4 }}>{'{{salaTxt}}'}</code> para "número X".
          </div>
        </div>
      </section>

      {/* Personalização do Consultório */}
      <section style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>🏥</span> Texto do Consultório
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>Tamanho da fonte</label>
            <input
              type="range"
              min={50}
              max={150}
              step={5}
              value={roomFontSize}
              onChange={(e) => setRoomFontSize(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#22c55e' }}
            />
            <div style={{ fontSize: 13, color: '#94a3b8', textAlign: 'right' }}>{roomFontSize}%</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>Cor do texto</label>
            <input
              type="color"
              value={roomColor}
              onChange={(e) => setRoomColor(e.target.value)}
              style={{
                width: '100%',
                height: 44,
                padding: 4,
                background: 'rgba(255,255,255,0.03)',
                border: '2px solid rgba(255,255,255,0.12)',
                borderRadius: 10,
                cursor: 'pointer',
              }}
            />
          </div>
        </div>
        {/* Preview */}
        <div style={{
          marginTop: 12,
          padding: 16,
          borderRadius: 10,
          background: tvPanelColor,
          border: `2px solid ${tvAccentColor}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 8,
        }}>
          <span style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Preview:</span>
          <span style={{
            fontSize: `${Math.round(24 * roomFontSize / 100)}px`,
            fontWeight: 800,
            color: roomColor,
          }}>
            Consultório 1
          </span>
        </div>
      </section>

      {/* Tempo do Carrossel */}
      <section style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>🖼️</span> Carrossel de Imagens
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>Tempo de exibição de cada imagem</label>
          <input
            type="range"
            min={3}
            max={30}
            step={1}
            value={carouselDuration}
            onChange={(e) => setCarouselDuration(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#22c55e' }}
          />
          <div style={{ fontSize: 13, color: '#94a3b8', textAlign: 'right' }}>{carouselDuration} segundos</div>
        </div>
      </section>

      {/* Cores do Layout */}
      <section style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>🎨</span> Cores do Layout da TV
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              type="color"
              value={tvBgColor}
              onChange={(e) => setTvBgColor(e.target.value)}
              style={{
                width: '100%',
                height: 44,
                padding: 4,
                background: 'rgba(255,255,255,0.03)',
                border: '2px solid rgba(255,255,255,0.12)',
                borderRadius: 10,
                cursor: 'pointer',
              }}
            />
            <span style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>Fundo</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              type="color"
              value={tvPanelColor}
              onChange={(e) => setTvPanelColor(e.target.value)}
              style={{
                width: '100%',
                height: 44,
                padding: 4,
                background: 'rgba(255,255,255,0.03)',
                border: '2px solid rgba(255,255,255,0.12)',
                borderRadius: 10,
                cursor: 'pointer',
              }}
            />
            <span style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>Painel</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              type="color"
              value={tvAccentColor}
              onChange={(e) => setTvAccentColor(e.target.value)}
              style={{
                width: '100%',
                height: 44,
                padding: 4,
                background: 'rgba(255,255,255,0.03)',
                border: '2px solid rgba(255,255,255,0.12)',
                borderRadius: 10,
                cursor: 'pointer',
              }}
            />
            <span style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>Destaque</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              type="color"
              value={tvTextColor}
              onChange={(e) => setTvTextColor(e.target.value)}
              style={{
                width: '100%',
                height: 44,
                padding: 4,
                background: 'rgba(255,255,255,0.03)',
                border: '2px solid rgba(255,255,255,0.12)',
                borderRadius: 10,
                cursor: 'pointer',
              }}
            />
            <span style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>Texto</span>
          </div>
        </div>
        {/* Preview do layout */}
        <div style={{
          marginTop: 16,
          padding: 16,
          borderRadius: 10,
          background: tvBgColor,
          border: `2px solid ${tvAccentColor}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 8,
        }}>
          <span style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>Preview do layout:</span>
          <div style={{
            background: tvPanelColor,
            padding: '12px 20px',
            borderRadius: 8,
            border: `1px solid ${tvAccentColor}`,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>CHAMANDO AGORA</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: tvTextColor }}>Maria da Silva</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: roomColor, marginTop: 4 }}>Consultório 2</div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginTop: 8 }}>
        <button
          onClick={resetColors}
          style={{
            padding: '10px 16px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 8,
            color: '#94a3b8',
            fontSize: 13,
            fontWeight: 600,
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          Restaurar cores padrão
        </button>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button
            onClick={save}
            disabled={saving}
            style={{
              padding: '14px 28px',
              background: 'linear-gradient(135deg, #5cb85c 0%, #2d5a3d 100%)',
              border: 'none',
              borderRadius: 12,
              color: '#ffffff',
              fontSize: 16,
              fontWeight: 800,
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </button>
          {saved && <span style={{ marginLeft: 12, color: '#5cb85c', fontWeight: 700, fontSize: 14 }}>✓ Salvo!</span>}
        </div>
      </div>
    </div>
  );
}
