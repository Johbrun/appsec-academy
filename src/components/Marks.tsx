import { useId } from 'react';
import { Icon } from './ui';

// Marqueurs d'identité : identicon (avatar), insigne (badge) et sceau (certificat).

function hash(str: string) {
  let h = 2166136261;
  for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h >>> 0;
}

// Grille 5 × 5 symétrique dérivée du nom, avec une cellule « signal ».
export function Identicon({ name, size = 28, className = '' }: { name: string; size?: number; className?: string }) {
  const seed = hash(name.trim().toLowerCase() || 'anonyme');
  let bits = seed & 0x7fff;
  let count = 0;
  for (let k = 0; k < 15; k++) count += (bits >> k) & 1;
  if (count < 6) bits ^= 0x5a5a & 0x7fff;
  const cells: { x: number; y: number }[] = [];
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 3; x++) {
      if ((bits >> (y * 3 + x)) & 1) {
        cells.push({ x, y });
        if (x < 2) cells.push({ x: 4 - x, y });
      }
    }
  }
  const accent = cells.length ? (seed >>> 17) % cells.length : -1;
  return (
    <svg viewBox="0 0 7 7" width={size} height={size} className={`identicon ${className}`} aria-hidden="true">
      <rect width="7" height="7" rx="1.5" className="id-bg" />
      {cells.map((c, k) => (
        <rect key={k} x={c.x + 1.07} y={c.y + 1.07} width="0.86" height="0.86" rx="0.14" className={k === accent ? 'id-accent' : 'id-on'} />
      ))}
    </svg>
  );
}

export function Insignia({ icon, earned }: { icon: string; earned: boolean }) {
  return (
    <span className={`insignia ${earned ? 'on' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 64 72">
        <path className="hex" d="M32 2 L61 18.5 L61 53.5 L32 70 L3 53.5 L3 18.5 Z" />
        <path className="hex-inner" d="M32 10 L54 22.5 L54 49.5 L32 62 L10 49.5 L10 22.5 Z" />
      </svg>
      <span className="ins-icon"><Icon name={icon} size={20} /></span>
    </span>
  );
}

export function Seal({ size = 116, year }: { size?: number; year: string }) {
  const id = `seal-${useId().replace(/:/g, '')}`;
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} className="seal" aria-hidden="true">
      <defs>
        <path id={id} d="M60,60 m-45,0 a45,45 0 1,1 90,0 a45,45 0 1,1 -90,0" />
      </defs>
      <circle cx="60" cy="60" r="58" className="ring" />
      <circle cx="60" cy="60" r="53" className="ring dotted" />
      <circle cx="60" cy="60" r="36" className="ring" />
      <text className="seal-text">
        <textPath href={`#${id}`} textLength={2 * Math.PI * 45 - 4} lengthAdjust="spacing">
          APPSEC ACADEMY · PARCOURS CERTIFIÉ · {year} ·
        </textPath>
      </text>
      <g transform="translate(45 47)">
        <rect x="0" y="0" width="30" height="7" rx="1.8" className="ink" />
        <rect x="0" y="9.5" width="16" height="7" rx="1.8" className="ink" />
        <rect x="19" y="9.5" width="7" height="7" rx="1.8" className="sig" />
        <rect x="0" y="19" width="23" height="7" rx="1.8" className="ink" />
      </g>
    </svg>
  );
}
