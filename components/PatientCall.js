import { useState } from "react";
import { db, serverTimestamp } from "../utils/firebase";
import { collection, addDoc } from "firebase/firestore";

export default function PatientCall() {
  const [nome, setNome] = useState("");
  const [sala, setSala] = useState("");
  const [sending, setSending] = useState(false);

  async function handleCall() {
    if (!nome || !sala) return;
    setSending(true);
    await addDoc(collection(db, "calls"), {
      nome,
      sala,
      timestamp: serverTimestamp()
    });
    setNome("");
    setSala("");
    setSending(false);
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <h3>Chamar Paciente</h3>
      <input
        value={nome}
        onChange={e => setNome(e.target.value)}
        placeholder="Nome do paciente"
        style={{ fontSize: 18, padding: 8, marginRight: 10 }}
      />
      <input
        value={sala}
        onChange={e => setSala(e.target.value)}
        placeholder="Sala"
        style={{ fontSize: 18, padding: 8, width: 60, marginRight: 10 }}
      />
      <button onClick={handleCall} disabled={sending || !nome || !sala} style={{ fontSize: 18, padding: "8px 20px" }}>
        {sending ? "Chamando..." : "Chamar"}
      </button>
    </div>
  );
}
