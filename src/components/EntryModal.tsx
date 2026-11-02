import { apiFetch } from "../lib/api";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Camera, Check, LoaderCircle, Sparkles, Upload, X } from "lucide-react";
import { getPlan, localDate, mealTypeAt, type Profile } from "../lib/engine";

export type EntryKind =
  "food" | "weight" | "goal" | "activity" | "photo" | "settings";
type Props = {
  kind: EntryKind;
  profile: Profile;
  onClose: () => void;
  onSetup?: () => void;
  onSave: (value: Record<string, unknown>) => void;
};
const titles: Record<EntryKind, string> = {
  food: "A little fuel for your day",
  weight: "Every step is progress",
  goal: "Make it your journey",
  activity: "Movement that feels good",
  photo: "Your progress, in pictures",
  settings: "A plan that fits you",
};
const labelFor: Record<EntryKind, string> = {
  food: "Log food",
  weight: "Log weight",
  goal: "Your goal",
  activity: "Log movement",
  photo: "Add progress photo",
  settings: "Your profile",
};
const mets: Record<string, number> = {
  Walking: 3.5,
  Cycling: 5.5,
  Swimming: 6,
  "Strength training": 3.5,
  Yoga: 2.5,
};

export default function EntryModal({
  kind,
  profile,
  onClose,
  onSetup,
  onSave,
}: Props) {
  const titleId = useId();
  const modalRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [date, setDate] = useState(localDate(new Date()));
  const [name, setName] = useState(kind === "activity" ? "Walking" : "");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const initialMealType = mealTypeAt(new Date());
  const [mealType, setMealType] = useState(
    String(initialMealType).charAt(0).toUpperCase() +
      String(initialMealType).slice(1),
  );
  const [weight, setWeight] = useState(String(profile.currentWeightKg));
  const [minutes, setMinutes] = useState("30");
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [estimate, setEstimate] = useState("");
  const [saveFavorite, setSaveFavorite] = useState(false);
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(busy);
  onCloseRef.current = onClose;
  busyRef.current = busy;
  const [draft, setDraft] = useState<Profile>({ ...profile });
  const plan = kind === "goal" || kind === "settings" ? safePlan(draft) : null;
  const movementCalories = Math.max(
    0,
    Math.round(
      ((mets[name] ?? 3.5) * profile.currentWeightKg * (Number(minutes) || 0)) /
        60,
    ),
  );

  useEffect(() => {
    const oldFocus = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const container = modalRef.current;
    container?.querySelector<HTMLElement>("input, select, button")?.focus();
    function keyboard(event: KeyboardEvent) {
      if (event.key === "Escape" && !busyRef.current) onCloseRef.current();
      if (event.key !== "Tab" || !container) return;
      const elements = Array.from(
        container.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
        ),
      );
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener("keydown", keyboard);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", keyboard);
      oldFocus?.focus();
    };
  }, []);

  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function chooseFile(next: File | undefined) {
    setError("");
    setEstimate("");
    if (!next) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(next.type)) {
      setError("Please choose a JPG, PNG or WebP image.");
      return;
    }
    if (next.size > 8 * 1024 * 1024) {
      setError("Please choose an image smaller than 8 MB.");
      return;
    }
    setFile(next);
  }

  async function analyze() {
    if (!file) {
      setError("Choose a meal photo first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.append("photo", file);
      const response = await apiFetch("/api/food/analyze", {
        method: "POST",
        body,
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.message ||
            result.error ||
            "Photo analysis is unavailable. You can still log your meal manually.",
        );
      setName(result.name || "My meal");
      setCalories(String(Math.round(result.calories || 0)));
      setProtein(String(Math.round(result.protein || 0)));
      setCarbs(String(Math.round(result.carbs || 0)));
      setFat(String(Math.round(result.fat || 0)));
      setEstimate(
        `Photo estimate${result.confidence ? ` · ${result.confidence} confidence` : ""}. ${result.notes || "Portions and hidden ingredients can change these numbers."} Check the serving size, nutrition and meal type before confirming.`,
      );
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not analyze this photo. Please enter your meal manually.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (date > localDate(new Date())) {
      setError("Please choose today or an earlier date.");
      return;
    }
    if (kind === "food") {
      if (
        !name.trim() ||
        !Number.isFinite(Number(calories)) ||
        Number(calories) < 1 ||
        Number(calories) > 10000
      ) {
        setError("Add a meal name and between 1 and 10,000 calories.");
        return;
      }
      onSave({
        name: name.trim(),
        calories: Number(calories),
        protein: Number(protein) || 0,
        carbs: Number(carbs) || 0,
        fat: Number(fat) || 0,
        mealType,
        date,
        favorite: saveFavorite,
      });
    } else if (kind === "weight") {
      if (
        !Number.isFinite(Number(weight)) ||
        Number(weight) < 30 ||
        Number(weight) > 400
      ) {
        setError("Please enter a weight between 30 and 400 kg.");
        return;
      }
      onSave({ weightKg: Number(weight), date });
    } else if (kind === "activity") {
      if (
        !Number.isFinite(Number(minutes)) ||
        Number(minutes) < 1 ||
        Number(minutes) > 480
      ) {
        setError("Please enter between 1 and 480 minutes.");
        return;
      }
      onSave({
        name,
        minutes: Number(minutes),
        calories: movementCalories,
        date,
      });
    } else if (kind === "photo") {
      if (!file) {
        setError("Choose a progress photo to upload.");
        return;
      }
      setBusy(true);
      try {
        const body = new FormData();
        body.append("photo", file);
        const response = await apiFetch("/api/photos", {
          method: "POST",
          body,
        });
        const result = await response.json();
        if (!response.ok)
          throw new Error(
            result.message || result.error || "Could not save your photo.",
          );
        onSave({ ...result, caption: caption.trim() });
      } catch (failure) {
        setError(
          failure instanceof Error
            ? failure.message
            : "Could not save your photo.",
        );
      } finally {
        setBusy(false);
      }
    } else {
      if (!draft.name.trim()) {
        setError("Please enter your name.");
        return;
      }
      if (
        draft.age < 18 ||
        draft.age > 100 ||
        draft.heightCm < 120 ||
        draft.heightCm > 230 ||
        draft.startWeightKg < 30 ||
        draft.startWeightKg > 400 ||
        draft.currentWeightKg < 30 ||
        draft.currentWeightKg > 400 ||
        draft.goalWeightKg < 30 ||
        draft.goalWeightKg >= draft.currentWeightKg
      ) {
        setError(
          "Check your details. This adult weight-loss planner needs a goal below your current weight.",
        );
        return;
      }
      if (draft.goalWeightKg / (draft.heightCm / 100) ** 2 < 18.5) {
        setError(
          "This goal is below the healthy adult BMI range. Choose a higher goal or discuss a suitable target with a clinician.",
        );
        return;
      }
      onSave({ ...draft, targetDate: draft.targetDate || undefined });
    }
  }

  function numberField(
    label: string,
    value: string | number,
    update: (value: string) => void,
    props: {
      min?: number;
      max?: number;
      step?: number;
      required?: boolean;
    } = {},
  ) {
    return (
      <label className="field">
        <span>{label}</span>
        <input
          type="number"
          value={value}
          onChange={(event) => update(event.target.value)}
          {...props}
        />
      </label>
    );
  }
  function profileNumber(
    label: string,
    key:
      "age" | "heightCm" | "startWeightKg" | "currentWeightKg" | "goalWeightKg",
    min: number,
    max: number,
    step = 1,
  ) {
    return numberField(
      label,
      draft[key],
      (value) =>
        setDraft((previous) => ({ ...previous, [key]: Number(value) })),
      { min, max, step, required: true },
    );
  }
  const photoPicker = (
    <div className="photo-picker">
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => chooseFile(event.target.files?.[0])}
        className="visually-hidden"
        aria-label={
          kind === "food" ? "Choose meal photo" : "Choose progress photo"
        }
      />
      {preview ? (
        <img
          src={preview}
          alt={
            kind === "food"
              ? "Your selected meal"
              : "Your selected progress photo"
          }
          style={{
            width: "100%",
            height: 180,
            objectFit: "contain",
            borderRadius: 14,
            background: "#f3f4ee",
            marginBottom: 12,
          }}
        />
      ) : null}
      <button
        type="button"
        className="button button-secondary"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
      >
        <Upload size={16} />
        {file
          ? "Choose another photo"
          : kind === "food"
            ? "Take or upload a meal photo"
            : "Choose your photo"}
      </button>
      {file ? (
        <span
          className="inline-note"
          style={{ display: "block", marginTop: 8 }}
        >
          {file.name}
        </span>
      ) : null}
    </div>
  );

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="modal-head">
          <div>
            <span className="eyebrow">{labelFor[kind]}</span>
            <h2 id={titleId}>{titles[kind]}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
            disabled={busy}
          >
            <X size={21} />
          </button>
        </div>
        <form onSubmit={submit}>
          {kind === "food" && (
            <>
              <p className="inline-note">
                A photo is a starting point. You always confirm the portions,
                nutrition and meal before it’s logged.
              </p>
              {photoPicker}
              <button
                type="button"
                className="button button-secondary"
                onClick={analyze}
                disabled={!file || busy}
                style={{ marginTop: 10 }}
              >
                {busy ? (
                  <LoaderCircle size={16} className="spin" />
                ) : (
                  <Sparkles size={16} />
                )}
                Estimate with AI
              </button>
              {onSetup && (
                <button
                  type="button"
                  className="text-button"
                  style={{ marginTop: 14, display: "flex" }}
                  onClick={onSetup}
                >
                  Need to connect AI? Open the step-by-step guide
                </button>
              )}
              {estimate && (
                <p className="inline-note" role="status">
                  {estimate}
                </p>
              )}
              <div className="form-grid" style={{ marginTop: 20 }}>
                <label className="field" style={{ gridColumn: "1 / -1" }}>
                  <span>What did you eat?</span>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                    maxLength={100}
                    placeholder="e.g. Greek yoghurt with berries"
                  />
                </label>
                {numberField("Calories (kcal)", calories, setCalories, {
                  min: 1,
                  max: 10000,
                  required: true,
                })}
                <label className="field">
                  <span>Meal</span>
                  <select
                    aria-label="Meal"
                    value={mealType}
                    onChange={(event) => setMealType(event.target.value)}
                  >
                    {["Breakfast", "Lunch", "Dinner", "Snack"].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
                {numberField("Protein (g)", protein, setProtein, {
                  min: 0,
                  max: 1000,
                  step: 0.1,
                })}
                {numberField("Carbohydrates (g)", carbs, setCarbs, {
                  min: 0,
                  max: 2000,
                  step: 0.1,
                })}
                {numberField("Fat (g)", fat, setFat, {
                  min: 0,
                  max: 1000,
                  step: 0.1,
                })}
                <label className="field">
                  <span>Date</span>
                  <input
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    max={localDate(new Date())}
                    required
                  />
                </label>
              </div>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  marginTop: 16,
                  fontSize: 13,
                }}
              >
                <input
                  type="checkbox"
                  checked={saveFavorite}
                  onChange={(event) => setSaveFavorite(event.target.checked)}
                />
                Save as a favourite snack
              </label>
            </>
          )}
          {kind === "weight" && (
            <>
              <p className="inline-note">
                Daily fluctuations are normal. Your longer-term trend matters
                more than any one number.
              </p>
              <div className="form-grid">
                {numberField("Weight (kg)", weight, setWeight, {
                  min: 30,
                  max: 400,
                  step: 0.1,
                  required: true,
                })}
                <label className="field">
                  <span>Date</span>
                  <input
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    max={localDate(new Date())}
                    required
                  />
                </label>
              </div>
            </>
          )}
          {kind === "activity" && (
            <>
              <p className="inline-note">
                Choose movement you enjoy. Exercise calories are estimates; your
                budget uses a conservative share and never adds them twice to
                Fitbit totals.
              </p>
              <div className="form-grid">
                <label className="field">
                  <span>Your activity</span>
                  <select
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  >
                    {Object.keys(mets).map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
                {numberField("Duration (minutes)", minutes, setMinutes, {
                  min: 1,
                  max: 480,
                  required: true,
                })}
                <label className="field">
                  <span>Date</span>
                  <input
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    max={localDate(new Date())}
                    required
                  />
                </label>
                <div className="field">
                  <span>Estimated energy</span>
                  <strong style={{ padding: "12px 0" }}>
                    {movementCalories} kcal
                  </strong>
                </div>
              </div>
            </>
          )}
          {kind === "photo" && (
            <>
              <p className="inline-note">
                For your eyes and your journey. Photos are stored with this
                app’s local data. Avoid uploading sensitive photos on a shared
                computer.
              </p>
              {photoPicker}
              <label className="field" style={{ marginTop: 18 }}>
                <span>Caption (optional)</span>
                <input
                  value={caption}
                  onChange={(event) => setCaption(event.target.value)}
                  maxLength={160}
                  placeholder="A little stronger, a little more me"
                />
              </label>
            </>
          )}
          {(kind === "goal" || kind === "settings") && (
            <>
              <p className="inline-note">
                A starting estimate for adults. Your target adjusts with your
                weight; progress dates are guides, never promises.
              </p>
              <div className="form-grid">
                <label className="field" style={{ gridColumn: "1 / -1" }}>
                  <span>Your name</span>
                  <input
                    value={draft.name}
                    onChange={(event) =>
                      setDraft((previous) => ({
                        ...previous,
                        name: event.target.value,
                      }))
                    }
                    maxLength={60}
                    required
                  />
                </label>
                {profileNumber("Age", "age", 18, 100)}
                <label className="field">
                  <span>Sex used for energy estimate</span>
                  <select
                    value={draft.sex}
                    onChange={(event) =>
                      setDraft((previous) => ({
                        ...previous,
                        sex: event.target.value as Profile["sex"],
                      }))
                    }
                  >
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                  </select>
                </label>
                {profileNumber("Height (cm)", "heightCm", 120, 230, 0.1)}
                <label className="field">
                  <span>Usual activity</span>
                  <select
                    value={draft.activity}
                    onChange={(event) =>
                      setDraft((previous) => ({
                        ...previous,
                        activity: event.target.value as Profile["activity"],
                      }))
                    }
                  >
                    <option value="sedentary">Mostly sitting</option>
                    <option value="light">Lightly active</option>
                    <option value="moderate">Moderately active</option>
                    <option value="active">Very active</option>
                  </select>
                </label>
                {profileNumber(
                  "Starting weight (kg)",
                  "startWeightKg",
                  30,
                  400,
                  0.1,
                )}
                {profileNumber(
                  "Current weight (kg)",
                  "currentWeightKg",
                  30,
                  400,
                  0.1,
                )}
                {profileNumber(
                  "Goal weight (kg)",
                  "goalWeightKg",
                  30,
                  400,
                  0.1,
                )}
                <label className="field">
                  <span>Your pace</span>
                  <select
                    value={draft.pace}
                    onChange={(event) =>
                      setDraft((previous) => ({
                        ...previous,
                        pace: event.target.value as Profile["pace"],
                      }))
                    }
                  >
                    <option value="slow">Slow · 250 kcal deficit</option>
                    <option value="moderate">
                      Moderate · 500 kcal deficit
                    </option>
                    <option value="aggressive">
                      Faster · up to 750 kcal deficit
                    </option>
                  </select>
                </label>
                <label className="field" style={{ gridColumn: "1 / -1" }}>
                  <span>Preferred goal date (optional)</span>
                  <input
                    type="date"
                    value={draft.targetDate || ""}
                    min={localDate(new Date())}
                    onChange={(event) =>
                      setDraft((previous) => ({
                        ...previous,
                        targetDate: event.target.value || undefined,
                      }))
                    }
                  />
                </label>
              </div>
              {plan && (
                <div
                  className="plan-preview"
                  style={{
                    marginTop: 18,
                    padding: 16,
                    borderRadius: 14,
                    background: "#eef4e8",
                  }}
                >
                  <strong>
                    {Math.round(plan.dailyTarget).toLocaleString()} kcal / day
                  </strong>
                  <span
                    className="inline-note"
                    style={{ display: "block", marginTop: 5 }}
                  >
                    Estimated {Math.round(plan.deficit)} kcal daily deficit ·
                    approximately {plan.weeklyLossKg.toFixed(2)} kg / week
                  </span>
                  {plan.goalDate && (
                    <span
                      className="inline-note"
                      style={{ display: "block", marginTop: 5 }}
                    >
                      Estimated goal:{" "}
                      {new Date(`${plan.goalDate}T12:00:00`).toLocaleDateString(
                        "en-AU",
                        { day: "numeric", month: "short", year: "numeric" },
                      )}{" "}
                      · about {plan.daysToGoal} days
                    </span>
                  )}
                  {draft.targetDate && (
                    <span
                      className="inline-note"
                      style={{ display: "block", marginTop: 5 }}
                    >
                      Your requested date needs an estimated{" "}
                      {Math.round(plan.requestedDeficit).toLocaleString()} kcal
                      daily deficit. The plan applies its calorie limits.
                    </span>
                  )}
                  {plan.warnings.map((warning, index) => (
                    <p key={index} className="inline-note">
                      {warning}
                    </p>
                  ))}
                </div>
              )}
              <p className="inline-note">
                If you’re pregnant, breastfeeding, managing a medical condition
                or have a history of disordered eating, agree on a personalised
                plan with your clinician.
              </p>
            </>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div
            className="modal-actions"
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
              marginTop: 24,
            }}
          >
            <button
              type="button"
              className="button button-secondary"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="button button-primary"
              disabled={busy}
            >
              {busy ? (
                <LoaderCircle size={17} className="spin" />
              ) : kind === "photo" ? (
                <Camera size={17} />
              ) : (
                <Check size={17} />
              )}{" "}
              {kind === "food"
                ? "Confirm & log meal"
                : kind === "weight"
                  ? "Save weight"
                  : kind === "activity"
                    ? "Log movement"
                    : kind === "photo"
                      ? "Save progress photo"
                      : "Save my plan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
function safePlan(profile: Profile) {
  try {
    return getPlan(profile);
  } catch {
    return null;
  }
}
