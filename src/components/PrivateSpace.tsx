import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  Sprout,
} from "lucide-react";
type Access = {
  required: boolean;
  authenticated: boolean;
  setupRequired: boolean;
};
export default function PrivateSpace({
  children,
}: {
  children: (privateMode: boolean, signOut: () => Promise<void>) => ReactNode;
}) {
  const [access, setAccess] = useState<Access | null>(null);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  const check = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/status");
      if (!response.ok) throw Error();
      const result = await response.json();
      if (typeof result.required !== "boolean") throw Error();
      setAccess(result);
      if (result.required) localStorage.removeItem("lighter-state");
      setError("");
    } catch {
      setError(
        "We couldn’t reach your private space. Check your connection and try again.",
      );
    }
  }, []);
  useEffect(() => {
    check();
    const expired = () => {
      setAccess({ required: true, authenticated: false, setupRequired: false });
      setError("Your private session has ended. Please sign in again.");
    };
    window.addEventListener("lighter:session-expired", expired);
    return () => window.removeEventListener("lighter:session-expired", expired);
  }, [check]);
  async function login(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await response.json();
      if (!response.ok)
        throw Error(
          data.message || "We couldn’t sign you in. Please try again.",
        );
      setPassword("");
      await check();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }
  async function signOut() {
    setBusy(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw Error();
      setAccess({ required: true, authenticated: false, setupRequired: false });
      setPassword("");
      localStorage.removeItem("lighter-state");
    } catch {
      setError("Could not sign out. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  if (
    access &&
    !access.setupRequired &&
    (!access.required || access.authenticated)
  )
    return <>{children(access.required, signOut)}</>;
  return (
    <main className="private-page">
      <div className="private-brand">
        <Sprout size={29} />
        lighter.
      </div>
      <section className="private-card">
        <span className="private-lock">
          <LockKeyhole size={25} />
        </span>
        <span className="eyebrow">JUST FOR YOU</span>
        <h1>Your little private space.</h1>
        {access?.setupRequired ? (
          <>
            <p>
              Your app’s private access is still being prepared. Personal data
              stays locked until setup is complete.
            </p>
            <button className="button button-secondary" onClick={check}>
              <RefreshCw size={15} /> Check again
            </button>
          </>
        ) : !access ? (
          <>
            <p>{error || "Getting your space ready…"}</p>
            {error ? (
              <button className="button button-primary" onClick={check}>
                <RefreshCw size={15} /> Try again
              </button>
            ) : (
              <LoaderCircle className="spin" size={23} />
            )}
          </>
        ) : (
          <>
            <p>
              Welcome back. Use the personal password you chose when setting up
              Lighter.
            </p>
            <form onSubmit={login}>
              <label className="field">
                <span>Your Lighter password</span>
                <div className="password-input">
                  <input
                    autoFocus
                    type={visible ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={visible ? "Hide password" : "Show password"}
                    onClick={() => setVisible((v) => !v)}
                  >
                    {visible ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </label>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <button
                type="submit"
                className="button button-primary"
                disabled={busy}
              >
                {busy ? (
                  <LoaderCircle size={16} className="spin" />
                ) : (
                  <ArrowRight size={16} />
                )}{" "}
                Open my space
              </button>
            </form>
            <p className="fine-print">
              This is your app password, separate from your Fitbit or Google
              password.
            </p>
          </>
        )}
      </section>
      <p className="private-footer">
        A little kinder. A little healthier. A little more you.
      </p>
    </main>
  );
}
