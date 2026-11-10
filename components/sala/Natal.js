// components/sala/Natal.js — Decoração de Natal da sala de espera (sutil, em dourado).
// Liga sozinha de 1º de dezembro a 6 de janeiro. Para ver fora da época: /tv?natal=1 (e /tv?natal=0 desliga).
// Só transform/opacity nas animações (leve para o Fire TV).

import s from './sala.module.css';

export function isNatalSeason(date = new Date()) {
  const m = date.getMonth();
  const d = date.getDate();
  return m === 11 || (m === 0 && d <= 6);
}

// Frases que entram no rodízio da tela de espera durante o período
export const NATAL_FRASES = [
  { tipo: 'natal', texto: 'Que a luz do Natal ilumine o seu olhar.' },
  { tipo: 'natal', texto: 'A Oftalmocenter deseja a você e à sua família um Feliz Natal.' },
  { tipo: 'natal', texto: 'Que o novo ano traga novos horizontes para o seu olhar.' },
];

const STAR = 'M20 2 L24 16 L38 20 L24 24 L20 38 L16 24 L2 20 L16 16 Z';

export function Star({ className }) {
  return (
    <svg viewBox="0 0 40 40" className={`${s.xmasStar} ${className || ''}`} aria-hidden>
      <path d={STAR} fill="url(#xmas-gold)" />
    </svg>
  );
}

// Degradês dourados usados por todos os enfeites (definidos uma única vez na página)
export function NatalDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
      <defs>
        <linearGradient id="xmas-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e9d49c" />
          <stop offset="0.5" stopColor="#c9a45c" />
          <stop offset="1" stopColor="#a47c2e" />
        </linearGradient>
        <radialGradient id="xmas-gold-fill" cx="0.35" cy="0.3" r="0.9">
          <stop offset="0" stopColor="#fbf3dc" />
          <stop offset="0.45" stopColor="#e3c98a" />
          <stop offset="1" stopColor="#b8913f" />
        </radialGradient>
      </defs>
    </svg>
  );
}

function Shape({ kind }) {
  if (kind === 'ball') {
    return (
      <>
        <rect x="17" y="1" width="6" height="5" rx="1" fill="url(#xmas-gold)" />
        <circle cx="20" cy="22" r="15.5" fill="url(#xmas-gold-fill)" stroke="url(#xmas-gold)" strokeWidth="1" />
        <path d="M10.5 19 A10.5 10.5 0 0 1 17 11.5" fill="none" stroke="#fff" strokeOpacity="0.75" strokeWidth="1.4" strokeLinecap="round" />
      </>
    );
  }
  if (kind === 'ring') {
    return (
      <>
        <circle cx="20" cy="21" r="16" fill="rgba(255,255,255,0.35)" stroke="url(#xmas-gold)" strokeWidth="1.6" />
        <path d="M5 17 H35 M4.6 25 H35.4" fill="none" stroke="url(#xmas-gold)" strokeWidth="1.2" />
      </>
    );
  }
  if (kind === 'drop') {
    return <path d="M20 2 L31 20 L20 38 L9 20 Z M20 2 V38" fill="rgba(255,255,255,0.35)" stroke="url(#xmas-gold)" strokeWidth="1.6" strokeLinejoin="round" />;
  }
  if (kind === 'dot') return <circle cx="20" cy="20" r="9" fill="url(#xmas-gold-fill)" stroke="url(#xmas-gold)" strokeWidth="1" />;
  return <path d={STAR} fill="url(#xmas-gold)" />;
}

// x em vw, len (fio) e size (enfeite) em vh.
// As posições ficam entre os títulos "Consultório 1" e "Consultórios 2 e 3" da tela de chamada.
const HANGING = [
  { x: 25.5, len: 7, size: 2.2, kind: 'dot', dur: 9 },
  { x: 28.5, len: 13, size: 5.2, kind: 'ball', dur: 11 },
  { x: 32, len: 5.5, size: 3.4, kind: 'star', dur: 8 },
  { x: 58, len: 5, size: 3, kind: 'star', dur: 9.5 },
  { x: 61.5, len: 10.5, size: 5.4, kind: 'ring', dur: 12 },
  { x: 64.5, len: 6.5, size: 2.2, kind: 'dot', dur: 8.5 },
  { x: 67, len: 12.5, size: 4.6, kind: 'drop', dur: 10.5 },
  { x: 69.8, len: 4.5, size: 3.6, kind: 'ball', dur: 9 },
];

// Enfeites pendurados por fios finos (na linha do topo; na chamada em tela cheia, na borda da tela)
export function NatalOrnaments({ overlay }) {
  return (
    <div className={`${s.xmasTop} ${overlay ? s.xmasTopOverlay : ''}`} aria-hidden>
      {HANGING.map((o, i) => (
        <div key={i} className={s.xmasHang} style={{ left: `${o.x}vw`, animationDuration: `${o.dur}s`, animationDelay: `${-i * 1.3}s` }}>
          <span className={s.xmasThread} style={{ height: `${o.len}vh` }} />
          <svg viewBox="0 0 40 40" style={{ width: `${o.size}vh`, height: `${o.size}vh` }}>
            <Shape kind={o.kind} />
          </svg>
        </div>
      ))}
    </div>
  );
}

// Pontos de luz dourada caindo bem devagar (poucos, para não distrair nem pesar)
const FLAKES = [
  [6, 0.7, 30, 0], [13, 1.0, 38, -9], [19, 0.6, 27, -17], [31, 0.9, 34, -4], [39, 0.6, 29, -22],
  [47, 1.1, 40, -13], [56, 0.7, 31, -26], [63, 0.9, 36, -7], [72, 0.6, 28, -19], [84, 1.0, 39, -31],
  [90, 0.7, 30, -11], [96, 0.9, 35, -24],
];

export function NatalSnow() {
  return (
    <div className={s.xmasSnow} aria-hidden>
      {FLAKES.map(([x, size, dur, delay], i) => (
        <span key={i} className={s.xmasFlake} style={{ left: `${x}vw`, width: `${size}vh`, height: `${size}vh`, animationDuration: `${dur}s`, animationDelay: `${delay}s` }} />
      ))}
    </div>
  );
}

/* ===== Outras opções de decoração (para comparar): /tv?natal=2, 3 ou 4 ===== */

// Opção 2 — Cordão de luzes: um fio dourado em ondas sob a linha do topo, com luzes que piscam devagar
const LW = 1628;
const LSEG = LW / 8;
const LDROP = 36;
const LIGHTS_PATH = 'M0 0' + Array.from({ length: 8 }, (_, i) => ` Q ${(i + 0.5) * LSEG} ${LDROP} ${(i + 1) * LSEG} 0`).join('');
const BULBS = Array.from({ length: 8 }, (_, i) => [0.2, 0.5, 0.8].map((t, j) => ({
  x: (i + t) * LSEG,
  y: 2 * t * (1 - t) * LDROP + 5,
  sky: (i * 3 + j) % 3 === 1,
  dur: 3.2 + ((i * 3 + j) % 5) * 0.45,
  delay: -((i * 7 + j * 3) % 11) * 0.4,
}))).flat();

export function NatalLights({ overlay }) {
  return (
    <svg viewBox={`0 0 ${LW} 60`} className={`${s.xmasLights} ${overlay ? s.xmasLightsOverlay : ''}`} aria-hidden>
      <path d={LIGHTS_PATH} fill="none" stroke="url(#xmas-gold)" strokeWidth="1.2" />
      {BULBS.map((b, i) => (
        <g key={i} className={s.xmasBulb} style={{ animationDuration: `${b.dur}s`, animationDelay: `${b.delay}s` }}>
          <circle cx={b.x} cy={b.y} r="13" fill={b.sky ? '#7cc6f0' : '#e3c98a'} opacity="0.28" />
          <circle cx={b.x} cy={b.y} r="5.2" fill={b.sky ? '#7cc6f0' : 'url(#xmas-gold-fill)'} />
        </g>
      ))}
    </svg>
  );
}

// Opção 3 — Guirlanda: folhas douradas em volta do círculo da tela de espera
const LEAF = 'M0 0 C 2.5 -3.4 7 -3.2 11 0 C 7 3.2 2.5 3.4 0 0 Z';
const WREATH = Array.from({ length: 38 }, (_, k) => {
  const a = 293 + (k * 314) / 37;                 // abre um espaço no alto do círculo
  const rad = (a * Math.PI) / 180;
  const up = a < 450 ? a - 90 : a + 90;           // nas duas metades as folhas apontam para cima
  return { x: 100 * Math.cos(rad), y: 100 * Math.sin(rad), up, berry: k % 5 === 2 };
});

export function NatalWreath() {
  return (
    <svg viewBox="-100 -100 200 200" className={s.xmasWreath} aria-hidden>
      {WREATH.map((l, i) => (
        <g key={i} transform={`translate(${l.x.toFixed(2)} ${l.y.toFixed(2)})`}>
          <path d={LEAF} transform={`rotate(${(l.up - 36).toFixed(1)})`} fill="url(#xmas-gold)" opacity="0.92" />
          <path d={LEAF} transform={`rotate(${(l.up + 36).toFixed(1)})`} fill="url(#xmas-gold)" opacity="0.7" />
          {l.berry && <circle r="1.6" fill="url(#xmas-gold-fill)" stroke="url(#xmas-gold)" strokeWidth="0.3" />}
        </g>
      ))}
    </svg>
  );
}

// Raminho dourado (aponta para a direita; "flip" espelha)
export function Sprig({ flip }) {
  return (
    <svg viewBox="0 0 64 20" className={`${s.xmasSprig} ${flip ? s.xmasSprigFlip : ''}`} aria-hidden>
      <path d="M2 10 H60" stroke="url(#xmas-gold)" strokeWidth="1" fill="none" strokeLinecap="round" />
      {[4, 16, 28, 40].map(x => (
        <g key={x} fill="url(#xmas-gold)">
          <path d={`M${x} 10 c1 -5 6 -8 13 -8 c-1 5 -6 8 -13 8z`} />
          <path d={`M${x + 6} 10 c1 5 6 8 13 8 c-1 -5 -6 -8 -13 -8z`} opacity="0.75" />
        </g>
      ))}
      <path d="M52 10 c3 -3 7 -3 10 0 c-3 3 -7 3 -10 0z" fill="url(#xmas-gold)" />
    </svg>
  );
}

// Dois raminhos e uma estrela no centro da linha do topo
export function NatalCrest() {
  return (
    <div className={s.xmasCrest} aria-hidden>
      <Sprig flip /><Star /><Sprig />
    </div>
  );
}
