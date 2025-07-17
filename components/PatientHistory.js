export default function PatientHistory({ history, loading }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h3>Histórico de Chamados</h3>
      {loading ? <div>Carregando...</div> :
        <ul>
          {history.map((h, i) => (
            <li key={i}>{h.nome} - Sala {h.sala}</li>
          ))}
        </ul>
      }
    </div>
  );
}
