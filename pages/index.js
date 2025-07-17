// Redireciona para painel administrativo por padrão
import { useEffect } from "react";
export default function Home() {
  useEffect(() => {
    window.location.href = "/admin";
  }, []);
  return <div>Redirecionando para painel administrativo...</div>;
}
