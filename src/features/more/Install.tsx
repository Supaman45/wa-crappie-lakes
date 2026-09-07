import { useEffect, useState } from 'react';
import { lsGet, lsSet } from '@/lib/util';
import { Icon } from '@/components/ui';

interface BeforeInstallPromptEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>; }

let deferred: BeforeInstallPromptEvent | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as BeforeInstallPromptEvent; window.dispatchEvent(new Event('wff-installable')); });
  window.addEventListener('appinstalled', () => { deferred = null; lsSet('wff-installed', '1'); window.dispatchEvent(new Event('wff-installable')); });
}

export function isStandalone(): boolean {
  try { return window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true; } catch { return false; }
}
function isIOS(): boolean { return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
function isAndroid(): boolean { return /Android/.test(navigator.userAgent); }

/** Install button (Chrome, Edge, Samsung) or the exact taps for iPhone Safari. Hidden once installed. */
export function InstallGuide({ compact }: { compact?: boolean }) {
  const [canPrompt, setCanPrompt] = useState(!!deferred);
  const [installed, setInstalled] = useState(isStandalone() || lsGet('wff-installed') === '1');
  useEffect(() => {
    const on = () => { setCanPrompt(!!deferred); setInstalled(isStandalone() || lsGet('wff-installed') === '1'); };
    window.addEventListener('wff-installable', on);
    return () => window.removeEventListener('wff-installable', on);
  }, []);

  if (installed) return <div className="note">Installed. Open it from your home screen; it works offline with the lakes you have looked at.</div>;

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === 'accepted') { lsSet('wff-installed', '1'); setInstalled(true); }
    deferred = null; setCanPrompt(false);
  };

  if (canPrompt) {
    return (
      <div>
        <button className="btn primary" onClick={install}><Icon name="plus" />Install on this phone</button>
        {!compact && <div className="note" style={{ paddingTop: 8 }}>Puts the Fish Finder icon on your home screen, full screen, no browser bar.</div>}
      </div>
    );
  }
  if (isIOS()) {
    return (
      <div className="note" style={{ lineHeight: 1.6 }}>
        On iPhone, open this page in <b>Safari</b> (not Chrome), tap the <b>Share</b> button (the square with the arrow at the bottom), scroll the sheet and tap <b>Add to Home Screen</b>, then <b>Add</b>. The icon appears with your other apps.
      </div>
    );
  }
  if (isAndroid()) {
    return <div className="note" style={{ lineHeight: 1.6 }}>On Android, tap the browser menu (three dots) and choose <b>Install app</b> or <b>Add to Home screen</b>.</div>;
  }
  return <div className="note" style={{ lineHeight: 1.6 }}>On a phone, open wa-crappie-lakes.vercel.app and use Add to Home Screen (iPhone Safari: Share, then Add to Home Screen. Android: browser menu, Install app). On a Mac or PC, Chrome shows an install icon at the right end of the address bar.</div>;
}

/** One-time banner on phones that have not installed yet. */
export function InstallBanner() {
  const [hide, setHide] = useState(() => lsGet('wff-install-dismissed') === '1' || isStandalone() || lsGet('wff-installed') === '1');
  const [mobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches);
  if (hide || !mobile) return null;
  return (
    <div className="item" style={{ gridTemplateColumns: '1fr auto', cursor: 'default', marginTop: 8, borderColor: 'rgba(255,138,31,.4)' }}>
      <div>
        <div className="nm" style={{ fontSize: 14 }}>Put it on your home screen</div>
        <div className="sub">One tap to open, full screen, works at the lake with no signal.</div>
        <div style={{ marginTop: 8 }}><InstallGuide compact /></div>
      </div>
      <button className="iconbtn" aria-label="Dismiss" onClick={() => { lsSet('wff-install-dismissed', '1'); setHide(true); }}><Icon name="close" /></button>
    </div>
  );
}
