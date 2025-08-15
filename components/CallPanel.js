// components/CallPanel.js — chama/REchama disparando config/announce (não polui histórico)
// 2025-08-15
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
  where,
  deleteDoc,
  doc as docRef,
  setDoc,
} from "firebase/firestore";

const ROOMS = ["1", "2", "3"]; // Consultório 1/2/3

export default function CallPanel(){
  const [name, setName] = useState("");
  const [room, setRoom] = useState(ROOMS[0]);
  const [busy, setBusy] = useState(false);
  const [list, setList] = useState([]); // últimos chamados (reais)

  // restaura último consultório utilizado
  useEffect(() => {
    try {
      const last = localStorage.getItem("last_consultorio");
      if (last && ROOMS.includes(last)) setRoom(last);
    } catch {}
  }, []);

  // assina os últimos 8 chamados (exclui testes)
  useEffect(() => {
    const q = query(collection(db, "calls"), orderBy("timestamp", "desc"), limit(8));
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((x) => !x.test); // a TV filtra recall na exibição; aqui mostramos todos
      setList(items);
    });
    return () => unsub();
  }, []);

  // dispara o gatilho de anúncio que a TV escuta
  async function fireAnnounce(nome, sala){
    try {
      await setDoc(
        docRef(db, "config", "announce"),
        {
          nome: String(nome || ""),
          sala: String(sala || ""),
          triggeredAt: serverTimestamp(),
          nonce: Date.now() + "-" + Math.random().toString(36).slice(2), // sempre muda
        },
        { merge: true }
      );
    } catch (e) {
      alert("Erro ao acionar anúncio. Verifique permissão de escrita em config/announce.");
    }
  }

  async function callNow(n, r, extra = {}){
    const nome = (n || "").trim();
    const sala = (r || "").trim();
    if (!nome) return;
    setBusy(true);
    try {
      // grava no histórico
      await addDoc(collection(db, "calls"), {
        nome,
        sala,
        timestamp: serverTimestamp(),
        ...extra, // ex.: { recall:true } — NÃO usamos para rechamar
      });
      // dispara o anúncio (garante áudio na TV)
      await fireAnnounce(nome, sala);

      // guarda consultório para a próxima chamada
      try { localStorage.setItem("last_consultorio", sala); } catch {}
      setRoom(sala);
      setName("");
    } catch (e) {
      alert("Erro ao chamar. Verifique permissões de escrita na coleção 'calls'.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCall(){
    await callNow(name, room);
  }

  // RECHAMAR: só dispara o anúncio; não grava nada novo no histórico
  async function handleRecallLast(){
    if (!list.length) return;
    const last = list[0]; // último real
    await fireAnnounce(String(last.nome || ""), String(last.sala || ""));
  }

  async function handleRecall(id){
    const item = list.find(x => x.id === id);
    if (!item) return;
    await fireAnnounce(String(item.nome || ""), String(item.sala || ""));
  }

  // limpeza de hoje
  async function clearToday(){
    if (!confirm("Limpar histórico de HOJE? Isso não pode ser desfeito.")) return;
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // 00:00 local
    try {
      const q = query(
        collection(db, "calls"),
        where("timestamp", ">=", start),
        orderBy("timestamp", "desc"),
        limit(200)
      );
      const snaps = await getDocs(q);
      const ids = snaps.docs.map(d => d.id);
      await Promise.all(ids.map(id => deleteDoc(docRef(db,"calls",id))));
      alert("Histórico de hoje limpo.");
    } catch (e) {
      alert("Não foi possível limpar (verifique permissões do Firestore).");
    }
  }

  // limpeza total (limitada)
  async function clearAll(){
    if (!confirm("Limpar TODO o histórico (até 200 registros)?")) return;
    try {
      const q = query(collection(db, "calls"), orderBy("timestamp", "desc"), limit(200));
      const snaps = await getDocs(q);
      const ids = snaps.docs.map(d => d.id);
      await Promise.all(ids.map(id => deleteDoc(docRef(db,"calls",id))));
      alert("Histórico limpo (até 200 registros).");
    } catch (e) {
      alert("Não foi possível limpar (verifique permissões do Firestore).");
    }
  }

  // estilos
  const card = { marginTop: 24, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, overflow: "hidden" };
  const header = { padding: "12px 14px", fontSize: 18, fontWeight: 800, background: "rgba(255,255,255,0.04)" };
  const body = { padding: 16 };
  const grid = { display: "grid", gap: 12, gridTemplateColumns: "2fr 1fr auto" };
  const input = { padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "inherit" };
  const sel = input;
  const btn = { padding: "10px 14px", borderRadius: 10, border: "none", background: "#22c55e", color: "#0b2b14", fontWeight: 800, cursor: "pointer" };
  const row = { display: "flex", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap" };
  const btnRecall = { ...btn, background: "#f59e0b", color: "#1f1500" };
  const btnDanger = { ...btn, background: "#ef4444", color:"#fff" };
  const listWrap = { marginTop: 12, display:"grid", gap:8 };

  return (
    <section style={card}>
      <div style={header}>Chamadas (Consultório)</div>
      <div style={body}>
        <div style={grid}>
          <input
            placeholder="Nome do paciente"
            value={name}
            onChange={e=>setName(e.target.value)}
            style={input}
          />
          <select value={room} onChange={e=>setRoom(e.target.value)} style={sel}>
            {ROOMS.map(r => (
              <option key={r} value={r}>{`Consultório ${r}`}</option>
            ))}
          </select>
          <button onClick={handleCall} disabled={busy || !name.trim()} style={btn}>
            {busy ? "Chamando..." : "Chamar paciente"}
          </button>
        </div>

        <div style={row}>
          <button onClick={handleRecallLast} disabled={!list.length} style={btnRecall}>
            Rechamar último
          </button>
          <span style={{opacity:.8,fontSize:12}}>O próximo chamado mantém o mesmo consultório por padrão.</span>
        </div>

        <hr style={{ margin:"14px 0", border:"none", borderTop:"1px solid rgba(255,255,255,0.12)" }} />

        <div style={{ fontWeight:800, marginBottom:8 }}>Últimos chamados</div>
        <div style={listWrap}>
          {list.length ? list.map((it)=> (
            <div key={it.id} style={{display:"grid", gridTemplateColumns:"1fr auto", gap:8, alignItems:"center"}}>
              <div>
                <b>{it.nome}</b> — Consultório {String(it.sala || "")}
              </div>
              <button onClick={()=>handleRecall(it.id)} style={btnRecall}>Rechamar</button>
            </div>
          )) : <div style={{opacity:.7}}>Ainda não há chamados.</div>}
        </div>

        <hr style={{ margin:"14px 0", border:"none", borderTop:"1px solid rgba(255,255,255,0.12)" }} />

        <div style={row}>
          <button onClick={clearToday} style={btnDanger}>Limpar histórico de HOJE</button>
          <button onClick={clearAll} style={{...btnDanger, background:"#b91c1c"}}>Limpar TUDO (máx. 200)</button>
        </div>
      </div>
    </section>
  );
}
