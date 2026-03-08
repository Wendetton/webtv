// components/CarouselManager.js - Redesenhado (Card compacto)
import { useEffect, useState } from 'react';
import { db } from '../utils/firebase';
import {
  collection, addDoc, serverTimestamp, query, orderBy, onSnapshot,
  doc, deleteDoc
} from 'firebase/firestore';

const styles = {
  card: {
    background: "#111827",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    overflow: "hidden",
  },
  header: {
    padding: "14px 18px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.02)",
    fontSize: 14,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  body: {
    padding: "16px 18px",
  },
  inputRow: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 8,
    marginBottom: 12,
  },
  input: {
    padding: "10px 12px",
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 8,
    color: "#f8fafc",
    fontSize: 13,
    fontFamily: "inherit",
    outline: "none",
    minWidth: 0,
  },
  btnAdd: {
    padding: "10px 14px",
    background: "#3b82f6",
    border: "none",
    borderRadius: 8,
    color: "white",
    fontSize: 13,
    fontWeight: 700,
    fontFamily: "inherit",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  list: {
    display: "grid",
    gap: 6,
    maxHeight: 150,
    overflowY: "auto",
  },
  item: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 10px",
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 6,
    fontSize: 12,
    gap: 8,
  },
  itemId: {
    fontWeight: 600,
    color: "#94a3b8",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    minWidth: 0,
  },
  btnRemove: {
    padding: "4px 8px",
    background: "rgba(239, 68, 68, 0.1)",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    borderRadius: 4,
    color: "#ef4444",
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
};

export default function CarouselManager() {
  const [items, setItems] = useState([]);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'carousel'), orderBy('order', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setItems(arr);
    });
    return () => unsub();
  }, []);

  async function addItem() {
    const u = url.trim();
    if (!u) return alert('Informe a URL da midia.');
    setBusy(true);
    try {
      const maxOrder = items.reduce((m, it) => Math.max(m, Number(it.order) || 0), 0);
      const isVideo = /\.(mp4|webm|ogg)$/i.test(u);
      await addDoc(collection(db, 'carousel'), {
        url: u,
        kind: isVideo ? 'video' : 'image',
        durationSec: 7,
        order: maxOrder + 1,
        createdAt: serverTimestamp(),
      });
      setUrl('');
    } catch {
      alert('Falha ao adicionar item.');
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(id) {
    if (!confirm('Remover este item?')) return;
    try { await deleteDoc(doc(db, 'carousel', id)); }
    catch { alert('Falha ao remover.'); }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && url.trim()) {
      addItem();
    }
  }

  function getFileName(fullUrl) {
    try {
      const pathname = new URL(fullUrl).pathname;
      const parts = pathname.split('/');
      return parts[parts.length - 1] || fullUrl;
    } catch {
      return fullUrl;
    }
  }

  return (
    <>
      <style>{`
        .carousel-input:focus {
          border-color: #3b82f6 !important;
        }
        .carousel-btn-add:hover:not(:disabled) {
          background: #2563eb !important;
        }
        .carousel-btn-remove:hover {
          background: rgba(239, 68, 68, 0.2) !important;
        }
      `}</style>

      <div style={styles.card}>
        <div style={styles.header}>
          <span>🖼️</span> Carrossel
        </div>
        <div style={styles.body}>
          <div style={styles.inputRow}>
            <input
              type="text"
              placeholder="URL da imagem ou video"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              style={styles.input}
              className="carousel-input"
            />
            <button
              onClick={addItem}
              disabled={busy || !url.trim()}
              style={{
                ...styles.btnAdd,
                opacity: busy || !url.trim() ? 0.5 : 1,
              }}
              className="carousel-btn-add"
            >
              {busy ? '...' : 'Adicionar'}
            </button>
          </div>
          <div style={styles.list}>
            {items.length ? items.map((it) => (
              <div key={it.id} style={styles.item}>
                <span style={styles.itemId}>
                  [{it.kind === 'video' ? 'video' : 'img'}] {getFileName(it.url)}
                </span>
                <button
                  onClick={() => removeItem(it.id)}
                  style={styles.btnRemove}
                  className="carousel-btn-remove"
                >
                  Remover
                </button>
              </div>
            )) : (
              <div style={{ opacity: 0.7, fontSize: 12 }}>Nenhum item no carrossel.</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
