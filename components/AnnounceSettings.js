// components/AnnounceSettings.js — colapsável (expandir ao clicar) — 2025-08-13
import { useEffect, useState } from "react";
import { db } from "../utils/firebase";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
  query,
  limit,
} from "firebase/firestore";

export default function AnnounceSettings() {
  // estado de visibilidade (colapsado por padrão)
  const [isOpen, setIsOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");

  // estados de configuração
  const [announceMode, setAnnounceMode] = useState("auto"); // auto | fully | web | beep
  const [announceTemplate, setAnnounceTemplate] = useState(
    "Atenção: paciente {{nome}}. Dirija-se à sala {{salaTxt}}."
  );
  const [duckVolume, setDuckVolume] = useState(20);
  const [restoreVolume, setRestoreVolume] = useState(60);
  const [leadMs, setLeadMs] = useState(450);
  const [accentColor, setAccentColor] = useState("#44b2e7");

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // teste
  const [testName, setTestName] = useState("");
  const [testRoom, setTestRoom] = useState("");

  // restaura estado aberto/fechado da última vez
  useEffect(() => {
    try {
      const v = localStorage.getItem("admin_announce_open");
      if (v === "1") setIsOpen(true);
    } catch {}
  }, []);

  // carrega config apenas quando abrir pela primeira vez
  useEffect(() => {
    async function load() {
      try {
        setLoadError("");
        let data = null;

        // tenta doc fixo "main"
        const mainRef = doc(db, "config", "main");
        const mainSnap = await getDoc(mainRef);
        if (mainSnap.exists()) data = mainSnap.data();

        // se não houver, pega o primeiro da coleção
        if (!data) {
          const colRef = collection(db, "config");
          const q = query(colRef, limit(1));
          const qs = await getDocs(q);
          qs.forEach((d) => { data = d.data(); });
        }

        if (data) {
          if (data.announceMode) setAnnounceMode(String(data.announceMode));
          if (data.announceTemplate) setAnnounceTemplate(String(data.announceTemplate));
          if (Number.isFinite(data.duckVolume)) setDuckVolume(Number(data.duckVolume));
          if (Number.isFinite(data.restoreVolume)) setRestoreVolume(Number(data.restoreVolume));
          if (Number.isFinite(data.leadMs)) setLeadMs(Number(data.leadMs));
          if (data.accentColor) setAccentColor(String(data.accentColor));
        }
        setLoaded(true);
      } catch (err) {
        setLoadError("Não foi possível carregar as configurações (verifique as permissões do Firestore).");
        setLoaded(true);
      }
    }
    if (isOpen && !loaded) load();
  }, [isOpen, loaded]);

  function toggleOpen(){
    const v = !isOpen;
    setIsOpen(v);
    try { localStorage.setItem("admin_announce_open", v ? "1" : "0"); } catch {}
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const ref = doc(db, "config", "main");
      await setDoc(
        ref,
        {
          announceMode,
          announceTemplate,
          duckVolume: Number(duckVolume),
          restoreVolume: Number(restoreVolume),
          leadMs: Number(leadMs),
          accentColor,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      alert("Erro ao salvar. Verifique se o Firestore permite escrita no doc config/main.");
    } finally {
      setSaving(false);
    }
  }

  async function testAnnounce() {
    const nome = (testName || "").trim();
    const sala = (testRoom || "").trim();
    if (!nome) return;
    try {
      await addDoc(collection(db, "calls"), {
        nome,
        sala,
        timestamp: serverTimestamp(),
        test: true,
      });
      setTestName("");
      setTestRoom("");
    } catch (e) {
      alert("Erro ao criar teste. Verifique as permissões de escrita em 'calls'.");
    }
  }

  // estilos
  const card = { marginTop: 24, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, overflow: "hidden" };
  const header = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", cursor: "pointer", background: "rgba(255,255,255,0.04)" };
  const hTitle = { fontSize: 16, fontWeight: 800 };
  const caret = { transition: "transform .2s" };
  const body = { padding: 16 };
  const row = { display: "grid", gap: 12, gridTemplateColumns: "1fr", marginBottom: 14 };
  const label = { fontWeight: 700, fontSize: 14 };
  const input = { padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "inherit" };
  const small = { color: "#93a0b3", fontSize: 12, marginTop: 4 };
  const btnRow = { display: "flex", gap: 12, alignItems: "center", marginTop: 8 };
  const btnPrimary = { padding: "10px 14px", borderRadius: 10, border: "none", background: "#2563eb", color: "#fff", fontWeight: 800, cursor: "pointer" };
  const btnTest = { ...btnPrimary, background: "#0ea5e9" };

  return (
    <section style={card}>
      {/* Cabeçalho clicável */}
      <div style={header} onClick={toggleOpen} role="button" aria-expanded={isOpen} aria-controls="announce-settings">
        <div style={hTitle}>Configurações do anúncio</div>
        <div style={{...caret, transform: isOpen ? "rotate(90deg)" : "rotate(0deg)"}}>▶</div>
      </div>

      {/* Corpo (só aparece quando aberto) */}
      {isOpen && (
        <div id="announce-settings" style={body}>
          {!loaded && <div style={{...small}}>Carregando…</div>}
          {loadError && <div style={{...small, color:"#f87171"}}>{loadError}</div>}

          {/* Modo */}
          <div style={row}>
            <label style={label}>Modo do anúncio</label>
            <select value={announceMode} onChange={(e) => setAnnounceMode(e.target.value)} style={input}>
              <option value="auto">Automático (Fully → Voz do navegador → Beep)</option>
              <option value="fully">Fully TTS (recomendado no Fire TV)</option>
              <option value="web">Voz do navegador</option>
              <option value="beep">Beep</option>
            </select>
            <div style={small}>
              No Fire TV com Fully, ative <b>Settings → Advanced Web Settings → Enable JavaScript Interface (PLUS)</b> para o modo Fully funcionar.
            </div>
          </div>

          {/* Template */}
          <div style={row}>
            <label style={label}>Frase do anúncio</label>
            <textarea rows={2} value={announceTemplate} style={{ ...input, resize: "vertical" }} onChange={(e) => setAnnounceTemplate(e.target.value)} />
            <div style={small}>
              Use <code>{'{{nome}}'}</code>, <code>{'{{sala}}'}</code> e <code>{'{{salaTxt}}'}</code>.{" "}
              Ex.: Atenção: paciente <b>{'{{nome}}'}</b>. Dirija-se à sala <b>{'{{sala}}'}</b>.
            </div>
          </div>

          {/* Volumes */}
          <div style={row}>
            <label style={label}>Volume durante anúncio (duck)</label>
            <input type="number" min={0} max={100} value={duckVolume} onChange={(e) => setDuckVolume(e.target.value)} style={input} />
            <div style={small}>0 a 100. Valor menor = YouTube mais baixo durante o anúncio.</div>
          </div>

          <div style={row}>
            <label style={label}>Volume normal (restore)</label>
            <input type="number" min={0} max={100} value={restoreVolume} onChange={(e) => setRestoreVolume(e.target.value)} style={input} />
            <div style={small}>0 a 100. Volume a ser restaurado após o anúncio.</div>
          </div>

          {/* Antecedência */}
          <div style={row}>
            <label style={label}>Antecedência (ms) antes do anúncio</label>
            <input type="number" min={0} max={3000} value={leadMs} onChange={(e) => setLeadMs(e.target.value)} style={input} />
            <div style={small}>Tempo (em milissegundos) que o YouTube fica baixo antes de iniciar a fala.</div>
          </div>

          {/* Cor */}
          <div style={row}>
            <label style={label}>Cor do destaque (nome piscando)</label>
            <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} style={{ ...input, padding: 0, height: 44 }} />
          </div>

          {/* Ações */}
          <div style={btnRow}>
            <button onClick={save} disabled={saving} style={btnPrimary}>
              {saving ? "Salvando..." : "Salvar"}
            </button>
            {saved && <span style={{ color: "#4ade80", fontWeight: 700 }}>Salvo!</span>}
          </div>

          <hr style={{ margin: "18px 0", border: "none", borderTop: "1px solid rgba(255,255,255,0.15)" }} />

          {/* Teste */}
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>Testar anúncio (não entra no histórico)</div>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "2fr 1fr auto" }}>
            <input placeholder="Nome do paciente" value={testName} onChange={(e) => setTestName(e.target.value)} style={input} />
            <input placeholder="Sala" value={testRoom} onChange={(e) => setTestRoom(e.target.value)} style={input} />
            <button onClick={testAnnounce} style={btnTest}>Testar</button>
          </div>
          <div style={small}>A TV fala, mas esse registro vem marcado como <code>test: true</code> (a TV ignora no histórico).</div>
        </div>
      )}
    </section>
  );
}
