import { useEffect, useMemo, useRef, useState } from 'react';

// Centralised account / store state. Used by App.tsx, then passed to
// AccountWidget and (via context inside DocumentSite) to PageMerch.

const USERNAME_KEY     = 'account-username';
const POINTS_KEY       = 'account-elias-points';
const POINTS_CONSENT   = 'account-points-consent';
const purchasesKey     = (u: string) => `account-purchases-${u}`;
const deliveryKey      = (u: string) => `account-delivery-${u}`;
const deliveryBlockKey = (u: string) => `account-delivery-blocked-${u}`;

/** Cost of the n-th Fibonacci badge: 1, 1, 2, 3, 5, 8, 13, … */
export function fibCost(n: number): number {
  if (n <= 0) return 0;
  if (n === 1 || n === 2) return 1;
  let a = 1, b = 1;
  for (let i = 3; i <= n; i++) {
    [a, b] = [b, a + b];
  }
  return b;
}

function readJsonArray(key: string): string[] {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export interface Account {
  username: string | null;
  isDev: boolean;
  points: number;
  pointsConsent: boolean;
  purchases: ReadonlySet<string>;
  pendingPointsPrompt: boolean;
  /** Whether green mode is currently applied. Session-only; not persisted. */
  greenMode: boolean;
  /** Saved delivery-address image URL (per-username), null if unset. */
  deliveryAddress: string | null;
  /** Once true, the account can no longer set a delivery address. */
  deliveryBlocked: boolean;

  // Mutators
  logIn: (u: string) => void;
  logOut: () => void;
  acceptPointsConsent: () => void;
  declinePointsConsent: () => void;
  dismissPointsPrompt: () => void;
  /** Returns true if the buy succeeded. */
  buy: (id: string, cost: number) => boolean;
  /** Force-set points consent (used by store decline/accept items). */
  setPointsConsent: (v: boolean) => void;
  /** Wipe account + purchases and reload. */
  deleteAccount: () => void;
  setGreenMode: (v: boolean) => void;
  setDeliveryAddress: (img: string | null) => void;
  setDeliveryBlocked: (v: boolean) => void;
}

export function useAccount(): Account {
  const [username, setUsername] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try { return window.localStorage.getItem(USERNAME_KEY); } catch { return null; }
  });
  const [points, setPoints] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    try {
      const raw = window.localStorage.getItem(POINTS_KEY);
      return raw ? parseInt(raw, 10) || 0 : 0;
    } catch { return 0; }
  });
  const [pointsConsent, setPointsConsentState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try { return window.localStorage.getItem(POINTS_CONSENT) === '1'; } catch { return false; }
  });
  const [purchases, setPurchases] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    const u = (() => { try { return window.localStorage.getItem(USERNAME_KEY); } catch { return null; } })();
    if (!u) return new Set();
    return new Set(readJsonArray(purchasesKey(u)));
  });
  const [pendingPointsPrompt, setPendingPointsPrompt] = useState(false);
  // Session-only — not persisted. Resets on reload, and explicitly on
  // library→document camera-dolly transitions (handled by App.tsx).
  const [greenMode, setGreenMode] = useState(false);
  const [deliveryAddress, setDeliveryAddressState] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const u = (() => { try { return window.localStorage.getItem(USERNAME_KEY); } catch { return null; } })();
    if (!u) return null;
    try { return window.localStorage.getItem(deliveryKey(u)); } catch { return null; }
  });
  const [deliveryBlocked, setDeliveryBlockedState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const u = (() => { try { return window.localStorage.getItem(USERNAME_KEY); } catch { return null; } })();
    if (!u) return false;
    try { return window.localStorage.getItem(deliveryBlockKey(u)) === '1'; } catch { return false; }
  });

  const isDev = username === 'elias';

  // Apply / remove the body class whenever greenMode flips. The class is
  // wired to `body.green-mode { filter: url(#green-only) }` in global.css,
  // which paints the entire site in shades of green via SVG colour matrix.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const cls = 'green-mode';
    if (greenMode) document.body.classList.add(cls);
    else document.body.classList.remove(cls);
    return () => document.body.classList.remove(cls);
  }, [greenMode]);

  // Re-read per-user state whenever the active username changes (login/out).
  const usernameRef = useRef(username);
  useEffect(() => {
    if (usernameRef.current === username) return;
    usernameRef.current = username;
    if (!username) {
      setPurchases(new Set());
      setDeliveryAddressState(null);
      setDeliveryBlockedState(false);
      return;
    }
    setPurchases(new Set(readJsonArray(purchasesKey(username))));
    try {
      setDeliveryAddressState(window.localStorage.getItem(deliveryKey(username)));
    } catch { setDeliveryAddressState(null); }
    try {
      setDeliveryBlockedState(
        window.localStorage.getItem(deliveryBlockKey(username)) === '1',
      );
    } catch { setDeliveryBlockedState(false); }
  }, [username]);

  // ?dev URL trigger — seeds the elias dev account on any browser/origin.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has('dev')) return;
    try {
      window.localStorage.setItem(USERNAME_KEY, 'elias');
      window.localStorage.setItem(POINTS_CONSENT, '1');
    } catch {}
    setUsername('elias');
    setPointsConsentState(true);
    setPurchases(new Set(readJsonArray(purchasesKey('elias'))));
    params.delete('dev');
    const q = params.toString();
    const newUrl =
      window.location.pathname +
      (q ? '?' + q : '') +
      window.location.hash;
    window.history.replaceState(null, '', newUrl);
  }, []);

  // Award one Elias Point per minute while signed in and consent given.
  // Skipped for the dev account (∞ points).
  useEffect(() => {
    if (!username || !pointsConsent || isDev) return;
    const id = window.setInterval(() => {
      setPoints((p) => {
        const next = p + 1;
        try { window.localStorage.setItem(POINTS_KEY, String(next)); } catch {}
        return next;
      });
    }, 60_000);
    return () => window.clearInterval(id);
  }, [username, pointsConsent, isDev]);

  // Persist purchases whenever they change (and there's a user to scope to).
  useEffect(() => {
    if (!username) return;
    try {
      window.localStorage.setItem(
        purchasesKey(username),
        JSON.stringify(Array.from(purchases)),
      );
    } catch {}
  }, [username, purchases]);

  // ───────── Actions ─────────

  const logIn = (u: string) => {
    try { window.localStorage.setItem(USERNAME_KEY, u); } catch {}
    setUsername(u);
    setPendingPointsPrompt(true);
  };
  const logOut = () => {
    // Drop everything tied to the current user.
    if (username) {
      try { window.localStorage.removeItem(purchasesKey(username)); } catch {}
      try { window.localStorage.removeItem(deliveryKey(username)); } catch {}
      try { window.localStorage.removeItem(deliveryBlockKey(username)); } catch {}
    }
    try { window.localStorage.removeItem(USERNAME_KEY); } catch {}
    setUsername(null);
    setPurchases(new Set());
    setDeliveryAddressState(null);
    setDeliveryBlockedState(false);
  };
  const acceptPointsConsent = () => {
    try { window.localStorage.setItem(POINTS_CONSENT, '1'); } catch {}
    setPointsConsentState(true);
    setPendingPointsPrompt(false);
  };
  const declinePointsConsent = () => {
    setPendingPointsPrompt(false);
  };
  const dismissPointsPrompt = () => setPendingPointsPrompt(false);
  const setPointsConsent = (v: boolean) => {
    try {
      if (v) window.localStorage.setItem(POINTS_CONSENT, '1');
      else window.localStorage.removeItem(POINTS_CONSENT);
    } catch {}
    setPointsConsentState(v);
  };

  const buy = (id: string, cost: number): boolean => {
    if (!username) return false;
    if (purchases.has(id)) return false;
    if (!isDev && points < cost) return false;
    if (!isDev) {
      const next = points - cost;
      setPoints(next);
      try { window.localStorage.setItem(POINTS_KEY, String(next)); } catch {}
    }
    setPurchases((prev) => {
      const n = new Set(prev);
      n.add(id);
      return n;
    });
    return true;
  };

  const deleteAccount = () => {
    if (username) {
      try { window.localStorage.removeItem(purchasesKey(username)); } catch {}
      try { window.localStorage.removeItem(deliveryKey(username)); } catch {}
      try { window.localStorage.removeItem(deliveryBlockKey(username)); } catch {}
    }
    try { window.localStorage.removeItem(USERNAME_KEY); } catch {}
    if (typeof window !== 'undefined') window.location.reload();
  };

  const setDeliveryAddress = (img: string | null) => {
    if (!username) return;
    try {
      if (img) window.localStorage.setItem(deliveryKey(username), img);
      else     window.localStorage.removeItem(deliveryKey(username));
    } catch {}
    setDeliveryAddressState(img);
  };
  const setDeliveryBlocked = (v: boolean) => {
    if (!username) return;
    try {
      if (v) window.localStorage.setItem(deliveryBlockKey(username), '1');
      else   window.localStorage.removeItem(deliveryBlockKey(username));
    } catch {}
    setDeliveryBlockedState(v);
  };

  return useMemo<Account>(
    () => ({
      username,
      isDev,
      points,
      pointsConsent,
      purchases,
      pendingPointsPrompt,
      greenMode,
      deliveryAddress,
      deliveryBlocked,
      logIn,
      logOut,
      acceptPointsConsent,
      declinePointsConsent,
      dismissPointsPrompt,
      setPointsConsent,
      buy,
      deleteAccount,
      setGreenMode,
      setDeliveryAddress,
      setDeliveryBlocked,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [username, isDev, points, pointsConsent, purchases, pendingPointsPrompt, greenMode, deliveryAddress, deliveryBlocked],
  );
}
