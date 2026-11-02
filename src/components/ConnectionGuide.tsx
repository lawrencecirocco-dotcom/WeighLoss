import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  LoaderCircle,
  LockKeyhole,
  Plus,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Watch,
  X,
} from "lucide-react";
import { apiFetch } from "../lib/api";
type Setup = {
  appUrl: string;
  fitbitRedirectUri: string;
  fitbitConfigured: boolean;
  aiConfigured: boolean;
  secure: boolean;
};
export default function ConnectionGuide({
  onClose,
  onChanged,
}: {
  onClose: () => void;
  onChanged: () => void;
}) {
  const [setup, setSetup] = useState<Setup | null>(null);
  const [tab, setTab] = useState<"phone" | "fitbit" | "ai">("phone");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    apiFetch("/api/setup")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.message || "Setup is unavailable.");
        setSetup(d);
      })
      .catch((e) => setError(e.message));
    const oldFocus = document.activeElement as HTMLElement;
    container.current?.querySelector<HTMLElement>("button")?.focus();
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const items = [
          ...container.current!.querySelectorAll<HTMLElement>(
            "button:not(:disabled),a[href],input:not(:disabled)",
          ),
        ].filter((el) => el.getClientRects().length);
        if (e.shiftKey && document.activeElement === items[0]) {
          e.preventDefault();
          items.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === items.at(-1)) {
          e.preventDefault();
          items[0]?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = oldOverflow;
      oldFocus?.focus();
    };
  }, []);
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await apiFetch("/api/setup/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          tab === "fitbit"
            ? {
                provider: "fitbit",
                clientId: clientId.trim(),
                clientSecret: clientSecret.trim(),
              }
            : { provider: "ai", apiKey: apiKey.trim() },
        ),
      });
      const data = await response.json();
      if (!response.ok)
        throw Error(data.message || "Could not save the connection.");
      setClientId("");
      setClientSecret("");
      setApiKey("");
      const status = await (await apiFetch("/api/setup")).json();
      setSetup(status);
      setMessage(
        tab === "fitbit"
          ? "Details saved. Next, approve the Fitbit connection below."
          : "Key saved. You can now try a meal photo or personalised snack suggestions.",
      );
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage("Copied. Paste this into Fitbit’s callback address field.");
    } catch {
      setError(
        "Copy wasn’t available. Press and hold the address below to copy it.",
      );
    }
  }
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={container}
        className="modal connection-guide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="connection-title"
      >
        <div className="modal-head">
          <span className="eyebrow">
            <ShieldCheck size={16} /> A LITTLE SETUP, THEN YOU’RE OFF
          </span>
          <button
            className="icon-button"
            aria-label="Close connection guide"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </div>
        <h2 id="connection-title">Let’s get you connected.</h2>
        <p>
          One step at a time. Your passwords and connection keys stay out of
          this chat.
        </p>
        <div className="guide-tabs">
          {(
            [
              { id: "phone", label: "1. Your iPhone", icon: Smartphone },
              { id: "fitbit", label: "2. Your Fitbit", icon: Watch },
              { id: "ai", label: "3. Food photos", icon: Sparkles },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? "selected" : ""}
              onClick={() => {
                setTab(t.id);
                setError("");
                setMessage("");
              }}
            >
              <t.icon size={16} />
              {t.label}
            </button>
          ))}
        </div>
        {setup && !setup.secure && (
          <p className="inline-note">
            You’re viewing a local development copy. An HTTPS website and
            private sign-in must be configured before using it online with
            personal data.
          </p>
        )}
        {tab === "phone" && (
          <div className="guide-content">
            <h3>A home on your iPhone.</h3>
            <ol>
              <li>
                Open your private Lighter website in <strong>Safari</strong> and
                sign in.
              </li>
              <li>
                Tap Safari’s <strong>Share</strong> button, then{" "}
                <strong>Add to Home Screen</strong>. You may need to scroll
                down.
              </li>
              <li>
                Name it <strong>Lighter</strong>, then tap <strong>Add</strong>.
                Open the new icon whenever you want to check in.
              </li>
            </ol>
            <p className="inline-note">
              A Home Screen app is included; it doesn’t need the App Store.
              Evening reminders currently need Lighter open—closed-phone push
              reminders are still a separate step.
            </p>
            <button
              className="button button-primary"
              onClick={() => setTab("fitbit")}
            >
              Next: my Fitbit <ArrowRight size={15} />
            </button>
          </div>
        )}
        {tab === "fitbit" && (
          <div className="guide-content">
            <div className="guide-status">
              <Watch size={18} />
              <strong>
                {setup?.fitbitConfigured
                  ? "Fitbit app details saved"
                  : "A one-time Fitbit registration"}
              </strong>
              {setup?.fitbitConfigured && <Check size={17} />}
            </div>
            <p>
              Fitbit needs permission to share data with this new app.
              Registering Lighter with Fitbit is separate from signing into your
              everyday Fitbit app.
            </p>
            <ol>
              <li>
                <a
                  href="https://dev.fitbit.com/apps"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open Fitbit’s developer site <ExternalLink size={12} />
                </a>{" "}
                and sign in with the account linked to your Fitbit. If the site
                directs you to Google’s developer service, pause and tell me
                what it says.
              </li>
              <li>
                Choose to register a personal app named <strong>Lighter</strong>
                . Use your Lighter website address for the app website. Choose{" "}
                <strong>Personal</strong> if asked for an application type.
              </li>
              <li>
                For the <strong>callback/redirect address</strong>, copy the
                exact address below. If Fitbit asks for privacy and terms
                addresses, use the links below after reviewing what they say.
              </li>
            </ol>
            <div className="copy-address">
              <code>
                {setup?.fitbitRedirectUri ||
                  "Your website address is being checked…"}
              </code>
              <button
                className="icon-button"
                aria-label="Copy Fitbit callback address"
                disabled={!setup}
                onClick={() => setup && copy(setup.fitbitRedirectUri)}
              >
                <Copy size={17} />
              </button>
            </div>
            {setup && (
              <div className="guide-policy-links">
                <a
                  href={`${setup.appUrl}/privacy.html`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Your privacy information <ExternalLink size={12} />
                </a>
                <code>{setup.appUrl}/privacy.html</code>
                <a
                  href={`${setup.appUrl}/terms.html`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Your personal-use terms <ExternalLink size={12} />
                </a>
                <code>{setup.appUrl}/terms.html</code>
              </div>
            )}
            <p>
              After registration, Fitbit shows an{" "}
              <strong>OAuth client ID</strong> and{" "}
              <strong>client secret</strong>. Put them here, in your own app—not
              in chat.
            </p>
            <form onSubmit={save}>
              <label className="field">
                <span>OAuth client ID</span>
                <input
                  required
                  autoComplete="off"
                  spellCheck={false}
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  maxLength={200}
                />
              </label>
              <label className="field">
                <span>Client secret</span>
                <input
                  type="password"
                  required
                  autoComplete="off"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  maxLength={2000}
                />
              </label>
              <button
                type="submit"
                className="button button-secondary"
                disabled={busy}
              >
                {busy ? (
                  <LoaderCircle size={15} className="spin" />
                ) : (
                  <LockKeyhole size={15} />
                )}{" "}
                Save Fitbit details securely
              </button>
            </form>
            {setup?.fitbitConfigured && (
              <a className="button button-primary" href="/api/fitbit/connect">
                <Watch size={16} /> Approve my Fitbit connection{" "}
                <ArrowRight size={15} />
              </a>
            )}
            <p className="fine-print">
              The final button takes you to Fitbit to approve access. A saved
              client ID isn’t proof of a successful connection; we’ll verify a
              real sync afterwards.
            </p>
          </div>
        )}
        {tab === "ai" && (
          <div className="guide-content">
            <div className="guide-status">
              <Sparkles size={18} />
              <strong>
                {setup?.aiConfigured
                  ? "AI connection key saved"
                  : "Turn meal photos into a starting estimate"}
              </strong>
              {setup?.aiConfigured && <Check size={17} />}
            </div>
            <p>
              Manual food logging already works. AI photo estimates and
              personalised snack suggestions use a paid OpenAI API account.
            </p>
            <ol>
              <li>
                Sign into{" "}
                <a
                  href="https://platform.openai.com"
                  target="_blank"
                  rel="noreferrer"
                >
                  the OpenAI API platform <ExternalLink size={12} />
                </a>
                .
              </li>
              <li>
                Review its billing and usage controls and choose your spending
                settings.{" "}
                <strong>
                  A ChatGPT subscription doesn’t include this API usage.
                </strong>
              </li>
              <li>
                Create a key on the{" "}
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noreferrer"
                >
                  API keys page <ExternalLink size={12} />
                </a>
                , then paste it below. Don’t send it in chat.
              </li>
            </ol>
            <form onSubmit={save}>
              <label className="field">
                <span>Your OpenAI API key</span>
                <input
                  type="password"
                  required
                  autoComplete="off"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  maxLength={2000}
                />
              </label>
              <button
                type="submit"
                className="button button-primary"
                disabled={busy}
              >
                {busy ? (
                  <LoaderCircle size={15} className="spin" />
                ) : (
                  <LockKeyhole size={15} />
                )}{" "}
                Save my AI connection securely
              </button>
            </form>
            <p className="fine-print">
              A meal photo is only sent when you choose “Estimate with AI.”
              Always check portions and confirm before logging. Progress-body
              photos aren’t sent to AI.
            </p>
          </div>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="inline-note" role="status">
            <Check size={14} /> {message}
          </p>
        )}
        <div className="guide-footer">
          <ShieldCheck size={14} /> Keys are encrypted on the server and never
          returned to your browser.
        </div>
      </div>
    </div>
  );
}
