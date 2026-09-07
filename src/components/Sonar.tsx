import { useId } from 'react';

/**
 * Sonar-style bite strip: a filled curve over the next days, hot colors at the top like a
 * fish-finder return. Values 0..100. Labels are day names.
 */
export function SonarStrip({ values, labels, activeIndex = 0, leftLabel, rightLabel }: { values: number[]; labels: string[]; activeIndex?: number; leftLabel: string; rightLabel: string }) {
  const id = useId().replace(/:/g, '');
  const W = 300, H = 112, top = 22, bottom = 18;
  const n = values.length;
  if (n < 2) return <div className="sonar" />;
  const x = (i: number) => (i / (n - 1)) * (W - 20) + 10;
  const y = (v: number) => top + (1 - Math.max(0, Math.min(100, v)) / 100) * (H - top - bottom);
  // smooth path through the points
  let d = `M${x(0)} ${y(values[0])}`;
  for (let i = 1; i < n; i++) {
    const cx = (x(i - 1) + x(i)) / 2;
    d += ` C${cx} ${y(values[i - 1])}, ${cx} ${y(values[i])}, ${x(i)} ${y(values[i])}`;
  }
  const area = `${d} L${x(n - 1)} ${H} L${x(0)} ${H} Z`;
  return (
    <div className="sonar">
      <span className="lab l">{leftLabel}</span>
      <span className="lab r">{rightLabel}</span>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id={`sg${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffd24a" />
            <stop offset=".45" stopColor="#ff8a1f" />
            <stop offset="1" stopColor="#5a1600" />
          </linearGradient>
        </defs>
        <rect width={W} height={H} fill="#050d15" />
        <g stroke="#173147" strokeWidth="1">
          <line x1="0" y1={y(75)} x2={W} y2={y(75)} />
          <line x1="0" y1={y(50)} x2={W} y2={y(50)} />
          <line x1="0" y1={y(25)} x2={W} y2={y(25)} />
        </g>
        <path d={area} fill={`url(#sg${id})`} opacity=".85" />
        <path d={d} fill="none" stroke="#ffd24a" strokeWidth="1.5" opacity=".9" />
        {values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={i === activeIndex ? 4 : 2.2} fill={i === activeIndex ? '#ffd24a' : '#3ad0ff'} />)}
        {labels.map((l, i) => <text key={l + i} x={x(i)} y={H - 5} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} fill={i === activeIndex ? '#ffd24a' : '#6f8ea3'} fontFamily="IBM Plex Mono, monospace" fontSize="9" letterSpacing=".06em">{l.toUpperCase()}</text>)}
      </svg>
    </div>
  );
}

export function Gauge({ label, value, tone = '' }: { label: string; value: string; tone?: '' | 'c' | 'g' | 'o' | 'm' }) {
  return <div className="gauge"><div className="l">{label}</div><div className={`v ${tone}`}>{value}</div></div>;
}
