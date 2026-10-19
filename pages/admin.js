// pages/admin.js - Painel de chamadas da sala de espera
// Em destaque: chamar paciente, o que está na TV e últimos chamados.
// Embaixo, recolhida: música ambiente e volume. Engrenagem: configurações da voz e da TV.
import { useEffect, useState } from "react";
import { db } from "../utils/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import CallPanel from "../components/CallPanel";
import MusicManager from "../components/MusicManager";
import AdminSettings from "../components/AdminSettings";

// A TV avisa a cada minuto (config/tvStatus.lastSeen); passou disso com folga, está sem sinal
const TV_ONLINE_MS = 150 * 1000;

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
    padding: "14px 24px",
    position: "sticky",
    top: 0,
    zIndex: 100,
    backdropFilter: "blur(12px)",
  },
  headerContent: {
    maxWidth: 1040,
    margin: "0 auto",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
  },
  logoArea: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  logoBadge: {
    width: 42,
    height: 42,
    borderRadius: 11,
    background: "#ffffff",
    display: "grid",
    placeItems: "center",
  },
  logoImg: {
    width: 32,
    height: "auto",
  },
  logoTitle: {
    fontSize: 18,
    fontWeight: 800,
    letterSpacing: "-0.02em",
  },
  logoText: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: 500,
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  tvPill: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 14px",
    borderRadius: 20,
    fontSize: 13,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  tvDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
  },
  btnConfig: {
    padding: "9px 14px",
    background: "#111827",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10,
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  main: {
    maxWidth: 1040,
    margin: "0 auto",
    padding: 24,
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.7)",
    backdropFilter: "blur(4px)",
    zIndex: 200,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    transition: "opacity 0.3s, visibility 0.3s",
  },
  modalOverlayHidden: {
    opacity: 0,
    visibility: "hidden",
    pointerEvents: "none",
  },
  modal: {
    background: "#111827",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 20,
    width: "100%",
    maxWidth: 620,
    maxHeight: "90vh",
    overflow: "auto",
    transition: "transform 0.3s",
  },
  modalHidden: {
    transform: "scale(0.95)",
  },
  modalHeader: {
    padding: "18px 24px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    position: "sticky",
    top: 0,
    background: "#111827",
    zIndex: 1,
  },
  modalHeaderH2: {
    fontSize: 18,
    fontWeight: 800,
    margin: 0,
  },
  btnClose: {
    width: 36,
    height: 36,
    background: "rgba(255,255,255,0.05)",
    border: "none",
    borderRadius: 8,
    color: "#94a3b8",
    fontSize: 18,
    cursor: "pointer",
    display: "grid",
    placeItems: "center",
  },
  modalBody: {
    padding: 24,
  },
};

/* ========== Indicador real de TV ligada ========== */
function TvStatusPill() {
  const [lastSeen, setLastSeen] = useState(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "config", "tvStatus"), (snap) => {
      const t = snap.exists() ? snap.data().lastSeen : null;
      setLastSeen(t && typeof t.toMillis === "function" ? t.toMillis() : null);
    }, () => {});
    const tick = setInterval(() => setNow(Date.now()), 15000);
    return () => { unsub(); clearInterval(tick); };
  }, []);

  const online = lastSeen && now - lastSeen < TV_ONLINE_MS;
  let label = "TV sem sinal";
  if (online) label = "TV ligada";
  else if (lastSeen) {
    const min = Math.round((now - lastSeen) / 60000);
    label = min < 60 ? `TV sem sinal há ${min} min` : "TV desligada";
  }

  return (
    <div
      style={{
        ...styles.tvPill,
        background: online ? "rgba(34, 197, 94, 0.1)" : "rgba(148, 163, 184, 0.08)",
        border: `1px solid ${online ? "rgba(34, 197, 94, 0.35)" : "rgba(148, 163, 184, 0.25)"}`,
        color: online ? "#86efac" : "#94a3b8",
      }}
      title={online ? "A tela da sala de espera está aberta e recebendo as chamadas" : "A tela da sala de espera não deu sinal recentemente"}
    >
      <div
        style={{ ...styles.tvDot, background: online ? "#22c55e" : "#64748b" }}
        className={online ? "tv-dot" : undefined}
      />
      <span>{label}</span>
    </div>
  );
}

/* ========== COMPONENTE PRINCIPAL ========== */
export default function Admin() {
  const [configOpen, setConfigOpen] = useState(false);

  return (
    <div style={styles.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.1); }
        }
        .tv-dot { animation: pulse 2s infinite; }
        .btn-config:hover {
          background: #1a2332 !important;
          border-color: rgba(255,255,255,0.2) !important;
        }
        .btn-close:hover { background: rgba(255,255,255,0.1) !important; }

        @media (max-width: 640px) {
          .admin-logo-text { display: none; }
        }

        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 20px;
          height: 20px;
          background: #3b82f6;
          border-radius: 50%;
          cursor: pointer;
        }
      `}</style>

      {/* ===== TOPO ===== */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <div style={styles.logoArea}>
            <div style={styles.logoBadge}>
              <img src="/logo-simbolo-cores.png" alt="" style={styles.logoImg} />
            </div>
            <div>
              <div style={styles.logoTitle}>Oftalmocenter</div>
              <div style={styles.logoText} className="admin-logo-text">Painel de Chamadas</div>
            </div>
          </div>
          <div style={styles.headerActions}>
            <TvStatusPill />
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

      {/* ===== CORPO ===== */}
      <main style={styles.main} className="admin-main">
        <CallPanel />
        <MusicManager />
      </main>

      {/* ===== CONFIGURAÇÕES ===== */}
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
            <AdminSettings onSaved={() => setTimeout(() => setConfigOpen(false), 900)} />
          </div>
        </div>
      </div>
    </div>
  );
}
