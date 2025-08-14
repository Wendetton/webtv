// components/AnnounceSettings.js
// Configurações do anúncio (modo, frase, volumes, atraso) + teste
import { useEffect, useState } from "react";
import { db } from "../utils/firebase";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
  limit,
  query,
} from "firebase/firestore";

const container = {
  marginTop: 24,
  padding: 16,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.03)",
};

const row = { display: "grid", gridTemplateColumns: "220px 1fr", gap: 12, alignItems: "center", margin: "10px 0" };
const label = { fontWeight: 700 };
const input = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(0,0,0,0.2)",
  color: "#fff",
};
const select = input;
const small = { color: "#93a0b3", fontSize: 12 };
const btnRow = { display: "flex", gap: 10, alignItems: "center", marginTop: 12 };
const btnPrimary = {
  cursor: "pointer",
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "linear-gradient(180deg, rgba(68,178,231,0.25), rgba(68,178,231,0.15))",
  color: "#fff",
  fontWeight: 800,
};
const btnSecondary = {
  cursor: "pointer",
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
  fontWeight: 800,
};

const MODES = [
  { value: "auto", label: "Automático (Fully → Web → Beep)" },
  { value: "fully", label: "Forçar Fully TTS" },
  { value: "web", label: "Forçar Voz do navegador" },
  { value: "beep", label: "Forçar Beep" },
];

export default function AnnounceSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // valores
  const [announceMode, setAnnounceMode] = useState("auto");
  const [announceTemplate, setAnnounceTemplate] = useState("Atenção: paciente {{nome}}. Por favor, dirija-se ao consultório{{salaTxt}}.");
  const [duckVolume, setDuckVolume] = useState(20);    // 0..100
  const [restoreVolume, setRestoreVolume] = useState(60); // 0..100
  const [leadMs, setLeadMs] = useState(450); // antes de falar
  const [accentColor, setAccentColor] = useState("#44b2e7");

  // teste
  const [testNome, setTestNome] = useState("");
  const [testSala, setTestSala] = useState("");

  useEffect(() => {
    async function load() {
      try {
        // tenta /config/main
        const mainRef = doc(db, "config", "main");
        const snap = await getDoc(mainRef);

        let data = snap.exists() ? snap.data() : null;
        if (!data) {
          // fallback: primeiro doc da coleção config
          const q = query(collection(db, "config"), limit(1));
          const qs = await getDocs(q);
          if (!qs.empty) data = qs.docs[0].data();
        }

        if (data) {
          if (data.announceMode) setAnnounceMode(String(data.announceMode));
          if (data.announceTemplate) setAnnounceTemplate(String(data.announceTemplate));
          if (Number.isFinite(data.duckVolume)) setDuckVolume(Number(data.duckVolume));
          if (Number.isFinite(data.restoreVolume)) setRestoreVolume(Number(data.restoreVolume));
          if (Number.isFinite(data.leadMs)) setLeadMs(Number(data.leadMs));
          if (data.accentColor) setAccentColor(String(data.accentColor));
        }
      } catch (e) {
        console.error("Erro ao carregar config:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function save() {
    setSaving(true); setSaved(false);
    try {
      const mainRef = doc(db, "config", "main");
      await setDoc(mainRef, {
        announceMode,
        announceTemplate,
        duckVolume: Number(duckVolume),
        restoreVolume: Number(restoreVolume),
        leadMs: Number(leadMs),
        accentColor,
      }, { merge: true });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      alert("Erro ao salvar configurações: " + (e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  async function testAnnounce() {
    const nome = (testNome || "").trim();
    const sala = (testSala || "").trim();
    if (!nome) { alert("Digite um nome para testar"); return; }
    try {
      await addDoc(collection(db, "calls"), {
        nome, sala,
        timestamp: serverTimestamp(),
        test: true,
      });
      alert("Teste enviado. Veja/escute na TV.");
    } catch (e) {
      alert("Erro no teste: " + (e?.message || e));
    }
  }

  if (loading) {
    return (
      <section style={container}>
        <h2 style={{ marginTop: 0 }}>Configurações do anúncio</h2>
        <div style={{ color: "#93a0b3" }}>Carregando…</div>
      </section>
    );
  }

  return (
    <section style={container}>
      <h2 style={{ marginTop: 0 }}>Configurações do anúncio</h2>

      <div style={row}>
        <div style={label}>Modo do anúncio</div>
        <select
          value={announceMode}
          onChange={(e) => setAnnounceMode(e.target.value)}
          style={select}
        >
          {MODES.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      <div style={row}>
        <div style={label}>Frase do anúncio</div>
        <div>
          <input
            style={input}
            value={announceTemplate}
            onChange={(e) => setAnnounceTemplate(e.target.value)}
          />
          <div style={small}>
            Use <code>{{"{{nome}}"}}</code>, <code>{{"{{sala}}"}}</code> e <code>{{"{{salaTxt}}"}}</code>.
            Ex.: Atenção: paciente <b>{'{{nome}}'}</b>. Dirija-se à sala <b>{'{{sala}}'}</b>.
          </div>
        </div>
      </div>

      <div style={row}>
        <div style={label}>Volume durante anúncio</div>
        <input
          type="number"
          min={0} max={100}
          value={duckVolume}
          onChange={(e) => setDuckVolume(Number(e.target.value))}
          style={input}
        />
      </div>

      <div style={row}>
        <div style={label}>Volume normal</div>
        <input
          type="number"
          min={0} max={100}
          value={restoreVolume}
          onChange={(e) => setRestoreVolume(Number(e.target.value))}
          style={input}
        />
      </div>

      <div style={row}>
        <div style={label}>Antecedência (ms)</div>
        <input
          type="number"
          min={0} max={2000} step={50}
          value={leadMs}
          onChange={(e) => setLeadMs(Number(e.target.value))}
          style={input}
        />
      </div>

      <div style={row}>
        <div style={label}>Cor de destaque</div>
        <input
          type="color"
          value={accentColor}
          onChange={(e) => setAccentColor(e.target.value)}
          style={{ ...input, padding: 0, height: 40 }}
        />
      </div>

      <div style={btnRow}>
        <button onClick={save} disabled={saving} style={btnPrimary}>
          {saving ? "Salvando…" : "Salvar"}
        </button>
        {saved ? <span style={{ color: "#4ade80", fontWeight: 700 }}>Salvo!</span> : null}
      </div>

      <hr style={{ margin: "18px 0", border: "none", borderTop: "1px solid rgba(255,255,255,0.15)" }} />

      <h3>Teste rápido</h3>
      <div style={row}>
        <div style={label}>Nome</div>
        <input style={input} value={testNome} onChange={(e)=>setTestNome(e.target.value)} placeholder="Fulano da Silva" />
      </div>
      <div style={row}>
        <div style={label}>Sala</div>
        <input style={input} value={testSala} onChange={(e)=>setTestSala(e.target.value)} placeholder="2" />
      </div>
      <div style={btnRow}>
        <button onClick={testAnnounce} style={btnSecondary}>Testar anúncio</button>
        <span style={small}>O teste fala na TV mas é marcado como <b>test</b> e pode ser filtrado do histórico.</span>
      </div>
    </section>
  );
}
