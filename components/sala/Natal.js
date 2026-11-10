// components/sala/Natal.js — Layout "Natal" da sala de espera: decoração sutil em dourado sobre o layout padrão.
// É ligado pelo Admin (Configurações → Layout da TV). Para ver sem salvar: /tv?demo=1&layout=natal
// Só transform/opacity nas animações (leve para o Fire TV).

import s from './sala.module.css';

// Frases que entram no rodízio da tela de espera
export const NATAL_FRASES = [
  { tipo: 'natal', texto: 'Que a luz do Natal ilumine o seu olhar.' },
  { tipo: 'natal', texto: 'A Oftalmocenter deseja a você e à sua família um Feliz Natal.' },
  { tipo: 'natal', texto: 'Que o novo ano traga novos horizontes para o seu olhar.' },
];

const STAR = 'M20 2 L24 16 L38 20 L24 24 L20 38 L16 24 L2 20 L16 16 Z';
const GLINT = 'M0 -5 L1.2 -1.2 L5 0 L1.2 1.2 L0 5 L-1.2 1.2 L-5 0 L-1.2 -1.2 Z';

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

// Brilho rápido que acende e apaga num ponto do enfeite, de tempos em tempos
function Glint({ x, y, delay }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path className={s.xmasGlint} d={GLINT} fill="#fff" style={{ animationDelay: `${delay}s` }} />
    </g>
  );
}

function Shape({ kind, delay }) {
  if (kind === 'ball') {
    return (
      <>
        <rect x="17" y="1" width="6" height="5" rx="1" fill="url(#xmas-gold)" />
        <circle cx="20" cy="22" r="15.5" fill="url(#xmas-gold-fill)" stroke="url(#xmas-gold)" strokeWidth="1" />
        {/* reflexo que "respira", como luz passando pela esfera */}
        <path className={s.xmasSheen} style={{ animationDelay: `${delay}s` }} d="M10.5 19 A10.5 10.5 0 0 1 17 11.5" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
        <Glint x={13} y={14} delay={delay + 2.5} />
      </>
    );
  }
  if (kind === 'ring') {
    return (
      <>
        <circle cx="20" cy="21" r="16" fill="rgba(255,255,255,0.35)" stroke="url(#xmas-gold)" strokeWidth="1.6" />
        <path d="M5 17 H35 M4.6 25 H35.4" fill="none" stroke="url(#xmas-gold)" strokeWidth="1.2" />
        <Glint x={31} y={10} delay={delay + 1} />
      </>
    );
  }
  if (kind === 'drop') {
    return (
      <>
        <path d="M20 2 L31 20 L20 38 L9 20 Z M20 2 V38" fill="rgba(255,255,255,0.35)" stroke="url(#xmas-gold)" strokeWidth="1.6" strokeLinejoin="round" />
        <Glint x={26} y={11} delay={delay + 4} />
      </>
    );
  }
  if (kind === 'dot') return <circle cx="20" cy="20" r="9" fill="url(#xmas-gold-fill)" stroke="url(#xmas-gold)" strokeWidth="1" />;
  return <path className={s.xmasTwinkle} style={{ animationDelay: `${delay}s` }} d={STAR} fill="url(#xmas-gold)" />;
}

// x em vw, len (fio) e size (enfeite) em vh; sway = balanço em graus; dur = segundos de cada balanço.
// As posições ficam entre os títulos "Consultório 1" e "Consultórios 2 e 3" da tela de chamada.
const HANGING = [
  { x: 25.5, len: 7, size: 2.2, kind: 'dot', dur: 7.5, sway: 2.2 },
  { x: 28.5, len: 13, size: 5.2, kind: 'ball', dur: 11, sway: 1.2 },
  { x: 32, len: 5.5, size: 3.4, kind: 'star', dur: 6.5, sway: 2.4 },
  { x: 58, len: 5, size: 3, kind: 'star', dur: 7, sway: 2.4 },
  { x: 61.5, len: 10.5, size: 5.4, kind: 'ring', dur: 12, sway: 1.1 },
  { x: 64.5, len: 6.5, size: 2.2, kind: 'dot', dur: 8, sway: 2 },
  { x: 67, len: 12.5, size: 4.6, kind: 'drop', dur: 10, sway: 1.4 },
  { x: 69.8, len: 4.5, size: 3.6, kind: 'ball', dur: 8.5, sway: 1.8 },
];

// Enfeites pendurados por fios finos (na linha do topo; na chamada em tela cheia, na borda da tela).
// Cada um desce devagar, um depois do outro, e fica num balanço bem leve, em ritmos diferentes.
export function NatalOrnaments({ overlay }) {
  return (
    <div className={`${s.xmasTop} ${overlay ? s.xmasTopOverlay : ''}`} aria-hidden>
      {HANGING.map((o, i) => (
        <div key={i} className={s.xmasDrop} style={{ left: `${o.x}vw`, animationDelay: `${0.5 + i * 0.16}s` }}>
          <div className={s.xmasHang} style={{ '--sway': `${o.sway}deg`, animationDuration: `${o.dur}s`, animationDelay: `${-i * 1.7}s` }}>
            <span className={s.xmasThread} style={{ height: `${o.len}vh` }} />
            <svg viewBox="0 0 40 40" style={{ width: `${o.size}vh`, height: `${o.size}vh` }}>
              <Shape kind={o.kind} delay={i * 1.3} />
            </svg>
          </div>
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
