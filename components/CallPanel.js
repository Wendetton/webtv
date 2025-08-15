// components/CallPanel.js — Chamadas + Rechamar + Limpar + Status na TV + idle/logo (60–300s)
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
  doc,
  setDoc,
} from "firebase/firestore";

const ROOMS = ["1", "2", "3"]; // Consultório 1/2/3

export default function CallPanel(){
  // ===== Chamadas =====
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
        .filter((x) => !x.test);
      setList(items);
    });
    return () => unsub();
  }, []);

  // dispara o gatilho universal de anúncio que a TV escuta (config/announce)
  async function fireAnnounce(nome, sala, idle = false){
    try {
      await setDoc(
        doc(db, "config", "announce"),
        {
          nome: String(nome || ""),
          sala: String(sala || ""),
          idle, // true → TV mostra logo ; false → TV sai do logo
          triggeredAt: serverTimestamp(),
          nonce: Date.now() + "-" + Math.random().toString(36).slice(2), // sempre muda
        },
        { merge: true }
      );
    } catch {
      // silencioso para não travar sua operação
    }
  }

  async function callNow(n, r){
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
      });
      // garante que a TV saia do modo logo e anuncie
      await fireAnnounce(nome, sala, false);

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

  async function handleCall(){ await callNow(name, room); }

  // RECHAMAR: só dispara o anúncio; não cria nova linha no histórico
  async function handleRecallLast(){
    if (!list.length) return;
    const last = list[0];
    await fireAnnounce(String(last.nome || ""), String(last.sala || ""), false);
  }
  async function handleRecall(id){
    const item = list.find(x => x.id === id);
    if (!item) return;
    await fireAnnounce(String(item.nome || ""), String(item.sala || ""), false);
  }

  // ===== Limpeza de histórico (e força TV em logo) =====
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
      await Promise.all(snaps.docs.map(d => deleteDoc(doc(db,"calls",d.id))));
      await fireAnnounce("", "", true); // força logo na TV
      alert("Histórico de hoje limpo.");
    } catch (e) {
      alert("Não foi possível limpar (verifique permissões do Firestore).");
    }
  }

  async function clearAll(){
    if (!confirm("Limpar TODO o histórico (até 200 registros)?")) return;
    try {
      const q = query(collection(db, "calls"), orderBy("timestamp", "desc"), limit(200));
      const snaps = await getDocs(q);
      await Promise.all(snaps.docs.map(d => deleteDoc(doc(db,"calls",d.id))));
      await fireAnnounce("", "", true); // força logo na TV
      alert("Histórico limpo (até 200 registros).");
    } catch (e) {
      alert("Não foi possível limpar (verifique permissões do Firestore).");
    }
  }

  // ====== STATUS que espelha a TV ======
  const [tvHistory, setTvHistory] = useState([]);
  const [tvForcedIdle, setTvForcedIdle] = useState(false);
  const [tvLastCallAt, setTvLastCallAt] = useState(null);
  const [tvAutoIdle, setTvAutoIdle] = useState(false);
  const [tvIdleSeconds, setTvIdleSeconds] = useState(120); // NOVO: lido do config/main

  // mesmos 5 docs da TV
  useEffect(() => {
    const q = query(collection(db, "calls"), orderBy("timestamp", "desc"), limit(5));
    const unsub = onSnapshot(q, (snap) => {
      const raw = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const list = raw.filter(x => !x.test && !x.recall);
      setTvHistory(list);
      if (list.length) {
        const t = list[0].timestamp;
        const ms = t && typeof t.toMillis === "function" ? t.toMillis() : (t?.seconds ? t.seconds * 1000 : null);
        setTvLastCallAt(ms);
      } else {
        setTvLastCallAt(null);
      }
    });
    return () => unsub();
  }, []);

  // escuta o announce para saber se está idle forçado
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "config", "announce"), (snap) => {
      if (!snap.exists()) return;
      const d = snap.data() || {};
      if (typeof d.idle === "boolean") setTvForcedIdle(Boolean(d.idle));
    });
    return () => unsub();
  }, []);

  // NOVO: lê idleSeconds do config/main para usar no status
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

  // calcula auto-idle usando tvIdleSeconds
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
  const tvNow = tvIsIdle
    ? "— (Logo exibida)"
    : (tvHistory[0]?.nome ? `${tvHistory[0].nome} — Consultório ${tvHistory[0].sala}` : "—");
  const tvRecent = tvIsIdle ? tvHistory.slice(0,2) : tvHistory.slice(1,3);

  // ===== estilos =====
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
        {/* Linha de chamada */}
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

        {/* Rechamar último */}
        <div style={row}>
          <button onClick={handleRecallLast} disabled={!list.length} style={btnRecall}>
            Rechamar último
          </button>
          <span style={{opacity:.8,fontSize:12}}>O próximo chamado mantém o mesmo consultório por padrão.</span>
        </div>

        <hr style={{ margin:"14px 0", border:"none", borderTop:"1px solid rgba(255,255,255,0.12)" }} />

        {/* ===== Status na TV ===== */}
        <div style={{
          margin: "0 0 16px",
          padding: "12px 14px",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 10,
          background: "rgba(255,255,255,0.04)"
        }}>
          <div style={{fontWeight: 800, marginBottom: 6}}>Status na TV</div>
          <div style={{opacity:.95, display:"grid", gap:6}}>
            <div><b>Chamando agora:</b> {tvNow}</div>
            <div>
              <b>Chamados recentes:</b>{" "}
              {tvRecent.length
                ? tvRecent.map((h,i) => `${h.nome} — Consultório ${h.sala}`).join(" · ")
                : "—"}
            </div>
          </div>
          <div style={{marginTop:6, fontSize:12, opacity:.7}}>
            {tvIsIdle
              ? `Modo logo (sem paciente sendo exibido) • Volta ao logo em ${tvIdleSeconds}s sem novas chamadas`
              : `Exibindo paciente em chamada • Retorna ao logo após ${tvIdleSeconds}s sem novas chamadas`}
          </div>
        </div>

        {/* Lista de últimos chamados (reais) com Rechamar */}
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

        {/* Limpar histórico */}
        <div style={row}>
          <button onClick={clearToday} style={btnDanger}>Limpar histórico de HOJE</button>
          <button onClick={clearAll} style={{...btnDanger, background:"#b91c1c"}}>Limpar TUDO (máx. 200)</button>
        </div>
      </div>
    </section>
  );
}
