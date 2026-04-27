import { useEffect, useRef, useState } from 'react';

// Joke "account" system. The login flow is always invalid; the signup flow
// is hilariously long with silly validation but eventually accepts. The only
// thing actually persisted is the username, in localStorage. No real auth,
// no server, no judgement of the password — just live regex theatre.

const STORAGE_KEY      = 'account-username';
const POINTS_KEY       = 'account-elias-points';
const POINTS_CONSENT   = 'account-points-consent';
const ZODIAC = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
] as const;

type View = 'closed' | 'login' | 'signup' | 'menu';

export default function AccountWidget() {
  const [view, setView] = useState<View>('closed');
  const [username, setUsername] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try { return window.localStorage.getItem(STORAGE_KEY); } catch { return null; }
  });
  const [points, setPoints] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    try {
      const raw = window.localStorage.getItem(POINTS_KEY);
      return raw ? parseInt(raw, 10) || 0 : 0;
    } catch { return 0; }
  });
  const [pointsConsent, setPointsConsent] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try { return window.localStorage.getItem(POINTS_CONSENT) === '1'; } catch { return false; }
  });
  // The consent prompt shows once, after a fresh sign-up. Reload won't reopen it.
  const [pointsPromptOpen, setPointsPromptOpen] = useState(false);

  // Award one Elias Point per minute while signed in and consent has been given.
  useEffect(() => {
    if (!username || !pointsConsent) return;
    const id = window.setInterval(() => {
      setPoints((p) => {
        const next = p + 1;
        try { window.localStorage.setItem(POINTS_KEY, String(next)); } catch {}
        return next;
      });
    }, 60_000);
    return () => window.clearInterval(id);
  }, [username, pointsConsent]);

  const logIn = (u: string) => {
    try { window.localStorage.setItem(STORAGE_KEY, u); } catch {}
    setUsername(u);
    setView('closed');
    setPointsPromptOpen(true);
  };
  const logOut = () => {
    try { window.localStorage.removeItem(STORAGE_KEY); } catch {}
    setUsername(null);
    setView('closed');
  };
  const acceptPoints = () => {
    try { window.localStorage.setItem(POINTS_CONSENT, '1'); } catch {}
    setPointsConsent(true);
    setPointsPromptOpen(false);
  };
  const declinePoints = () => setPointsPromptOpen(false);

  const onButtonClick = () => {
    if (username) setView(view === 'menu' ? 'closed' : 'menu');
    else setView('login');
  };

  return (
    <>
      <button
        className={`account-btn${username ? ' is-signed-in' : ''}`}
        onClick={onButtonClick}
        aria-label={username ? `Account: ${username}` : 'Sign in'}
        type="button"
      >
        {username ? (
          <span className="account-name">{username}</span>
        ) : (
          <PersonIcon />
        )}
      </button>

      {username && view === 'menu' && (
        <AccountMenu
          username={username}
          points={points}
          pointsConsent={pointsConsent}
          onClose={() => setView('closed')}
          onLogOut={logOut}
        />
      )}

      {view === 'login' && (
        <LoginModal
          onCancel={() => setView('closed')}
          onSwitchToSignup={() => setView('signup')}
        />
      )}

      {view === 'signup' && (
        <SignupModal
          onCancel={() => setView('closed')}
          onBackToLogin={() => setView('login')}
          onSuccess={logIn}
        />
      )}

      {pointsPromptOpen && (
        <PointsPrompt
          onAccept={acceptPoints}
          onDecline={declinePoints}
        />
      )}
    </>
  );
}

function PersonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20.5c1-4.5 4-6.5 7-6.5s6 2 7 6.5" />
    </svg>
  );
}

function AccountMenu({
  username, points, pointsConsent, onClose, onLogOut,
}: {
  username: string;
  points: number;
  pointsConsent: boolean;
  onClose: () => void;
  onLogOut: () => void;
}) {
  // Click outside to close.
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current && !ref.current.contains(t)) {
        // Don't close if the user clicked the account button (which toggles).
        const btn = (t as HTMLElement).closest?.('.account-btn');
        if (!btn) onClose();
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [onClose]);

  return (
    <div className="account-menu" ref={ref} role="menu">
      <div className="account-menu-head">
        Signed in as <strong>{username}</strong>
      </div>
      <div className="account-menu-points">
        Elias Points: <strong>{points}</strong>
        {!pointsConsent && (
          <span className="account-menu-points-note"> (cookies declined)</span>
        )}
      </div>
      <button
        type="button"
        className="account-menu-action"
        onClick={onLogOut}
      >
        Log out
      </button>
    </div>
  );
}

function PointsPrompt({
  onAccept, onDecline,
}: { onAccept: () => void; onDecline: () => void }) {
  return (
    <ModalShell title="Elias Points" onCancel={onDecline}>
      <div className="account-form">
        <p className="account-prompt-body">
          To collect <strong>Elias Points</strong> on your account you need to
          accept cookies. Points can be exchanged in the merchandise store.
        </p>
        <div className="account-actions">
          <button
            type="button"
            className="account-submit"
            onClick={onAccept}
          >
            Accept cookies
          </button>
          <button
            type="button"
            className="account-link"
            onClick={onDecline}
          >
            decline
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function ModalShell({
  title, onCancel, children,
}: { title: string; onCancel: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      className="account-modal-backdrop"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="account-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="account-modal-head">
          <h2 className="account-modal-title">{title}</h2>
          <button
            type="button"
            className="account-modal-close"
            onClick={onCancel}
            aria-label="Close"
          >
            ×
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

function LoginModal({
  onCancel, onSwitchToSignup,
}: { onCancel: () => void; onSwitchToSignup: () => void }) {
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setPending(true);
    // Brief delay so it feels like it's checking before declaring failure.
    window.setTimeout(() => {
      setPending(false);
      setErr('Invalid login details.');
    }, 700);
  };

  return (
    <ModalShell title="Sign in" onCancel={onCancel}>
      <form className="account-form" onSubmit={submit} autoComplete="off">
        <label className="account-field">
          <span className="account-field-label">Username</span>
          <input
            className="account-input"
            value={u}
            onChange={(e) => setU(e.target.value)}
            required
            autoFocus
          />
        </label>
        <label className="account-field">
          <span className="account-field-label">Password</span>
          <input
            className="account-input"
            type="password"
            value={p}
            onChange={(e) => setP(e.target.value)}
            required
          />
        </label>
        {err && <div className="account-error">{err}</div>}
        <div className="account-actions">
          <button type="submit" className="account-submit" disabled={pending}>
            {pending ? 'Checking…' : 'Sign in'}
          </button>
          <button type="button" className="account-link" onClick={onSwitchToSignup}>
            create an account
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

interface PassCheck {
  ok: boolean;
  label: string;
}

function passwordChecks(pass: string): PassCheck[] {
  return [
    { ok: pass.length >= 12,                    label: 'At least 12 characters' },
    { ok: /[A-Z]/.test(pass),                   label: 'An uppercase letter' },
    { ok: /[a-z]/.test(pass),                   label: 'A lowercase letter' },
    { ok: /\d/.test(pass),                      label: 'A digit' },
    { ok: /[!@#$%^&*]/.test(pass),              label: 'A special character (!@#$%^&*)' },
    { ok: /[IVXLCDM]/.test(pass),               label: 'A Roman numeral (capital I, V, X, L, C, D or M)' },
    { ok: !/(.)\1/.test(pass),                  label: 'No two of the same character in a row' },
    { ok: /biscuit/i.test(pass),                label: "The word 'biscuit'" },
  ];
}

function SignupModal({
  onCancel, onBackToLogin, onSuccess,
}: { onCancel: () => void; onBackToLogin: () => void; onSuccess: (u: string) => void }) {
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [address, setAddress] = useState('');
  const [zodiac, setZodiac] = useState('');
  const [eliasFact, setEliasFact] = useState('');
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Full name forbidden-substring check (case-insensitive).
  const nameForbidden = /elias|rode/i.test(fullName);
  const nameValid = fullName.trim().length > 0 && !nameForbidden;

  // Elias fact: at least 10 words.
  const factWords = eliasFact.trim() === '' ? 0 : eliasFact.trim().split(/\s+/).length;
  const factValid = factWords >= 10;

  // Address fake-validation: 800ms debounce after a change, then check that
  // we have at least three non-empty lines.
  type AddressStatus = 'idle' | 'checking' | 'verified' | 'incomplete';
  const [addressStatus, setAddressStatus] = useState<AddressStatus>('idle');
  useEffect(() => {
    if (address.trim().length === 0) {
      setAddressStatus('idle');
      return;
    }
    setAddressStatus('checking');
    const t = window.setTimeout(() => {
      const lines = address.split('\n').filter((l) => l.trim().length > 0).length;
      setAddressStatus(lines >= 3 ? 'verified' : 'incomplete');
    }, 800);
    return () => window.clearTimeout(t);
  }, [address]);

  // Username availability: debounce 500ms after a change, then check ≥10 chars.
  type UserStatus = 'idle' | 'checking' | 'available' | 'taken';
  const [userStatus, setUserStatus] = useState<UserStatus>('idle');
  useEffect(() => {
    if (user.length === 0) {
      setUserStatus('idle');
      return;
    }
    setUserStatus('checking');
    const t = window.setTimeout(() => {
      setUserStatus(user.length >= 10 ? 'available' : 'taken');
    }, 500);
    return () => window.clearTimeout(t);
  }, [user]);

  const checks = passwordChecks(pass);
  const passValid = pass.length > 0 && checks.every((c) => c.ok);

  const allValid =
    nameValid &&
    dob.length > 0 &&
    addressStatus === 'verified' &&
    zodiac.length > 0 &&
    factValid &&
    userStatus === 'available' &&
    passValid;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!allValid) return;
    setPending(true);
    window.setTimeout(() => {
      onSuccess(user);
    }, 600);
  };

  return (
    <ModalShell title="Create an account" onCancel={onCancel}>
      <form className="account-form account-form-long" onSubmit={submit} autoComplete="off">
        <label className="account-field">
          <span className="account-field-label">Full name</span>
          <input
            className="account-input"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
          {fullName.length > 0 && nameForbidden && (
            <span className="account-check is-bad">
              ✗ This name is not accepted; please choose a different one.
            </span>
          )}
        </label>

        <label className="account-field">
          <span className="account-field-label">Date of birth</span>
          <input
            className="account-input"
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            required
          />
        </label>

        <label className="account-field">
          <span className="account-field-label">Home address</span>
          <textarea
            className="account-input"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={3}
            required
          />
          {addressStatus === 'checking' && (
            <span className="account-check">validating address…</span>
          )}
          {addressStatus === 'verified' && (
            <span className="account-check is-ok">✓ Address verified</span>
          )}
          {addressStatus === 'incomplete' && (
            <span className="account-check is-bad">
              ✗ Address could not be verified — please provide at least three lines.
            </span>
          )}
        </label>

        <label className="account-field">
          <span className="account-field-label">Zodiac sign</span>
          <select
            className="account-input"
            value={zodiac}
            onChange={(e) => setZodiac(e.target.value)}
            required
          >
            <option value="">Select…</option>
            {ZODIAC.map((z) => <option key={z} value={z}>{z}</option>)}
          </select>
        </label>

        <label className="account-field">
          <span className="account-field-label">Favourite Elias fact</span>
          <input
            className="account-input"
            value={eliasFact}
            onChange={(e) => setEliasFact(e.target.value)}
            placeholder="e.g. once cycled the entire South Wall in a single afternoon"
            required
          />
          {eliasFact.length > 0 && !factValid && (
            <span className="account-check is-bad">
              ✗ Fact isn&rsquo;t long enough ({factWords}/10 words).
            </span>
          )}
          {factValid && (
            <span className="account-check is-ok">✓ Sufficiently profound.</span>
          )}
        </label>

        <label className="account-field">
          <span className="account-field-label">Username</span>
          <input
            className="account-input"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            required
          />
          {userStatus === 'checking' && (
            <span className="account-check">checking availability…</span>
          )}
          {userStatus === 'available' && (
            <span className="account-check is-ok">✓ Available</span>
          )}
          {userStatus === 'taken' && (
            <span className="account-check is-bad">
              ✗ This username is already taken.
            </span>
          )}
        </label>

        <label className="account-field">
          <span className="account-field-label">Password</span>
          <input
            className="account-input"
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            required
          />
          <ul className="account-check-list">
            {checks.map((c, i) => (
              <li
                key={i}
                className={pass.length === 0 ? '' : c.ok ? 'is-ok' : 'is-bad'}
              >
                <span className="account-check-mark">{c.ok ? '✓' : '·'}</span>
                {c.label}
              </li>
            ))}
          </ul>
        </label>

        {submitted && !allValid && (
          <div className="account-error">
            One or more fields are invalid; see the marks above.
          </div>
        )}

        <div className="account-actions">
          <button
            type="submit"
            className="account-submit"
            disabled={pending}
          >
            {pending ? 'Creating account…' : 'Create account'}
          </button>
          <button
            type="button"
            className="account-link"
            onClick={onBackToLogin}
          >
            already have an account
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
