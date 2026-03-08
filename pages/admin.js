// pages/admin.js - Layout Redesenhado (apenas YouTube)
import { useEffect, useState, useRef } from "react";
import { db } from "../utils/firebase";
import {
  collection, query, orderBy, limit, onSnapshot,
  doc, getDoc, setDoc, updateDoc
} from "firebase/firestore";
import CallPanel from "../components/CallPanel";
import CarouselManager from '../components/CarouselManager';
import YoutubePlaylistManager from '../components/YoutubePlaylistManager';
import AnnounceSettings from "../components/AnnounceSettings";

/* ========== ESTILOS ========== */
const styles = {
  page: {
    minHeight: "100vh",
    background: "#0a0f1a",
    color: "#f8fafc",
    fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
  },
  
  header: {
    background: "linear-gradient(180deg, rgba(17,24,39,0.98) 0%, rgba(10,15,26,0.95) 100%)",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    padding: "16px 24px",
    position: "sticky",
    top: 0,
    zIndex: 100,
    backdropFilter: "blur(12px)",
  },
  headerContent: {
    maxWidth: 1400,
    margin: "0 auto",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logoArea: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  logoIcon: {
    width: 40,
    height: 40,
    background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
    borderRadius: 10,
    display: "grid",
    placeItems: "center",
    fontSize: 20,
  },
  logoTextH1: {
    fontSize: 18,
    fontWeight: 800,
    letterSpacing: "-0.02em",
    margin: 0,
  },
  logoTextSpan: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: 500,
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: 16,
  },
  tvStatus: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 14px",
    background: "rgba(34, 197, 94, 0.1)",
    border: "1px solid rgba(34, 197, 94, 0.2)",
    borderRadius: 20,
    fontSize: 13,
    fontWeight: 600,
  },
  tvStatusDot: {
    width: 8,
    height: 8,
    background: "#22c55e",
    borderRadius: "50%",
  },
  btnConfig: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 16px",
    background: "#111827",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 10,
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  
  main: {
    maxWidth: 1400,
    margin: "0 auto",
    padding: 24,
    display: "flex",
    flexDirection: "column",
    gap: 24,
  },
  
  mediaSection: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 20,
  },
  
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.7)",
    backdropFilter: "blur(4px)",
    zIndex: 1000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.3s",
  },
  modalOverlayHidden: {
    opacity: 0,
    visibility: "hidden",
    pointerEvents: "none",
  },
  modal: {
    background: "#111827",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 20,
    width: "90%",
    maxWidth: 600,
    maxHeight: "85vh",
    overflow: "hidden",
    transform: "translateY(0) scale(1)",
    transition: "all 0.3s",
  },
  modalHidden: {
    transform: "translateY(20px) scale(0.95)",
  },
  modalHeader: {
    padding: "20px 24px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalHeaderH2: {
    fontSize: 18,
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    gap: 10,
    margin: 0,
  },
  btnClose: {
    width: 36,
    height: 36,
    display: "grid",
    placeItems: "center",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10,
    color: "#f8fafc",
    fontSize: 18,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  modalBody: {
    padding: 24,
    overflowY: "auto",
    maxHeight: "calc(85vh - 80px)",
  },
};

/* ========== COMPONENTE: Controle de Volume do YouTube ========== */
function YTLiveVolume() {
  const [val, setVal] = useState(60);
  const [saving, setSaving] = useState(false);
  const tRef = useRef(null);

  useEffect(() => {
    const ref = doc(db, "config", "control");
    const unsub = onSnapshot(ref, (snap) => {
      const d = snap.exists() ? snap.data() : {};
      if (Number.isFinite(d.ytVolume)) setVal(d.ytVolume);
    });
    return () => unsub();
  }, []);

  function push(v) {
    const ref = doc(db, "config", "control");
    window.clearTimeout(tRef.current);
    tRef.current = window.setTimeout(async () => {
      try {
        setSaving(true);
        const snap = await getDoc(ref);
        const payload = { ytVolume: v, updatedAt: Date.now() };
        if (snap.exists()) await updateDoc(ref, payload);
        else await setDoc(ref, payload, { merge: true });
      } finally {
        setSaving(false);
      }
    }, 150);
  }

  return (
    <div style={{
      background: "#111827",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 16,
      overflow: "hidden",
    }}>
      <div style={{
        padding: "14px 18px",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.02)",
        fontSize: 14,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}>
        <span>🔊</span> Volume do YouTube
      </div>
      <div style={{ padding: "16px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <input
            type="range"
            min={0}
            max={100}
            value={val}
            onChange={(e) => { const v = Number(e.target.value); setVal(v); push(v); }}
            style={{
              flex: 1,
              height: 8,
              WebkitAppearance: "none",
              background: "rgba(255,255,255,0.1)",
              borderRadius: 4,
              outline: "none",
            }}
          />
          <span style={{ fontSize: 16, fontWeight: 800, minWidth: 50, textAlign: "right" }}>
            {val}%
          </span>
        </div>
        <p style={{ marginTop: 12, fontSize: 12, color: "#94a3b8", lineHeight: 1.4 }}>
          Ajuste o volume dos vídeos do YouTube na TV.
          {saving && <span style={{ marginLeft: 8, color: "#22c55e" }}>Salvando...</span>}
        </p>
      </div>
    </div>
  );
}

/* ========== COMPONENTE PRINCIPAL ========== */
export default function Admin() {
  const [configOpen, setConfigOpen] = useState(false);

  return (
    <div style={styles.page}>
      {/* Importar fonte */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.1); }
        }
        
        .tv-dot {
          animation: pulse 2s infinite;
        }
        
        .btn-config:hover {
          background: #1a2332 !important;
          border-color: rgba(255,255,255,0.2) !important;
        }
        
        .btn-close:hover {
          background: rgba(255,255,255,0.1) !important;
        }
        
        /* Responsividade */
        @media (max-width: 900px) {
          .media-section {
            grid-template-columns: 1fr !important;
          }
        }
        
        /* Slider thumb */
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 20px;
          height: 20px;
          background: #3b82f6;
          border-radius: 50%;
          cursor: pointer;
        }
      `}</style>

      {/* ===== HEADER ===== */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <div style={styles.logoArea}>
            <div style={styles.logoIcon}>📢</div>
            <div>
              <h1 style={styles.logoTextH1}>São Peregrino</h1>
              <span style={styles.logoTextSpan}>Painel de Chamadas</span>
            </div>
          </div>
          <div style={styles.headerActions}>
            <div style={styles.tvStatus}>
              <div style={styles.tvStatusDot} className="tv-dot"></div>
              <span>TV Conectada</span>
            </div>
            <button 
              style={styles.btnConfig} 
              className="btn-config"
              onClick={() => setConfigOpen(true)}
            >
              ⚙️ Configurações
            </button>
          </div>
        </div>
      </header>

      {/* ===== MAIN ===== */}
      <main style={styles.main}>
        {/* Seção de Chamadas (topo - destaque) */}
        <CallPanel />

        {/* Seção de Mídia (inferior - 3 colunas) */}
        <section style={styles.mediaSection} className="media-section">
          <YoutubePlaylistManager />
          <YTLiveVolume />
          <CarouselManager />
        </section>
      </main>

      {/* ===== MODAL DE CONFIGURAÇÕES ===== */}
      <div 
        style={{
          ...styles.modalOverlay,
          ...(configOpen ? {} : styles.modalOverlayHidden),
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) setConfigOpen(false);
        }}
      >
        <div style={{
          ...styles.modal,
          ...(configOpen ? {} : styles.modalHidden),
        }}>
          <div style={styles.modalHeader}>
            <h2 style={styles.modalHeaderH2}>⚙️ Configurações</h2>
            <button 
              style={styles.btnClose}
              className="btn-close"
              onClick={() => setConfigOpen(false)}
            >
              ✕
            </button>
          </div>
          <div style={styles.modalBody}>
            <AnnounceSettings />
          </div>
        </div>
      </div>
    </div>
  );
}
