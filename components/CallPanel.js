// components/CallPanel.js - Redesenhado com rechamar corrigido
import { useEffect, useState } from "react";
import { db } from "../utils/firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
  deleteDoc,
  doc,
  setDoc,
} from "firebase/firestore";

const ROOMS = ["1", "2", "3"];

/* ========== ESTILOS ========== */
const styles = {
  card: {
    background: "#111827",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 20,
    overflow: "hidden",
  },
  header: {
    background: "linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(34, 197, 94, 0.05) 100%)",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    padding: "20px 24px",
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  headerIcon: {
    width: 48,
    height: 48,
    background: "#22c55e",
    borderRadius: 12,
    display: "grid",
    placeItems: "center",
    fontSize: 24,
    boxShadow: "0 4px 20px rgba(34, 197, 94, 0.3)",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 800,
    margin: 0,
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 2,
  },
  body: {
    padding: 24,
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  inputGroup: {
    display: "grid",
    gridTemplateColumns: "1fr auto auto",
    gap: 12,
  },
  input: {
    padding: "18px 20px",
    background: "rgba(255,255,255,0.03)",
    border: "2px solid rgba(255,255,255,0.12)",
    borderRadius: 14,
    color: "#f8fafc",
    fontSize: 20,
    fontWeight: 600,
    fontFamily: "inherit",
    transition: "all 0.2s",
    outline: "none",
  },
  select: {
    padding: "18px 20px",
    background: "rgba(255,255,255,0.03)",
    border: "2px solid rgba(255,255,255,0.12)",
    borderRadius: 14,
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: "pointer",
    minWidth: 170,
  },
  btnCall: {
    padding: "18px 36px",
    background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
    border: "none",
    borderRadius: 14,
    color: "#052e16",
    fontSize: 18,
    fontWeight: 800,
    fontFamily: "inherit",
    cursor: "pointer",
    transition: "all 0.2s",
    boxShadow: "0 4px 20px rgba(34, 197, 94, 0.3)",
    whiteSpace: "nowrap",
  },
  btnCallDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
  tvPreview: {
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 14,
    padding: "16px 20px",
  },
  tvPreviewHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    fontSize: 13,
    fontWeight: 700,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  tvPreviewRow: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  tvPreviewLabel: {
    color: "#94a3b8",
    fontWeight: 600,
    fontSize: 12,
  },
  tvPreviewValue: {
    fontWeight: 700,
    fontSize: 15,
  },
  historySection: {
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 14,
    padding: "16px 20px",
  },
  historyHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  historyTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    margin: 0,
  },
  historyList: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: 8,
  },
  historyItem: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    alignItems: "center",
    gap: 12,
    padding: "12px 14px",
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10,
    transition: "all 0.2s",
  },
  historyItemInfo: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },
  historyItemName: {
    fontWeight: 700,
    fontSize: 13,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  historyItemRoom: {
    fontSize: 12,
    color: "#94a3b8",
    whiteSpace: "nowrap",
  },
  btnRecall: {
    padding: "8px 14px",
    background: "rgba(245, 158, 11, 0.1)",
    border: "1px solid rgba(245, 158, 11, 0.3)",
    borderRadius: 8,
    color: "#f59e0b",
    fontSize: 13,
    fontWeight: 700,
    fontFamily: "inherit",
    cursor: "pointer",
    transition: "all 0.2s",
    whiteSpace: "nowrap",
  },
  clearSection: {
    paddingTop: 16,
    borderTop: "1px solid rgba(255,255,255,0.08)",
  },
  btnClear: {
    padding: "12px 20px",
    background: "rgba(239, 68, 68, 0.1)",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    borderRadius: 10,
    color: "#ef4444",
    fontSize: 14,
    fontWeight: 700,
    fontFamily: "inherit",
    cursor: "pointer",
    transition: "all 0.2s",
  },
};

export default function CallPanel() {
  const [name, setName] = useState("");
  const [room, setRoom] = useState(ROOMS[0]);
  const [busy, setBusy] = useState(false);
  const [list, setList] = useState([]);

  // Status da TV
  const [tvHistory, setTvHistory] = useState([]);
  const [tvForcedIdle, setTvForcedIdle] = useState(false);
  const [tvLastCallAt, setTvLastCallAt] = useState(null);
  const [tvAutoIdle, setTvAutoIdle] = useState(false);
  const [tvIdleSeconds, setTvIdleSeconds] = useState(120);

  // Restaura ultimo consultorio
  useEffect(() => {
    try {
      const last = localStorage.getItem("last_consultorio");
      if (last && ROOMS.includes(last)) setRoom(last);
    } catch {}
  }, []);

  // Lista ultimos chamados
  useEffect(() => {
    const q = query(collection(db, "calls"), orderBy("timestamp", "desc"), limit(8));
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((x) => !x.test);
      setList(items);
    });
    return () => unsub();
  }, []);

  // Status TV - historico
  useEffect(() => {
    const q = query(collection(db, "calls"), orderBy("timestamp", "desc"), limit(5));
    const unsub = onSnapshot(q, (snap) => {
      const raw = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const filtered = raw.filter(x => !x.test);
      setTvHistory(filtered);
      if (filtered.length) {
        const t = filtered[0].timestamp;
        const ms = t && typeof t.toMillis === "function" ? t.toMillis() : (t?.seconds ? t.seconds * 1000 : null);
        setTvLastCallAt(ms);
      } else {
        setTvLastCallAt(null);
      }
    });
    return () => unsub();
  }, []);

  // Status TV - idle forcado
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "config", "announce"), (snap) => {
      if (!snap.exists()) return;
      const d = snap.data() || {};
      if (typeof d.idle === "boolean") setTvForcedIdle(Boolean(d.idle));
    });
    return () => unsub();
  }, []);

  // Status TV - tempo idle
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "config", "main"), (snap) => {
      if (!snap.exists()) return;
      const d = snap.data() || {};
      if (Number.isFinite(d.idleSeconds)) {
        setTvIdleSeconds(Math.min(300, Math.max(60, Number(d.idleSeconds))));
      }
    });
    return () => unsub();
  }, []);

  // Verifica auto idle
  useEffect(() => {
    const tick = () => {
      if (!tvLastCallAt) { setTvAutoIdle(false); return; }
      setTvAutoIdle(Date.now() - tvLastCallAt >= tvIdleSeconds * 1000);
    };
    tick();
    const t = setInterval(tick, 5000);
    return () => clearInterval(t);
  }, [tvLastCallAt, tvIdleSeconds]);

  const tvIsIdle = tvForcedIdle || tvAutoIdle || tvHistory.length === 0;
  
  // Logica para agrupar chamadas simultaneas (igual a TV)
  const GROUP_WINDOW_MS = 30000;
  const DUAL_KEEP_MS = 60000;
  
  let currentGroup = [];
  if (!tvIsIdle && tvHistory.length) {
    const first = tvHistory[0];
    const firstMs = first.timestamp?.toMillis?.() || (first.timestamp?.seconds ? first.timestamp.seconds * 1000 : null);
    if (firstMs != null) {
      const second = tvHistory[1];
      if (second) {
        const secondMs = second.timestamp?.toMillis?.() || (second.timestamp?.seconds ? second.timestamp.seconds * 1000 : null);
        const isPair = secondMs != null && (firstMs - secondMs) <= GROUP_WINDOW_MS;
        const keepDual = isPair && (Date.now() - secondMs) < DUAL_KEEP_MS;
        currentGroup = (isPair && keepDual) ? [first, second] : [first];
      } else {
        currentGroup = [first];
      }
    }
  }
  
  // Texto do "Chamando agora" - mostra todos os pacientes do grupo
  const tvNow = tvIsIdle
    ? "- (Logo exibida)"
    : currentGroup.length > 1
      ? currentGroup.map(p => `${p.nome} - Cons. ${p.sala}`).join("  |  ")
      : (currentGroup[0]?.nome ? `${currentGroup[0].nome} - Consultório ${currentGroup[0].sala}` : "-");

  // Dispara anuncio
  async function fireAnnounce(nome, sala, idle = false) {
    try {
      await setDoc(
        doc(db, "config", "announce"),
        {
          nome: String(nome || ""),
          sala: String(sala || ""),
          idle,
          triggeredAt: serverTimestamp(),
          nonce: Date.now() + "-" + Math.random().toString(36).slice(2),
        },
        { merge: true }
      );
    } catch {}
  }

  // Chamar paciente
  async function handleCall() {
    const nome = (name || "").trim();
    const sala = (room || "").trim();
    if (!nome) return;
    setBusy(true);
    try {
      await addDoc(collection(db, "calls"), {
        nome,
        sala,
        timestamp: serverTimestamp(),
      });
      await fireAnnounce(nome, sala, false);
      try { localStorage.setItem("last_consultorio", sala); } catch {}
      setRoom(sala);
      setName("");
    } catch (e) {
      alert("Erro ao chamar. Verifique permissões de escrita.");
    } finally {
      setBusy(false);
    }
  }

  // Rechamar - adiciona nova entrada no historico para TV atualizar
  async function handleRecall(id) {
    const item = list.find(x => x.id === id);
    if (!item) return;
    const nome = String(item.nome || "").trim();
    const sala = String(item.sala || "").trim();
    if (!nome) return;
    
    try {
      // Adiciona nova entrada no historico para a TV atualizar o display
      await addDoc(collection(db, "calls"), {
        nome,
        sala,
        timestamp: serverTimestamp(),
        recall: true,
      });
      // Dispara o anuncio de voz
      await fireAnnounce(nome, sala, false);
    } catch (e) {
      alert("Erro ao rechamar.");
    }
  }

  // Limpar historico
  async function handleClearHistory() {
    if (!confirm("Limpar TODO o histórico de chamadas? Isso não pode ser desfeito.")) return;
    try {
      const q = query(collection(db, "calls"), orderBy("timestamp", "desc"), limit(200));
      const snaps = await getDocs(q);
      await Promise.all(snaps.docs.map(d => deleteDoc(doc(db, "calls", d.id))));
      await fireAnnounce("", "", true);
      alert("Histórico limpo com sucesso.");
    } catch (e) {
      alert("Não foi possível limpar (verifique permissões).");
    }
  }

  // Handler Enter
  function handleKeyDown(e) {
    if (e.key === "Enter" && name.trim()) {
      handleCall();
    }
  }

  return (
    <>
      <style>{`
        .call-input:focus {
          border-color: #22c55e !important;
          background: rgba(34, 197, 94, 0.05) !important;
          box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.3) !important;
        }
        .btn-call:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(34, 197, 94, 0.4);
        }
        .btn-call:active:not(:disabled) {
          transform: translateY(0);
        }
        .btn-recall:hover {
          background: rgba(245, 158, 11, 0.2) !important;
        }
        .btn-clear:hover {
          background: rgba(239, 68, 68, 0.2) !important;
        }
        .history-item:hover {
          background: rgba(255,255,255,0.04) !important;
          border-color: rgba(255,255,255,0.12) !important;
        }
        .call-select option {
          background: #1f2937;
          color: #f8fafc;
        }
        @media (max-width: 700px) {
          .call-input-group {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      <section style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerIcon}>📢</div>
          <div>
            <h2 style={styles.headerTitle}>Chamar Paciente</h2>
            <p style={styles.headerSubtitle}>Digite o nome e selecione o consultório</p>
          </div>
        </div>

        <div style={styles.body}>
          {/* Input de chamada */}
          <div style={styles.inputGroup} className="call-input-group">
            <input
              type="text"
              placeholder="Nome do paciente"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              style={styles.input}
              className="call-input"
            />
            <select
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              style={styles.select}
              className="call-select"
            >
              {ROOMS.map(r => (
                <option key={r} value={r}>Consultório {r}</option>
              ))}
            </select>
            <button
              onClick={handleCall}
              disabled={busy || !name.trim()}
              style={{
                ...styles.btnCall,
                ...(busy || !name.trim() ? styles.btnCallDisabled : {}),
              }}
              className="btn-call"
            >
              {busy ? "Chamando..." : "Chamar Paciente"}
            </button>
          </div>

          {/* Status na TV */}
          <div style={styles.tvPreview}>
            <div style={styles.tvPreviewHeader}>
              <span>📺</span> Status na TV
            </div>
            <div style={styles.tvPreviewRow}>
              <span style={styles.tvPreviewLabel}>Chamando agora:</span>
              <span style={{...styles.tvPreviewValue, marginTop: 4}}>{tvNow}</span>
            </div>
          </div>

          {/* Historico */}
          <div style={styles.historySection}>
            <div style={styles.historyHeader}>
              <h3 style={styles.historyTitle}>Últimos chamados</h3>
            </div>
            <div style={styles.historyList}>
              {list.length ? list.map((it) => (
                <div key={it.id} style={styles.historyItem} className="history-item">
                  <div style={styles.historyItemInfo}>
                    <span style={styles.historyItemName}>{it.nome}</span>
                    <span style={styles.historyItemRoom}>Consultório {it.sala}</span>
                  </div>
                  <button
                    onClick={() => handleRecall(it.id)}
                    style={styles.btnRecall}
                    className="btn-recall"
                  >
                    Rechamar
                  </button>
                </div>
              )) : (
                <div style={{ opacity: 0.7, fontSize: 14 }}>Ainda não há chamados.</div>
              )}
            </div>
          </div>

          {/* Limpar historico */}
          <div style={styles.clearSection}>
            <button
              onClick={handleClearHistory}
              style={styles.btnClear}
              className="btn-clear"
            >
              🗑️ Limpar Histórico
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
