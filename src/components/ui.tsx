import { useEffect, type ReactNode } from 'react';

export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    map: <><path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z" /><path d="M8 2v16M16 6v16" /></>,
    creek: <><path d="M3 20c3-3 4-8 2-12 3 0 5 2 6 5 1-4 4-6 8-6-2 4-1 8 2 11" /><path d="M9 13c2 2 3 4 3 7" /></>,
    plan: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>,
    log: <><path d="M4 4h12l4 4v12H4z" /><path d="M8 12h8M8 16h5" /></>,
    more: <><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></>,
    close: <><path d="M6 6l12 12M18 6L6 18" /></>,
    nav: <><path d="M3 11l19-9-9 19-2-8-8-2z" /></>,
    pin: <><path d="M12 22s7-7 7-12a7 7 0 0 0-14 0c0 5 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></>,
    star: <><path d="M12 2l3 7 7 .6-5.3 4.6L18.5 21 12 17.3 5.5 21l1.8-6.8L2 9.6 9 9z" /></>,
    heart: <><path d="M12 21s-8-5.3-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.7-8 11-8 11z" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    check: <><path d="M4 12l5 5L20 7" /></>,
    locate: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /><circle cx="12" cy="12" r="8" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>,
    layers: <><path d="M12 3l9 5-9 5-9-5 9-5z" /><path d="M3 13l9 5 9-5" /></>,
    refresh: <><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 3v6h-6" /></>,
    trash: <><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></>,
    camera: <><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>,
    external: <><path d="M14 4h6v6M20 4l-9 9M19 14v6H4V5h6" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    wave: <><path d="M2 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0 2 2 2 2" /><path d="M2 17c2-2 4-2 6 0s4 2 6 0 4-2 6 0" /></>,
    gauge: <><path d="M4 18a8 8 0 1 1 16 0" /><path d="M12 18l4-6" /></>,
    barrier: <><path d="M4 20V8l8-4 8 4v12" /><path d="M4 14h16M4 8h16" /></>,
    list: <><path d="M8 6h13M8 12h13M8 18h13" /><circle cx="3.5" cy="6" r="1" /><circle cx="3.5" cy="12" r="1" /><circle cx="3.5" cy="18" r="1" /></>,
    share: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></>,
    trip: <><path d="M4 19c3-1 4-6 6-8s5-1 7-4" /><circle cx="4" cy="19" r="2" /><circle cx="18" cy="6" r="2" /></>,
  };
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || null}</svg>;
}

export function Sheet({ title, sub, onClose, children, footer, wide }: { title: ReactNode; sub?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="sheet-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true" style={wide ? { maxWidth: 720 } : undefined}>
        <div className="grabber" />
        <div className="sheet-h">
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2>{title}</h2>
            {sub && <div className="sub">{sub}</div>}
          </div>
          <button className="iconbtn" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        </div>
        <div className="sheet-b">{children}</div>
        {footer && <div className="sheet-f">{footer}</div>}
      </div>
    </div>
  );
}

export function Chip({ on, onClick, children, color }: { on?: boolean; onClick?: () => void; children: ReactNode; color?: string }) {
  return <button type="button" className={`chip${on ? ' on' : ''}`} onClick={onClick} aria-pressed={!!on}>{color && <i className="dot" style={{ background: color }} />}{children}</button>;
}

export function Field({ label, children, full }: { label: string; children: ReactNode; full?: boolean }) {
  return <div className={`field${full ? ' full' : ''}`}><label>{label}</label>{children}</div>;
}

export function Score({ n }: { n: number }) {
  const col = n >= 70 ? '#4fb477' : n >= 50 ? '#eaa24c' : '#7a8a99';
  return <div className="pscore" style={{ color: col, borderColor: col }}>{n}</div>;
}

export function Empty({ children }: { children: ReactNode }) { return <div className="empty">{children}</div>; }
