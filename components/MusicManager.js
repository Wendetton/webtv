// components/MusicManager.js — Músicas ambiente da sala de espera (upload para o Firebase Storage)
// Coleção "musicPlaylist": { title, url, path, size, order, createdAt }
import { useEffect, useRef, useState } from 'react';
import { db, storage } from '../utils/firebase';
import {
  collection, addDoc, serverTimestamp, query, orderBy, onSnapshot,
  doc, deleteDoc, updateDoc
} from 'firebase/firestore';
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';

const BIG_FILE_MB = 150;

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
    justifyContent: "space-between",
    gap: 8,
  },
  headerInfo: {
    fontSize: 11,
    fontWeight: 600,
    color: "#94a3b8",
  },
  body: {
    padding: "16px 18px",
  },
  btnAdd: {
    width: "100%",
    padding: "11px 14px",
    background: "#3b82f6",
    border: "none",
    borderRadius: 8,
    color: "white",
    fontSize: 13,
    fontWeight: 700,
    fontFamily: "inherit",
    cursor: "pointer",
    marginBottom: 12,
  },
  progressWrap: {
    marginBottom: 12,
    fontSize: 12,
    color: "#94a3b8",
  },
  progressBar: {
    marginTop: 6,
    height: 6,
    borderRadius: 3,
    background: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  list: {
    display: "grid",
    gap: 6,
    maxHeight: 190,
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
  itemTitle: {
    fontWeight: 600,
    color: "#e2e8f0",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    minWidth: 0,
    cursor: "pointer",
  },
  itemSize: {
    color: "#64748b",
    fontWeight: 500,
    marginLeft: 6,
  },
  actions: {
    display: "flex",
    gap: 4,
    flexShrink: 0,
  },
  btnSmall: {
    padding: "4px 7px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 4,
    color: "#cbd5e1",
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
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
  empty: {
    padding: "14px 10px",
    textAlign: "center",
    fontSize: 12,
    color: "#64748b",
  },
  hint: {
    marginTop: 10,
    fontSize: 11,
    color: "#64748b",
    lineHeight: 1.45,
  },
};

function fmtMB(bytes) {
  if (!Number.isFinite(bytes)) return '';
  return `${(bytes / (1024 * 1024)).toFixed(bytes > 100 * 1024 * 1024 ? 0 : 1)} MB`;
}

function titleFromFile(name) {
  return String(name || '')
    .replace(/\.[^.]+$/, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'Música';
}

export default function MusicManager() {
  const [items, setItems] = useState([]);
  const [uploading, setUploading] = useState(null); // { name, pct, index, total }
  const fileRef = useRef(null);

  useEffect(() => {
    const q = query(collection(db, 'musicPlaylist'), orderBy('order', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  function uploadOne(file, index, total) {
    return new Promise((resolve, reject) => {
      const safe = file.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.\- ]+/g, '');
      const path = `musicas/${Date.now()}-${safe}`;
      const task = uploadBytesResumable(storageRef(storage, path), file, {
        contentType: file.type || 'audio/mpeg',
        cacheControl: 'public, max-age=31536000',
      });
      task.on('state_changed',
        (snap) => setUploading({ name: file.name, index, total, pct: Math.round((snap.bytesTransferred / snap.totalBytes) * 100) }),
        reject,
        async () => {
          try {
            const url = await getDownloadURL(task.snapshot.ref);
            await addDoc(collection(db, 'musicPlaylist'), {
              title: titleFromFile(file.name),
              url,
              path,
              size: file.size,
              order: Date.now(),
              createdAt: serverTimestamp(),
            });
            resolve();
          } catch (e) { reject(e); }
        });
    });
  }

  async function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    const big = files.filter(f => f.size > BIG_FILE_MB * 1024 * 1024);
    if (big.length && !confirm(
      `${big.length} arquivo(s) com mais de ${BIG_FILE_MB} MB. Vai funcionar, mas o envio demora e a TV gasta mais internet.\n` +
      'Dica: exporte em MP3 128 kbps (1 hora ≈ 55 MB).\n\nEnviar mesmo assim?'
    )) return;
    try {
      for (let i = 0; i < files.length; i++) {
        await uploadOne(files[i], i + 1, files.length);
      }
    } catch (err) {
      alert('Não foi possível enviar a música. Verifique a internet e tente de novo.');
    } finally {
      setUploading(null);
    }
  }

  async function handleRemove(item) {
    if (!confirm(`Remover "${item.title}" da sala de espera?`)) return;
    try {
      await deleteDoc(doc(db, 'musicPlaylist', item.id));
      if (item.path) { try { await deleteObject(storageRef(storage, item.path)); } catch {} }
    } catch {
      alert('Erro ao remover.');
    }
  }

  async function handleRename(item) {
    const t = prompt('Nome da música (aparece discretamente na TV):', item.title || '');
    if (t == null) return;
    const title = t.trim();
    if (!title) return;
    try { await updateDoc(doc(db, 'musicPlaylist', item.id), { title }); } catch { alert('Erro ao renomear.'); }
  }

  async function move(index, dir) {
    const j = index + dir;
    if (j < 0 || j >= items.length) return;
    const a = items[index], b = items[j];
    try {
      await Promise.all([
        updateDoc(doc(db, 'musicPlaylist', a.id), { order: b.order }),
        updateDoc(doc(db, 'musicPlaylist', b.id), { order: a.order }),
      ]);
    } catch { alert('Erro ao reordenar.'); }
  }

  const totalSize = items.reduce((acc, x) => acc + (Number(x.size) || 0), 0);

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <span>🎵 Músicas ambiente</span>
        <span style={styles.headerInfo}>
          {items.length} faixa{items.length === 1 ? '' : 's'}{totalSize ? ` · ${fmtMB(totalSize)}` : ''}
        </span>
      </div>
      <div style={styles.body}>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*,.mp3,.m4a,.aac,.ogg"
          multiple
          style={{ display: 'none' }}
          onChange={handleFiles}
        />
        <button
          style={{ ...styles.btnAdd, opacity: uploading ? 0.6 : 1 }}
          disabled={!!uploading}
          onClick={() => fileRef.current && fileRef.current.click()}
        >
          {uploading ? 'Enviando...' : '+ Adicionar músicas'}
        </button>

        {uploading && (
          <div style={styles.progressWrap}>
            {uploading.total > 1 ? `(${uploading.index}/${uploading.total}) ` : ''}{uploading.name} — {uploading.pct}%
            <div style={styles.progressBar}>
              <div style={{ width: `${uploading.pct}%`, height: '100%', background: '#3b82f6', transition: 'width .3s' }} />
            </div>
          </div>
        )}

        <div style={styles.list}>
          {items.length === 0 ? (
            <div style={styles.empty}>Nenhuma música ainda. Envie arquivos MP3 para tocar na sala de espera.</div>
          ) : items.map((it, i) => (
            <div key={it.id} style={styles.item}>
              <span style={styles.itemTitle} title="Clique para renomear" onClick={() => handleRename(it)}>
                {it.title}
                <span style={styles.itemSize}>{fmtMB(it.size)}</span>
              </span>
              <span style={styles.actions}>
                <button style={styles.btnSmall} onClick={() => move(i, -1)} disabled={i === 0} title="Subir">↑</button>
                <button style={styles.btnSmall} onClick={() => move(i, 1)} disabled={i === items.length - 1} title="Descer">↓</button>
                <button style={styles.btnRemove} onClick={() => handleRemove(it)}>Remover</button>
              </span>
            </div>
          ))}
        </div>
        <p style={styles.hint}>
          As músicas tocam em sequência com transição suave e abaixam sozinhas durante a chamada do paciente.
        </p>
      </div>
    </div>
  );
}
