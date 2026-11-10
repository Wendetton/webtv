// utils/layouts.js — Layouts da TV da sala de espera (/tv).
// O Admin escolhe um deles em Configurações e salva em config/main.tvLayout; a TV troca sozinha.
// Para criar um layout de outra data comemorativa: acrescente um item aqui e trate o id em pages/tv.js.
// Para ver um layout sem salvar: /tv?demo=1&layout=<id>

export const TV_LAYOUTS = [
  { id: 'padrao', nome: 'Padrão', descricao: 'O layout de sempre, nas cores da marca.' },
  { id: 'natal', nome: 'Natal', descricao: 'Enfeites dourados pendurados, pontos de luz e mensagens de Boas Festas.' },
];

export const DEFAULT_LAYOUT = 'padrao';

export function validLayout(id) {
  return TV_LAYOUTS.some(l => l.id === id) ? id : DEFAULT_LAYOUT;
}
