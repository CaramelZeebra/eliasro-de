import { useEffect, useRef, useState } from 'react';
import type { Account } from './useAccount';
import { fibCost } from './useAccount';

// Joke "account" system. The login flow is always invalid; the signup flow
// is hilariously long with silly validation but eventually accepts. State
// lives in useAccount() at App level; this is the UI surface only.

const ZODIAC = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
] as const;

type View = 'closed' | 'login' | 'signup' | 'menu';

/** Returns the largest Fibonacci number across all owned badges (i.e.
 *  the cost of the highest-tier badge), or 0 if no badge is owned. */
function highestFibOwned(purchases: ReadonlySet<string>): number {
  let maxTerm = 0;
  purchases.forEach((p) => {
    const m = /^fib-(\d+)$/.exec(p);
    if (m) maxTerm = Math.max(maxTerm, parseInt(m[1], 10));
  });
  return maxTerm > 0 ? fibCost(maxTerm) : 0;
}

export default function AccountWidget({ account }: { account: Account }) {
  const [view, setView] = useState<View>('closed');
  const { username, points, pointsConsent, isDev, pendingPointsPrompt } = account;
  const highestFib = highestFibOwned(account.purchases);

  const onButtonClick = () => {
    if (username) setView(view === 'menu' ? 'closed' : 'menu');
    else setView('login');
  };

  const visitMerch = () => {
    setView('closed');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('eliasro:navigate', { detail: 'merch' }),
      );
    }
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
          <span className="account-name">
            {username}
            {highestFib > 0 && (
              <span className="account-fib"> ({highestFib})</span>
            )}
          </span>
        ) : (
          <PersonIcon />
        )}
      </button>

      {username && view === 'menu' && (
        <AccountMenu
          username={username}
          isDev={isDev}
          points={points}
          pointsConsent={pointsConsent}
          highestFib={highestFib}
          onClose={() => setView('closed')}
          onLogOut={account.logOut}
          onVisitMerch={visitMerch}
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
          onSuccess={(u) => {
            account.logIn(u);
            setView('closed');
          }}
        />
      )}

      {pendingPointsPrompt && (
        <PointsPrompt
          onAccept={account.acceptPointsConsent}
          onDecline={account.declinePointsConsent}
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
  username, isDev, points, pointsConsent, highestFib, onClose, onLogOut, onVisitMerch,
}: {
  username: string;
  isDev: boolean;
  points: number;
  pointsConsent: boolean;
  highestFib: number;
  onClose: () => void;
  onLogOut: () => void;
  onVisitMerch: () => void;
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
        Signed in as{' '}
        <strong>
          {username}
          {highestFib > 0 && <span className="account-fib"> ({highestFib})</span>}
        </strong>
      </div>
      <div className="account-menu-points">
        Elias Points: <strong>{isDev ? '∞' : points}</strong>
        {!pointsConsent && !isDev && (
          <span className="account-menu-points-note"> (cookies declined)</span>
        )}
      </div>
      <button
        type="button"
        className="account-menu-action"
        onClick={onVisitMerch}
      >
        Merch store
      </button>
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
    <div className="account-modal-backdrop" role="presentation">
      <div
        className="account-modal"
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

// ───────────── Date / zodiac helpers (signup validators) ─────────────

function parseDob(dob: string): Date | null {
  // <input type="date"> emits YYYY-MM-DD.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  if (!m) return null;
  const [, y, mo, d] = m;
  const date = new Date(`${y}-${mo}-${d}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  // Round-trip check rejects "Feb 31" etc.
  if (
    date.getFullYear() !== +y ||
    date.getMonth() + 1 !== +mo ||
    date.getDate() !== +d
  ) return null;
  return date;
}

function ageOn(dob: Date, ref: Date = new Date()): number {
  let age = ref.getFullYear() - dob.getFullYear();
  const m = ref.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < dob.getDate())) age--;
  return age;
}

// Crude "looks like a placeholder" filter — month equal to day (01-01,
// 11-11, …), New Year's Eve, leap-day. Matches the user's example
// 01/01/2000.
function dobLooksFake(dob: Date): boolean {
  const m = dob.getMonth() + 1;
  const d = dob.getDate();
  if (m === d) return true;
  if (m === 12 && d === 31) return true;
  if (m === 2 && d === 29) return true;
  return false;
}

function zodiacFor(dob: Date): string {
  const m = dob.getMonth() + 1;
  const d = dob.getDate();
  if ((m === 12 && d >= 22) || (m === 1  && d <= 19)) return 'Capricorn';
  if ((m === 1  && d >= 20) || (m === 2  && d <= 18)) return 'Aquarius';
  if ((m === 2  && d >= 19) || (m === 3  && d <= 20)) return 'Pisces';
  if ((m === 3  && d >= 21) || (m === 4  && d <= 19)) return 'Aries';
  if ((m === 4  && d >= 20) || (m === 5  && d <= 20)) return 'Taurus';
  if ((m === 5  && d >= 21) || (m === 6  && d <= 20)) return 'Gemini';
  if ((m === 6  && d >= 21) || (m === 7  && d <= 22)) return 'Cancer';
  if ((m === 7  && d >= 23) || (m === 8  && d <= 22)) return 'Leo';
  if ((m === 8  && d >= 23) || (m === 9  && d <= 22)) return 'Virgo';
  if ((m === 9  && d >= 23) || (m === 10 && d <= 22)) return 'Libra';
  if ((m === 10 && d >= 23) || (m === 11 && d <= 21)) return 'Scorpio';
  if ((m === 11 && d >= 22) || (m === 12 && d <= 21)) return 'Sagittarius';
  return '';
}

const TODAY_ISO = new Date().toISOString().slice(0, 10);

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

  // Date of birth validation: real date, in past, age 16–99, not "placeholder".
  const dobDate = parseDob(dob);
  let dobError: string | null = null;
  let dobValid = false;
  if (dob.length > 0) {
    if (!dobDate) {
      dobError = 'This date is invalid.';
    } else if (dobDate.getTime() > Date.now()) {
      dobError = 'Date of birth must be in the past.';
    } else {
      const age = ageOn(dobDate);
      if (age < 16) {
        dobError = 'You must be at least 16 years old to register.';
      } else if (age > 99) {
        dobError = 'Records do not extend beyond 99 years.';
      } else if (dobLooksFake(dobDate)) {
        dobError =
          'This date appears to be a placeholder; please use your real date of birth.';
      } else {
        dobValid = true;
      }
    }
  }

  // Zodiac coherence.
  const expectedZodiac = dobDate ? zodiacFor(dobDate) : '';
  const zodiacOk = !!zodiac && !!expectedZodiac && zodiac === expectedZodiac;
  const zodiacMismatch = !!zodiac && !!expectedZodiac && zodiac !== expectedZodiac;

  const checks = passwordChecks(pass);
  const passValid = pass.length > 0 && checks.every((c) => c.ok);

  const allValid =
    nameValid &&
    dobValid &&
    addressStatus === 'verified' &&
    zodiacOk &&
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
            max={TODAY_ISO}
            required
          />
          {dobError && (
            <span className="account-check is-bad">✗ {dobError}</span>
          )}
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
          {zodiacMismatch && (
            <span className="account-check is-bad">
              ✗ This sign does not match the date of birth provided.
            </span>
          )}
          {zodiacOk && (
            <span className="account-check is-ok">✓ Sign verified.</span>
          )}
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
