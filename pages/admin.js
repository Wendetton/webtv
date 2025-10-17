// pages/admin.js
import AnnounceSettings from "../components/AnnounceSettings";
import { useEffect, useState, useRef } from "react";
import { db } from "../utils/firebase";
import {
  collection, query, orderBy, limit, onSnapshot,
  doc, getDoc, setDoc, updateDoc
} from "firebase/firestore";
import YoutubeConfig from "../components/YoutubeConfig";
import PatientHistory from "../components/PatientHistory";
import PatientCall from "../components/PatientCall";
import ImageUploader from "../components/ImageUploader";
import CallPanel from "../components/CallPanel";
import CarouselManager from '../components/CarouselManager';
import YoutubePlaylistManager from '../components/YoutubePlaylistManager';

/** Card para controlar o volume do YouTube em tempo real (salva em config/control.ytVolume) */
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
    <section style={{ marginTop: 16, border: "1px solid rgba(255,255,255,.12)", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "12px 14px", fontWeight: 800, background: "rgba(255,255,255,0.05)" }}>
        Volume do YouTube (ao vivo)
      </div>
      <div style={{ padding: 14, display: "grid", gridTemplateColumns: "1fr 90px", gap: 12, alignItems: "center" }}>
        <input
          type="range" min={0} max={100} value={val}
          onChange={(e) => { const v = Number(e.target.value); setVal(v); push(v); }}
          style={{ width: "100%" }}
        />
        <input
          type="number" min={0} max={100} value={val}
          onChange={(e) => { const v = Math.max(0, Math.min(100, Number(e.target.value) || 0)); setVal(v); push(v); }}
          style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,.15)", background: "rgba(255,255,255,.05)", color: "inherit" }}
        />
        {saving && <div style={{ gridColumn: "1 / -1", fontSize: 12, opacity: .7 }}>enviando…</div>}
      </div>
      <div style={{ padding: "0 14px 12px", fontSize: 12, opacity: .75 }}>
        Dica: 0 = mudo. Em alguns Fire TV o volume fino é limitado pelo dispositivo; aqui controlamos o player real.
      </div>
    </section>
  );
}

export default function Admin() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "calls"), orderBy("timestamp", "desc"), limit(10));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      setHistory(querySnapshot.docs.map(doc => doc.data()));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div style={{ maxWidth: 700, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h2>Painel Administrativo</h2>

      <CallPanel />

      {/* Gerenciador de playlist do YouTube */}
      <YoutubePlaylistManager />

      {/* NOVO: Volume do YouTube em tempo real */}
      <YTLiveVolume />

      <CarouselManager />
      <AnnounceSettings />

      {/* (opcional) pode exibir o histórico aqui se quiser */}
      {/* <PatientHistory history={history} loading={loading} /> */}
    </div>
  );
}
