import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  Camera,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Droplets,
  Dumbbell,
  Flame,
  Footprints,
  Heart,
  LayoutDashboard,
  Leaf,
  LoaderCircle,
  LogOut,
  Minus,
  Moon,
  Plus,
  Settings2,
  Sparkles,
  Sprout,
  Target,
  Trash2,
  TrendingDown,
  Utensils,
  Watch,
  X,
} from "lucide-react";
import EntryModal from "./components/EntryModal";
import PrivateSpace from "./components/PrivateSpace";
import ConnectionGuide from "./components/ConnectionGuide";
import { apiFetch } from "./lib/api";
import {
  getPlan,
  getDailyBudget,
  getBankAvailable,
  getProjection,
  localDate,
  type Profile,
} from "./lib/engine";

type Meal = {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  mealType: string;
  date: string;
};
type Weight = { weightKg: number; date: string };
type Activity = {
  id: string;
  name: string;
  minutes: number;
  calories: number;
  date: string;
};
type Photo = { id: string; url: string; createdAt: string; caption: string };
type Fitbit = {
  date: string;
  steps: number;
  caloriesOut: number;
  workouts: {
    id: string;
    name: string;
    durationMinutes: number;
    calories: number;
  }[];
  weightKg: number | null;
  lastSyncedAt: string;
  sleepMinutes?: number;
  restingHeartRate?: number;
};
type Favorite = { id: string; name: string; calories: number; emoji: string };
type State = {
  version: 1;
  demo: boolean;
  profile: Profile;
  meals: Meal[];
  weights: Weight[];
  activities: Activity[];
  water: Record<string, number>;
  waterGoal: number;
  stepGoal: number;
  manualSteps: Record<string, number>;
  photos: Photo[];
  completed: Record<string, number>;
  hunger: Record<string, number>;
  bankUsed: Record<string, number>;
  favorites: Favorite[];
  fitbit: Fitbit | null;
};
type Tab = "today" | "food" | "progress" | "evening";
const uid = () => crypto.randomUUID();
const shiftDate = (date: string, n: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + n * 86400000)
    .toISOString()
    .slice(0, 10);
const dateOffset = (n: number) => shiftDate(localDate(new Date()), n);
const prettyDate = (
  date: string,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" },
) => new Date(`${date}T12:00:00`).toLocaleDateString("en-AU", options);
const number = (v: number) => Math.round(v).toLocaleString("en-AU");
const favorites: Favorite[] = [
  { id: "popcorn", name: "Air-popped popcorn", calories: 95, emoji: "🍿" },
  { id: "yogurt", name: "Greek yoghurt & berries", calories: 160, emoji: "🫐" },
  {
    id: "chocolate",
    name: "A little dark chocolate",
    calories: 110,
    emoji: "🍫",
  },
  { id: "toast", name: "Peanut butter on toast", calories: 220, emoji: "🥜" },
  { id: "apple", name: "Apple & peanut butter", calories: 190, emoji: "🍎" },
];
function initialState(): State {
  const today = localDate(new Date());
  return {
    version: 1,
    demo: true,
    profile: {
      name: "Alex",
      age: 34,
      heightCm: 178,
      sex: "male",
      activity: "moderate",
      startWeightKg: 88.4,
      currentWeightKg: 84.2,
      goalWeightKg: 78,
      pace: "moderate",
    },
    meals: [
      {
        id: uid(),
        name: "Greek yoghurt, berries & granola",
        calories: 345,
        protein: 22,
        carbs: 42,
        fat: 10,
        mealType: "Breakfast",
        date: today,
      },
      {
        id: uid(),
        name: "Chicken & avocado nourish bowl",
        calories: 520,
        protein: 38,
        carbs: 48,
        fat: 19,
        mealType: "Lunch",
        date: today,
      },
      {
        id: uid(),
        name: "Salmon with roasted vegetables",
        calories: 490,
        protein: 36,
        carbs: 32,
        fat: 23,
        mealType: "Dinner",
        date: today,
      },
    ],
    weights: [
      { date: dateOffset(-35), weightKg: 88.4 },
      { date: dateOffset(-28), weightKg: 87.8 },
      { date: dateOffset(-21), weightKg: 86.6 },
      { date: dateOffset(-14), weightKg: 86.2 },
      { date: dateOffset(-7), weightKg: 85.1 },
      { date: today, weightKg: 84.2 },
    ],
    activities: [
      { id: uid(), name: "Walking", minutes: 40, calories: 180, date: today },
    ],
    water: { [today]: 1250 },
    waterGoal: 2500,
    stepGoal: 10000,
    manualSteps: { [today]: 6842 },
    photos: [],
    completed: {},
    hunger: {},
    bankUsed: {},
    favorites,
    fitbit: null,
  };
}
function Mascot({ small = false }: { small?: boolean }) {
  return (
    <svg
      className={small ? "mascot small" : "mascot"}
      viewBox="0 0 140 140"
      aria-hidden="true"
    >
      <path d="M74 32C65 9 35 15 42 31c6 13 26 10 32 10" fill="#a9bb72" />
      <path d="M72 39c1-26 31-33 32-17 1 13-19 21-31 22" fill="#5f8057" />
      <path
        d="M71 43c1-10 0-16-3-21"
        stroke="#476646"
        strokeWidth="3"
        fill="none"
      />
      <path
        d="M28 84C22 51 46 37 71 40c31-2 50 20 45 48-4 29-21 40-45 39S30 113 28 84Z"
        fill="#d6e5ad"
      />
      <path
        d="M28 83 13 91m102-9 13 7"
        stroke="#698158"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <ellipse cx="54" cy="77" rx="3" ry="5" fill="#354f3b" />
      <ellipse cx="87" cy="77" rx="3" ry="5" fill="#354f3b" />
      <path
        d="M63 89q8 9 16-1"
        fill="none"
        stroke="#354f3b"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <ellipse cx="45" cy="87" rx="7" ry="4" fill="#edb49c" />
      <ellipse cx="97" cy="87" rx="7" ry="4" fill="#edb49c" />
      <path
        d="m51 122-4 10m40-9 4 9"
        stroke="#698158"
        strokeWidth="6"
        strokeLinecap="round"
      />
    </svg>
  );
}
function App({
  privateMode = false,
  onSignOut,
}: {
  privateMode?: boolean;
  onSignOut?: () => Promise<void>;
}) {
  const [state, setState] = useState<State>(initialState);
  const [loaded, setLoaded] = useState(false);
  const [storage, setStorage] = useState("Loading your space…");
  const [tab, setTab] = useState<Tab>("today");
  const [modal, setModal] = useState<
    "food" | "weight" | "goal" | "activity" | "photo" | "settings" | null
  >(null);
  const [toast, setToast] = useState("");
  const [connect, setConnect] = useState(false);
  const [guide, setGuide] = useState(false);
  const autoSyncAt = useRef(0);
  const [help, setHelp] = useState(false);
  const [startingFresh, setStartingFresh] = useState(false);
  const [busy, setBusy] = useState(false);
  const [integrations, setIntegrations] = useState({
    fitbit: {
      configured: false,
      connected: false,
      lastSyncedAt: null as string | null,
    },
    ai: { configured: false },
  });
  const [selectedDay, setSelectedDay] = useState(localDate(new Date()));
  const [search, setSearch] = useState("");
  const [mealFilter, setMealFilter] = useState("All meals");
  const [hunger, setHunger] = useState(5);
  const [favoriteOpen, setFavoriteOpen] = useState(false);
  const [aiSnackBusy, setAiSnackBusy] = useState(false);
  const [aiSnackReasons, setAiSnackReasons] = useState<Record<string, string>>(
    {},
  );
  const [aiSnackNote, setAiSnackNote] = useState("");
  const [notificationPermission, setNotificationPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "denied",
  );
  const [now, setNow] = useState(new Date());
  const saveSeq = useRef(0);
  const today = localDate(now);
  const p = state.profile;
  const plan = getPlan(p, now);
  const dayMeals = state.meals.filter((m) => m.date === today);
  const consumed = dayMeals.reduce((s, m) => s + m.calories, 0);
  const activities = state.activities.filter((a) => a.date === today);
  const manualCalories = activities.reduce((s, a) => s + a.calories, 0);
  const fitbit = state.fitbit?.date === today ? state.fitbit : null;
  const pastDays = Object.entries(state.completed).map(
    ([date, targetCalories]) => ({
      date,
      targetCalories,
      consumedCalories: state.meals
        .filter((m) => m.date === date)
        .reduce((s, m) => s + m.calories, 0),
      complete: true,
      minimumCalories: plan.minimumCalories,
    }),
  );
  const bank = getBankAvailable(pastDays, today, state.bankUsed);
  const bankCredit = state.bankUsed[today] || 0;
  const budget = getDailyBudget(
    p,
    {
      consumedCalories: consumed,
      manualExerciseCalories: manualCalories,
      fitbitCaloriesOut:
        fitbit && fitbit.caloriesOut > 0 ? fitbit.caloriesOut : undefined,
      bankCredit,
    },
    now,
  );
  const remaining = Math.max(0, budget.remaining);
  const water = state.water[today] || 0;
  const steps = fitbit?.steps ?? state.manualSteps[today] ?? 0;
  const lost = Math.max(0, p.startWeightKg - p.currentWeightKg);
  const progress = Math.min(
    100,
    Math.max(
      0,
      p.startWeightKg > p.goalWeightKg
        ? (lost / (p.startWeightKg - p.goalWeightKg)) * 100
        : 0,
    ),
  );
  const milestone = Math.max(
    p.goalWeightKg,
    Math.ceil(p.currentWeightKg / 5) * 5 - 5,
  );
  const projection = getProjection(
    state.weights,
    p.goalWeightKg,
    plan.deficit,
    now,
  );
  const projectedDate =
    plan.deficit > 0
      ? projection.source === "trend"
        ? projection.goalDate
        : plan.goalDate
      : plan.goalDate;
  const projectedDays = projectedDate
    ? Math.max(0, (Date.parse(projectedDate) - Date.parse(today)) / 86400000)
    : 0;
  const milestoneDays =
    p.currentWeightKg > p.goalWeightKg
      ? Math.ceil(
          (projectedDays * (p.currentWeightKg - milestone)) /
            (p.currentWeightKg - p.goalWeightKg),
        )
      : 0;
  const milestoneDate = prettyDate(shiftDate(today, milestoneDays), {
    day: "numeric",
    month: "long",
  });
  const goalDate = projectedDate
    ? prettyDate(projectedDate, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Needs a plan review";
  const notify = (message: string) => setToast(message);
  const change = (fn: (s: State) => State) => setState((s) => fn(s));
  useEffect(() => {
    let active = true;
    Promise.all([
      apiFetch("/api/state").then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      }),
      apiFetch("/api/integrations")
        .then((r) => r.json())
        .catch(() => null),
    ])
      .then(([data, config]) => {
        if (!active) return;
        if (data.state?.version === 1) {
          data.state.bankUsed = Object.fromEntries(
            Object.entries(data.state.bankUsed || {}).map(([d, v]) => [
              d,
              typeof v === "number" ? v : v ? 200 : 0,
            ]),
          );
          setState(data.state);
        }
        if (config?.fitbit) setIntegrations(config);
        setStorage(
          privateMode ? "Saved in your private space" : "Saved on this device",
        );
      })
      .catch(() => {
        if (!active) return;
        try {
          const cached = privateMode
            ? null
            : localStorage.getItem("lighter-state");
          if (cached) setState(JSON.parse(cached));
        } catch {}
        setStorage(
          privateMode
            ? "Connection lost · changes not saved"
            : "Browser storage · API offline",
        );
      })
      .finally(() => active && setLoaded(true));
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!loaded) return;
    if (!privateMode)
      localStorage.setItem("lighter-state", JSON.stringify(state));
    const seq = ++saveSeq.current;
    const timer = setTimeout(() => {
      apiFetch("/api/state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      })
        .then((r) => {
          if (!r.ok) throw Error();
          if (seq === saveSeq.current)
            setStorage(
              privateMode
                ? "Saved in your private space"
                : "Saved on this device",
            );
        })
        .catch(
          () =>
            seq === saveSeq.current &&
            setStorage(
              privateMode
                ? "Connection lost · changes not saved"
                : "Browser storage · API offline",
            ),
        );
    }, 500);
    return () => clearTimeout(timer);
  }, [state, loaded, privateMode]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("fitbit")) {
      setConnect(true);
      if (params.get("fitbit") === "connected")
        notify("Fitbit connected. Sync your day to get started.");
      else
        notify(
          params.get("fitbit") === "denied"
            ? "Fitbit connection was cancelled. Your manual logs are still here."
            : "Fitbit could not connect. Check the registered app settings and try again.",
        );
      history.replaceState({}, "", location.pathname);
    }
  }, []);
  const acstHour = Number(
    new Intl.DateTimeFormat("en-AU", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: "Australia/Darwin",
    }).format(now),
  );
  const acstDay = localDate(now, "Australia/Darwin");
  const checkInDue = acstHour >= 19 && state.hunger[acstDay] === undefined;
  useEffect(() => {
    if (checkInDue && notificationPermission === "granted") {
      const key = `lighter-reminded-${acstDay}`;
      if (!localStorage.getItem(key)) {
        new Notification("Your little evening check-in", {
          body: "How hungry are you? Let’s find something you’ll enjoy.",
        });
        localStorage.setItem(key, "true");
      }
    }
  }, [checkInDue, notificationPermission, acstDay]);
  async function sync() {
    setBusy(true);
    try {
      const res = await apiFetch("/api/fitbit/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: today }),
      });
      const data = await res.json();
      if (!res.ok) throw Error(data.message || "Unable to sync Fitbit");
      change((s) => {
        const validWeight =
          Number.isFinite(data.weightKg) &&
          data.weightKg >= 30 &&
          data.weightKg <= 400 &&
          typeof data.weightDate === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(data.weightDate) &&
          data.weightDate <= today;
        const weights = validWeight
          ? [
              ...s.weights.filter((w) => w.date !== data.weightDate),
              { date: data.weightDate, weightKg: data.weightKg },
            ].sort((a, b) => a.date.localeCompare(b.date))
          : s.weights;
        return {
          ...s,
          fitbit: data,
          weights,
          profile: {
            ...s.profile,
            currentWeightKg:
              weights.at(-1)?.weightKg ?? s.profile.currentWeightKg,
          },
        };
      });
      setIntegrations((v) => ({
        ...v,
        fitbit: {
          ...v.fitbit,
          connected: true,
          lastSyncedAt: data.lastSyncedAt,
        },
      }));
      notify("Your Fitbit day is up to date.");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!loaded || state.demo || !integrations.fitbit.connected || busy) return;
    const last = state.fitbit?.lastSyncedAt
      ? Date.parse(state.fitbit.lastSyncedAt)
      : 0;
    if (
      now.getTime() - Math.max(last, autoSyncAt.current) < 15 * 60000 &&
      state.fitbit?.date === today
    )
      return;
    if (now.getTime() - autoSyncAt.current < 15 * 60000) return;
    autoSyncAt.current = now.getTime();
    void sync();
  }, [loaded, state.demo, integrations.fitbit.connected, now, today]);
  function refreshConnections() {
    apiFetch("/api/integrations")
      .then((r) => r.json())
      .then((config) => {
        if (config.fitbit) setIntegrations(config);
      })
      .catch(() => notify("Could not refresh connections. Please try again."));
  }
  function save(value: Record<string, unknown>) {
    if (modal === "food") {
      change((s) => ({
        ...s,
        meals: [...s.meals, { ...value, id: uid() } as Meal],
        favorites:
          value.favorite &&
          !s.favorites.some(
            (f) => f.name.toLowerCase() === String(value.name).toLowerCase(),
          )
            ? [
                ...s.favorites,
                {
                  id: uid(),
                  name: String(value.name),
                  calories: Number(value.calories),
                  emoji: "🍪",
                },
              ]
            : s.favorites,
      }));
      notify("Meal logged. A little more balance.");
    }
    if (modal === "weight") {
      const w = value as unknown as Weight;
      change((s) => {
        const weights = [...s.weights.filter((x) => x.date !== w.date), w].sort(
          (a, b) => a.date.localeCompare(b.date),
        );
        return {
          ...s,
          weights,
          profile: { ...s.profile, currentWeightKg: weights.at(-1)!.weightKg },
        };
      });
      notify("Weight recorded. Every check-in counts.");
    }
    if (modal === "goal" || modal === "settings") {
      if (startingFresh) {
        const fresh = initialState();
        change(() => ({
          ...fresh,
          demo: false,
          profile: value as unknown as Profile,
          meals: [],
          weights: [{ date: today, weightKg: Number(value.currentWeightKg) }],
          activities: [],
          water: {},
          manualSteps: {},
          completed: {},
          hunger: {},
          photos: [],
          bankUsed: {},
          fitbit: null,
        }));
        setStartingFresh(false);
      } else change((s) => ({ ...s, profile: value as unknown as Profile }));
      notify("Your plan has been updated.");
    }
    if (modal === "activity") {
      change((s) => ({
        ...s,
        activities: [...s.activities, { ...value, id: uid() } as Activity],
      }));
      notify("Movement logged. Nice work showing up.");
    }
    if (modal === "photo") {
      change((s) => ({
        ...s,
        photos: [...s.photos, value as unknown as Photo],
      }));
      notify("Progress photo saved privately on this device.");
    }
    setModal(null);
  }
  function startFresh() {
    setStartingFresh(true);
    setModal("goal");
  }
  function logSnack(f: Favorite) {
    change((s) => ({
      ...s,
      meals: [
        ...s.meals,
        {
          id: uid(),
          name: f.name,
          calories: f.calories,
          protein: 0,
          carbs: 0,
          fat: 0,
          mealType: "Snack",
          date: today,
        },
      ],
    }));
    notify(
      `${f.name} logged. Macros weren’t provided; edit by removing and logging manually.`,
    );
  }
  function addWater(amount: number) {
    change((s) => ({
      ...s,
      water: {
        ...s.water,
        [today]: Math.max(0, (s.water[today] || 0) + amount),
      },
    }));
  }
  async function suggestWithAI() {
    setAiSnackBusy(true);
    try {
      const res = await apiFetch("/api/snacks/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          favorites: state.favorites,
          remainingCalories: remaining,
          hunger,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw Error(result.message || "Suggestions unavailable");
      setAiSnackReasons(
        Object.fromEntries(
          result.suggestions.map((v: { id: string; reason: string }) => [
            v.id,
            v.reason,
          ]),
        ),
      );
      setAiSnackNote(
        result.note ||
          "Suggestions based on your favourites, hunger and estimated budget.",
      );
    } catch (e) {
      notify(e instanceof Error ? e.message : "Could not get suggestions");
    } finally {
      setAiSnackBusy(false);
    }
  }
  const wins = Object.keys(state.completed).filter(
    (d) => d >= dateOffset(-6) && d <= today,
  ).length;
  const level =
    wins >= 5
      ? "Finding your rhythm"
      : wins >= 2
        ? "Growing good habits"
        : "A fresh little start";
  const nav = [
    { id: "today" as Tab, label: "Today", icon: LayoutDashboard },
    { id: "food" as Tab, label: "Food diary", icon: Utensils },
    { id: "progress" as Tab, label: "My progress", icon: TrendingDown },
    { id: "evening" as Tab, label: "Evening check-in", icon: Moon },
  ];
  function SnackList({ full = false }: { full?: boolean }) {
    const available = state.favorites
      .filter((f) => f.calories <= remaining)
      .sort(
        (a, b) =>
          Number(!!aiSnackReasons[b.id]) - Number(!!aiSnackReasons[a.id]),
      )
      .slice(0, full ? 12 : 3);
    return (
      <div className="snack-list">
        {available.length ? (
          available.map((f) => (
            <div className="snack-item" key={f.id}>
              <span className="food-emoji">{f.emoji}</span>
              <div>
                <strong>{f.name}</strong>
                <span>
                  {f.calories} kcal ·{" "}
                  {aiSnackReasons[f.id] || "your favourites"}
                </span>
              </div>
              <button
                className="icon-button snack-add"
                aria-label={`Log ${f.name}`}
                onClick={() => logSnack(f)}
              >
                <Plus size={16} />
              </button>
            </div>
          ))
        ) : (
          <p className="inline-note">
            Your estimated budget is used today. If you’re hungry, it’s okay to
            eat—your needs come first.
          </p>
        )}
      </div>
    );
  }
  function WeightChart({ large = false }: { large?: boolean }) {
    const weights = [...state.weights].sort((a, b) =>
      a.date.localeCompare(b.date),
    );
    const values = weights.map((w) => w.weightKg);
    const max = Math.max(p.startWeightKg, ...values) + 0.5,
      min = Math.min(p.goalWeightKg, ...values) - 0.5;
    const coords = weights.map(
      (w, i) =>
        `${35 + (weights.length > 1 ? (Date.parse(w.date) - Date.parse(weights[0].date)) / Math.max(86400000, Date.parse(weights.at(-1)!.date) - Date.parse(weights[0].date)) : 0) * 510},${20 + ((max - w.weightKg) / (max - min)) * 140}`,
    );
    return (
      <div className={`weight-chart ${large ? "large" : ""}`}>
        <svg
          viewBox="0 0 580 210"
          role="img"
          aria-label={`Weight history from ${weights[0]?.weightKg ?? p.currentWeightKg} to ${weights.at(-1)?.weightKg ?? p.currentWeightKg} kilograms`}
        >
          <defs>
            <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#b8cba8" stopOpacity=".45" />
              <stop offset="100%" stopColor="#b8cba8" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <line
                x1="35"
                y1={30 + i * 60}
                x2="545"
                y2={30 + i * 60}
                stroke="#e9ece4"
                strokeDasharray="4 5"
              />
              <text x="5" y={34 + i * 60} fill="#9ba298" fontSize="10">
                {(max - ((i * 60 + 10) / 140) * (max - min)).toFixed(0)}
              </text>
            </g>
          ))}
          {coords.length > 1 && (
            <>
              <path
                d={`M${coords.join(" L")} L545,180 L35,180 Z`}
                fill="url(#chart-fill)"
              />
              <polyline
                points={coords.join(" ")}
                stroke="#658260"
                strokeWidth="3"
                fill="none"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </>
          )}
          {coords.map((c, i) => (
            <circle
              key={i}
              cx={c.split(",")[0]}
              cy={c.split(",")[1]}
              r={i === coords.length - 1 ? 5 : 3}
              fill={i === coords.length - 1 ? "#284e3a" : "#fff"}
              stroke="#658260"
              strokeWidth="2"
            />
          ))}
          <text x="35" y="203" fill="#8c9588" fontSize="11">
            {weights[0] ? prettyDate(weights[0].date) : "Your starting point"}
          </text>
          <text x="545" y="203" textAnchor="end" fill="#8c9588" fontSize="11">
            Today
          </text>
        </svg>
        {!weights.length && (
          <div className="chart-empty">
            Your journey starts with a weigh-in.
            <button className="text-button" onClick={() => setModal("weight")}>
              Log your first weight <ArrowRight size={14} />
            </button>
          </div>
        )}
      </div>
    );
  }
  function Meals({ diary = false }: { diary?: boolean }) {
    const date = diary ? selectedDay : today;
    const meals = state.meals.filter(
      (m) =>
        m.date === date &&
        (!diary || mealFilter === "All meals" || m.mealType === mealFilter) &&
        (!diary || m.name.toLowerCase().includes(search.toLowerCase())),
    );
    return (
      <section className="card meals-card">
        <div className="section-heading">
          <div>
            <h2>{diary ? "Your food diary" : "On the menu today"}</h2>
            <p>
              {diary
                ? "A little awareness goes a long way."
                : "Good food. No good or bad labels."}
            </p>
          </div>
          <button
            className="button button-secondary small-button"
            onClick={() => setModal("food")}
          >
            <Plus size={15} /> Log food
          </button>
        </div>
        {diary && (
          <div className="diary-filters">
            <input
              aria-label="Find a meal"
              placeholder="Find a meal…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              aria-label="Filter meal type"
              value={mealFilter}
              onChange={(e) => setMealFilter(e.target.value)}
            >
              {["All meals", "Breakfast", "Lunch", "Dinner", "Snack"].map(
                (x) => (
                  <option key={x}>{x}</option>
                ),
              )}
            </select>
          </div>
        )}
        <div className="meal-table">
          <div className="meal-table-head">
            <span>MEAL</span>
            <span>PROTEIN</span>
            <span>CALORIES</span>
            <span />
          </div>
          {meals.map((m) => (
            <div className="meal-row" key={m.id}>
              <div className="meal-description">
                <span
                  className={`meal-illustration ${m.mealType.toLowerCase()}`}
                >
                  {m.mealType === "Breakfast"
                    ? "🥣"
                    : m.mealType === "Lunch"
                      ? "🥑"
                      : m.mealType === "Dinner"
                        ? "🥗"
                        : "🍪"}
                </span>
                <div>
                  <span className="meal-type">{m.mealType}</span>
                  <strong>{m.name}</strong>
                </div>
              </div>
              <span className="meal-protein">
                {m.protein ? `${m.protein} g` : "—"}
              </span>
              <span className="meal-calories">
                {m.calories}
                <small> kcal</small>
              </span>
              <button
                className="icon-button remove-meal"
                aria-label={`Remove ${m.name}`}
                onClick={() =>
                  change((s) => ({
                    ...s,
                    meals: s.meals.filter((x) => x.id !== m.id),
                  }))
                }
              >
                <X size={14} />
              </button>
            </div>
          ))}
          {!meals.length && (
            <div className="empty-state">
              <Utensils size={27} />
              <h3>A fresh page for your day</h3>
              <p>Add your first meal, or snap a photo to get started.</p>
              <button
                className="button button-secondary"
                onClick={() => setModal("food")}
              >
                Log a meal <Plus size={15} />
              </button>
            </div>
          )}
        </div>
        <div className="meal-footer">
          <span>
            <Camera size={15} /> A photo. A quick check. All logged.
          </span>
          <button className="text-button" onClick={() => setModal("food")}>
            Try photo logging <ArrowRight size={14} />
          </button>
        </div>
      </section>
    );
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setTab("today");
          }}
        >
          <span className="brand-icon">
            <Sprout size={27} />
          </span>
          lighter<span className="brand-period">.</span>
        </a>
        <div className="workspace-label">YOUR LITTLE DAILY RESET</div>
        <nav>
          {nav.map((n) => (
            <button
              key={n.id}
              className={`nav-item ${tab === n.id ? "active" : ""}`}
              onClick={() => setTab(n.id)}
            >
              <n.icon size={19} />
              {n.label}
              {n.id === "evening" && checkInDue && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <Mascot small />
          <strong>Progress, at your pace.</strong>
          <p>
            You don’t have to be perfect.
            <br />
            You just have to keep going.
          </p>
        </div>
        <div className="sidebar-bottom">
          <button className="device-card" onClick={() => setConnect(true)}>
            <span className="device-icon">
              <Watch size={21} />
            </span>
            <span>
              <strong>Your Fitbit</strong>
              <small>
                <i
                  className={integrations.fitbit.connected ? "connected" : ""}
                />
                {integrations.fitbit.connected
                  ? "Connected"
                  : "Let’s get connected"}
              </small>
            </span>
            <ChevronRight size={16} />
          </button>
          <button className="nav-item" onClick={() => setModal("settings")}>
            <Settings2 size={18} /> My preferences
          </button>
          <div className="sidebar-divider" />
          <div className="profile-row">
            <span className="avatar">{p.name.slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>{p.name}</strong>
              <small>A little better, every day</small>
            </div>
            <button
              className="icon-button"
              aria-label="Edit your profile"
              onClick={() => setModal("settings")}
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-wrap">
        <header className="topbar">
          <div className="breadcrumb">
            Your journey <span>/</span>{" "}
            <strong>{nav.find((n) => n.id === tab)?.label}</strong>
          </div>
          <div className="topbar-actions">
            <span className="today-date">
              {now.toLocaleDateString("en-AU", {
                weekday: "short",
                day: "numeric",
                month: "long",
                timeZone: "Australia/Adelaide",
              })}
            </span>
            <button
              className={`icon-button notification-button ${checkInDue ? "has-dot" : ""}`}
              aria-label="Evening check-in reminders"
              onClick={() => setTab("evening")}
            >
              <Bell size={19} />
            </button>
            <button
              className="icon-button"
              aria-label="Set up connections"
              onClick={() => setGuide(true)}
            >
              <Settings2 size={18} />
            </button>
            {privateMode && (
              <button
                className="icon-button"
                aria-label="Sign out of Lighter"
                onClick={onSignOut}
              >
                <LogOut size={17} />
              </button>
            )}
            <span className="goal-chip">
              <Target size={12} />
              {p.goalWeightKg} kg · ~{goalDate}
            </span>
            <span className="topbar-line" />
            <button
              className="icon-button mobile-action"
              aria-label="Your Fitbit connection"
              onClick={() => setConnect(true)}
            >
              <Watch size={18} />
            </button>
            <button
              className="icon-button mobile-action"
              aria-label="Your preferences"
              onClick={() => setModal("settings")}
            >
              <Settings2 size={18} />
            </button>
            <button
              className="icon-button"
              aria-label="How Lighter works"
              onClick={() => setHelp(true)}
            >
              <CircleHelp size={19} />
            </button>
          </div>
        </header>
        <main>
          {state.demo && (
            <div className="demo-banner">
              <span>
                <Sparkles size={14} /> You’re exploring a sample journey. Make
                this space yours whenever you’re ready.
              </span>
              <button onClick={startFresh}>
                Start my journey <ArrowRight size={14} />
              </button>
            </div>
          )}
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <span className="tiny-sun">✳</span>{" "}
                {tab === "today"
                  ? "ONE DAY AT A TIME"
                  : tab === "food"
                    ? "MAKE ROOM FOR WHAT YOU LOVE"
                    : tab === "progress"
                      ? "LOOK HOW FAR YOU’VE COME"
                      : "A LITTLE MOMENT FOR YOU"}
              </div>
              <h1>
                {tab === "today" ? (
                  <>
                    A little more balance, {p.name}
                    <span className="heading-dot">.</span>
                  </>
                ) : tab === "food" ? (
                  "Good food. A lighter mind."
                ) : tab === "progress" ? (
                  "Small steps. Real progress."
                ) : (
                  "Your evening, made easier."
                )}
              </h1>
              <p>
                {tab === "today"
                  ? "Your food, movement and little wins. All in one happy place."
                  : tab === "food"
                    ? "All your meals, snacks and in-between moments."
                    : tab === "progress"
                      ? "There’s more to your journey than a number on the scales."
                      : "Check in with your hunger. Make room for something you enjoy."}
              </p>
            </div>
            <button
              className="button button-primary"
              onClick={() => setModal(tab === "progress" ? "weight" : "food")}
            >
              {tab === "progress" ? (
                <TrendingDown size={17} />
              ) : (
                <Plus size={18} />
              )}{" "}
              {tab === "progress" ? "Log weight" : "Log food"}
            </button>
          </div>
          {tab === "today" && (
            <>
              {plan.warnings.length > 0 && (
                <div className="inline-note" role="status">
                  {plan.warnings.join(" ")}
                </div>
              )}
              <div className="dashboard-top">
                <section className="energy-card">
                  <div className="energy-heading">
                    <span>
                      <span className="status-light" /> YOUR DAILY BALANCE
                    </span>
                    <span className="energy-date">
                      Today <Leaf size={14} />
                    </span>
                  </div>
                  <div className="energy-main">
                    <div className="energy-copy">
                      <div className="balance-label">
                        A little room to enjoy
                      </div>
                      <div className="big-number">
                        {number(remaining)}
                        <span>kcal left</span>
                      </div>
                      <p>
                        {consumed <= budget.target
                          ? "Nourish yourself. You’re making room for progress."
                          : "You’re over the estimate today. Tomorrow is a fresh day."}
                      </p>
                      <button
                        className="energy-plan"
                        onClick={() => setModal("goal")}
                      >
                        {plan.deficit} kcal deficit · {p.pace}{" "}
                        <ArrowUpRight size={14} />
                      </button>
                    </div>
                    <div className="calorie-ring">
                      <svg viewBox="0 0 180 180">
                        <circle
                          cx="90"
                          cy="90"
                          r="76"
                          fill="none"
                          stroke="#47644e"
                          strokeWidth="11"
                        />
                        <circle
                          cx="90"
                          cy="90"
                          r="76"
                          fill="none"
                          stroke="#d3e2a6"
                          strokeWidth="11"
                          strokeLinecap="round"
                          strokeDasharray={`${Math.min(1, consumed / budget.target) * 477.5} 477.5`}
                          transform="rotate(-90 90 90)"
                        />
                      </svg>
                      <div>
                        <Utensils size={21} />
                        <strong>
                          {Math.round(
                            Math.min(100, (consumed / budget.target) * 100),
                          )}
                          %
                        </strong>
                        <span>of today’s budget</span>
                      </div>
                    </div>
                  </div>
                  <div className="energy-stats">
                    <div>
                      <span>
                        <Utensils size={13} /> Eaten
                      </span>
                      <strong>
                        {number(consumed)} <small>kcal</small>
                      </strong>
                    </div>
                    <div>
                      <span>
                        <Target size={14} />{" "}
                        {fitbit ? "Projected budget" : "Daily budget"}
                      </span>
                      <strong>
                        {number(budget.target)} <small>kcal</small>
                      </strong>
                    </div>
                    <div>
                      <span>
                        <Flame size={14} /> Movement credit
                      </span>
                      <strong>
                        +{number(budget.exerciseCredit)} <small>kcal</small>
                      </strong>
                    </div>
                  </div>
                </section>
                <section className="card goal-card">
                  <div className="section-heading">
                    <h2>Your next little milestone</h2>
                    <span className="round-icon pale">
                      <Target size={17} />
                    </span>
                  </div>
                  <div className="milestone-number">
                    {milestone.toFixed(1)} <span>kg</span>
                    <span className="milestone-pill">
                      <TrendingDown size={12} /> In sight
                    </span>
                  </div>
                  <p>
                    {plan.deficit > 0
                      ? "Estimated around "
                      : "Your estimate needs "}
                    <strong>
                      {projectedDate ? milestoneDate : "a plan review"}
                    </strong>
                  </p>
                  <div className="journey-track">
                    <span style={{ width: `${progress}%` }} />
                    <i style={{ left: `${Math.min(96, progress)}%` }}>
                      <Leaf size={12} />
                    </i>
                  </div>
                  <div className="journey-track-labels">
                    <span>
                      {p.startWeightKg} kg<small>Starting point</small>
                    </span>
                    <span>
                      {p.goalWeightKg} kg<small>Your goal</small>
                    </span>
                  </div>
                  <div className="goal-footer">
                    <div>
                      <span>GOAL WEIGHT, AROUND</span>
                      <strong>{goalDate}</strong>
                    </div>
                    <button
                      className="icon-button"
                      aria-label="Adjust your goal"
                      onClick={() => setModal("goal")}
                    >
                      <ArrowUpRight size={20} />
                    </button>
                  </div>
                </section>
              </div>
              <div className="section-label">
                <h2>Your day, in balance</h2>
                <span className="wins-label">
                  <Sprout size={12} />
                  {wins}/7 diaries complete · {level}
                </span>
              </div>
              <div className="metrics-grid">
                <section className="card metric-card">
                  <div className="metric-title">
                    <span className="round-icon blue">
                      <Droplets size={18} />
                    </span>
                    <h3>A little hydration</h3>
                    <button
                      className="icon-button"
                      aria-label="Remove 250ml water"
                      onClick={() => addWater(-250)}
                    >
                      <Minus size={14} />
                    </button>
                  </div>
                  <div className="metric-value">
                    {(water / 1000).toFixed(2).replace(/0$/, "")}
                    <small> / {(state.waterGoal / 1000).toFixed(1)} L</small>
                    <button
                      className="add-water"
                      onClick={() => addWater(250)}
                      aria-label="Add 250ml water"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  <div className="water-glasses">
                    {Array.from({ length: 10 }, (_, i) => (
                      <div
                        key={i}
                        className={
                          i < Math.floor((water / state.waterGoal) * 10)
                            ? "filled"
                            : ""
                        }
                      />
                    ))}
                  </div>
                  <p>
                    {water >= state.waterGoal
                      ? "A well-watered day. Lovely work."
                      : "One glass closer. +250 ml at a time."}
                  </p>
                </section>
                <section className="card metric-card">
                  <div className="metric-title">
                    <span className="round-icon peach">
                      <Footprints size={18} />
                    </span>
                    <h3>Steps in the right direction</h3>
                  </div>
                  <div className="metric-value">
                    {number(steps)}
                    <small> / {number(state.stepGoal)}</small>
                    <span className="metric-percent">
                      {Math.round((steps / state.stepGoal) * 100)}%
                    </span>
                  </div>
                  <div className="thin-progress peach-track">
                    <span
                      style={{
                        width: `${Math.min(100, (steps / state.stepGoal) * 100)}%`,
                      }}
                    />
                  </div>
                  <p>
                    {fitbit
                      ? "Synced from your Fitbit"
                      : state.demo
                        ? "Sample steps · connect Fitbit for yours"
                        : "Manual steps · Fitbit not connected"}{" "}
                    <button
                      className="text-button"
                      onClick={() => {
                        const v = prompt("Steps today", String(steps));
                        if (
                          v !== null &&
                          Number.isInteger(Number(v)) &&
                          Number(v) >= 0 &&
                          Number(v) <= 150000
                        )
                          change((s) => ({
                            ...s,
                            manualSteps: {
                              ...s.manualSteps,
                              [today]: Number(v),
                            },
                          }));
                      }}
                    >
                      Edit
                    </button>
                  </p>
                </section>
                <section className="card metric-card weight-metric">
                  <div className="metric-title">
                    <span className="round-icon pale">
                      <TrendingDown size={18} />
                    </span>
                    <h3>A lighter you</h3>
                    <button
                      className="icon-button"
                      aria-label="Add a weigh-in"
                      onClick={() => setModal("weight")}
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                  <div className="metric-value">
                    {p.currentWeightKg.toFixed(1)}
                    <small> kg</small>
                    <span className="weight-change">
                      <ArrowDownRight size={15} />
                      {lost.toFixed(1)} kg
                    </span>
                  </div>
                  <div className="weight-mini">
                    <svg viewBox="0 0 240 30" aria-hidden="true">
                      <polyline
                        points={state.weights
                          .map(
                            (w, i) =>
                              `${(i / Math.max(1, state.weights.length - 1)) * 240},${5 + ((Math.max(...state.weights.map((x) => x.weightKg)) - w.weightKg) / Math.max(1, Math.max(...state.weights.map((x) => x.weightKg)) - Math.min(...state.weights.map((x) => x.weightKg)))) * 20}`,
                          )
                          .join(" ")}
                        stroke="#88a278"
                        fill="none"
                        strokeWidth="2"
                      />
                    </svg>
                  </div>
                  <p>Since your starting point. Look at you go.</p>
                </section>
              </div>
              <div className="dashboard-bottom">
                {Meals({})}
                <aside className="snack-card">
                  <div className="section-heading">
                    <span className="snack-eyebrow">
                      <Sparkles size={15} /> A LITTLE TREAT, A LITTLE BALANCE
                    </span>
                    <Heart size={17} />
                  </div>
                  <h2>
                    There’s room for
                    <br />
                    something you love.
                  </h2>
                  <p>
                    {number(remaining)} kcal left. Here are a few favourites
                    <br className="desktop-break" /> that fit your day.
                  </p>
                  <SnackList />
                  <button
                    className="text-button snack-bottom"
                    onClick={() => setTab("evening")}
                  >
                    Plan my evening <ArrowRight size={15} />
                  </button>
                </aside>
              </div>
              <div className="bottom-grid">
                <section className="card trend-card">
                  <div className="section-heading">
                    <div>
                      <h2>The bigger picture</h2>
                      <p>A steady journey, one day at a time.</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setTab("progress")}
                    >
                      View progress <ArrowRight size={14} />
                    </button>
                  </div>
                  <WeightChart />
                </section>
                <section className="coach-card">
                  <div>
                    <span className="eyebrow">A NOTE FROM SPROUT</span>
                    <h2>
                      {wins >= 5
                        ? "You’re growing."
                        : wins >= 2
                          ? "Finding your rhythm."
                          : "You showed up."}
                      <br />
                      {wins >= 5
                        ? "Look at those little wins."
                        : "That’s a win."}
                    </h2>
                    <p>
                      Some days are easier than others.
                      <br />
                      We’re here for all of them.
                    </p>
                    <button
                      className="text-button"
                      onClick={() => setTab("evening")}
                    >
                      Let’s check in <ArrowRight size={14} />
                    </button>
                  </div>
                  <Mascot />
                </section>
              </div>
              <div className="daily-note">
                <span>
                  <Leaf size={14} /> Estimates guide you; how you feel matters
                  too.
                </span>
                <button
                  className="text-button"
                  onClick={() => {
                    change((s) => ({
                      ...s,
                      completed: { ...s.completed, [today]: budget.target },
                    }));
                    notify(
                      "Day marked complete. Only confirmed days contribute to your weekly flexibility.",
                    );
                  }}
                >
                  {state.completed[today] ? (
                    <>
                      <CheckCheck size={15} /> Day marked complete
                    </>
                  ) : (
                    <>
                      Finish my food diary <Check size={14} />
                    </>
                  )}
                </button>
              </div>
            </>
          )}
          {tab === "food" && (
            <>
              <div className="diary-date-bar">
                <div>
                  <button
                    className="icon-button"
                    aria-label="Previous day"
                    onClick={() => {
                      setSelectedDay(shiftDate(selectedDay, -1));
                    }}
                  >
                    <ChevronLeft size={19} />
                  </button>
                  <input
                    aria-label="Diary date"
                    type="date"
                    max={today}
                    value={selectedDay}
                    onChange={(e) =>
                      e.target.value && setSelectedDay(e.target.value)
                    }
                  />
                  <button
                    className="icon-button"
                    aria-label="Next day"
                    disabled={selectedDay >= today}
                    onClick={() => {
                      setSelectedDay(shiftDate(selectedDay, 1));
                    }}
                  >
                    <ChevronRight size={19} />
                  </button>
                </div>
                <span>
                  {number(
                    state.meals
                      .filter((m) => m.date === selectedDay)
                      .reduce((a, m) => a + m.calories, 0),
                  )}{" "}
                  kcal logged
                </span>
              </div>
              {Meals({ diary: true })}
              <div className="diary-summary card">
                <h2>More than calories</h2>
                <div className="macro-grid">
                  {(["protein", "carbs", "fat"] as const).map((key, i) => (
                    <div key={key}>
                      <span className={`macro-dot macro-${i}`} />
                      <span>
                        {key === "carbs"
                          ? "Carbohydrates"
                          : key.charAt(0).toUpperCase() + key.slice(1)}
                      </span>
                      <strong>
                        {number(
                          state.meals
                            .filter((m) => m.date === selectedDay)
                            .reduce((a, m) => a + m[key], 0),
                        )}{" "}
                        g
                      </strong>
                    </div>
                  ))}
                </div>
                <p>
                  Unknown snack macros aren’t included. Photo estimates should
                  be checked against portions and packaging.
                </p>
                <button
                  className="button button-secondary"
                  onClick={() => {
                    const dayBudget = getDailyBudget(p, {
                      consumedCalories: 0,
                      manualExerciseCalories: state.activities
                        .filter((a) => a.date === selectedDay)
                        .reduce((a, b) => a + b.calories, 0),
                      fitbitCaloriesOut:
                        state.fitbit?.date === selectedDay
                          ? state.fitbit.caloriesOut
                          : undefined,
                    });
                    change((s) => ({
                      ...s,
                      completed: {
                        ...s.completed,
                        [selectedDay]:
                          dayBudget.target + (s.bankUsed[selectedDay] || 0),
                      },
                    }));
                    notify("Food diary marked complete.");
                  }}
                >
                  <CheckCheck size={16} />{" "}
                  {state.completed[selectedDay]
                    ? "Day complete"
                    : "Mark this day complete"}
                </button>
              </div>
            </>
          )}
          {tab === "progress" && (
            <>
              <div className="progress-stats">
                <section className="card">
                  <span>YOUR STARTING POINT</span>
                  <strong>
                    {p.startWeightKg}
                    <small> kg</small>
                  </strong>
                </section>
                <section className="card">
                  <span>RIGHT HERE, RIGHT NOW</span>
                  <strong>
                    {p.currentWeightKg}
                    <small> kg</small>
                  </strong>
                </section>
                <section className="card">
                  <span>A LITTLE LIGHTER</span>
                  <strong>
                    {lost.toFixed(1)}
                    <small> kg</small>
                  </strong>
                </section>
                <section className="card">
                  <span>YOUR GOAL</span>
                  <strong>
                    {p.goalWeightKg}
                    <small> kg</small>
                  </strong>
                  <button
                    className="text-button"
                    onClick={() => setModal("goal")}
                  >
                    Adjust goal <ArrowUpRight size={14} />
                  </button>
                </section>
              </div>
              <section className="card progress-chart-card">
                <div className="section-heading">
                  <div>
                    <h2>Your journey, so far</h2>
                    <p>
                      Every weigh-in is a data point. The trend matters more
                      than a single day.
                    </p>
                  </div>
                  <span className="pill">Estimated goal · {goalDate}</span>
                </div>
                <WeightChart large />
                <p className="inline-note">
                  Projections use an approximate energy model, not a promise.
                  Water, hormones and changing energy needs affect your weight.
                </p>
              </section>
              <div className="progress-bottom">
                <section className="card">
                  <div className="section-heading">
                    <h2>Your check-ins</h2>
                    <button
                      className="text-button"
                      onClick={() => setModal("weight")}
                    >
                      <Plus size={14} /> Log weight
                    </button>
                  </div>
                  <div className="weigh-in-list">
                    {[...state.weights]
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map((w) => (
                        <div key={w.date}>
                          <span>
                            {prettyDate(w.date, {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                            })}
                          </span>
                          <strong>
                            {w.weightKg.toFixed(1)} <small>kg</small>
                          </strong>
                          <button
                            className="icon-button"
                            aria-label={`Remove weight on ${w.date}`}
                            onClick={() =>
                              change((s) => {
                                const weights = s.weights.filter(
                                  (x) => x.date !== w.date,
                                );
                                return {
                                  ...s,
                                  weights,
                                  profile: {
                                    ...s.profile,
                                    currentWeightKg:
                                      weights.at(-1)?.weightKg ??
                                      s.profile.startWeightKg,
                                  },
                                };
                              })
                            }
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    {!state.weights.length && (
                      <p className="inline-note">
                        Your first weigh-in is the beginning of your story.
                      </p>
                    )}
                  </div>
                </section>
                <section className="card">
                  <div className="section-heading">
                    <div>
                      <h2>More than a number</h2>
                      <p>Your private progress photos.</p>
                    </div>
                    <button
                      className="button button-secondary small-button"
                      onClick={() => setModal("photo")}
                    >
                      <Plus size={14} /> Add photo
                    </button>
                  </div>
                  {state.photos.length ? (
                    <div className="photos-grid">
                      {state.photos.map((photo) => (
                        <figure key={photo.id}>
                          <a href={photo.url} target="_blank" rel="noreferrer">
                            <img
                              src={photo.url}
                              alt={photo.caption || "Your progress photo"}
                            />
                          </a>
                          <figcaption>
                            <strong>
                              {photo.caption || "A moment in your journey"}
                            </strong>
                            <span>
                              {new Date(photo.createdAt).toLocaleDateString(
                                "en-AU",
                              )}
                            </span>
                            <button
                              className="icon-button"
                              aria-label="Delete progress photo"
                              onClick={async () => {
                                try {
                                  const r = await apiFetch(
                                    `/api/photos/${photo.id}`,
                                    { method: "DELETE" },
                                  );
                                  if (!r.ok) throw Error();
                                  change((s) => ({
                                    ...s,
                                    photos: s.photos.filter(
                                      (x) => x.id !== photo.id,
                                    ),
                                  }));
                                } catch {
                                  notify(
                                    "Could not delete the photo. Please try again.",
                                  );
                                }
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </figcaption>
                        </figure>
                      ))}
                    </div>
                  ) : (
                    <button
                      className="photo-empty"
                      onClick={() => setModal("photo")}
                    >
                      <Camera size={28} />
                      <strong>Capture your starting point</strong>
                      <span>Just for you. Whenever you’re ready.</span>
                    </button>
                  )}
                </section>
              </div>
            </>
          )}
          {tab === "evening" && (
            <>
              <div className="evening-grid">
                <section className="card hunger-card">
                  <div className="section-heading">
                    <span className="eyebrow">
                      <Moon size={16} /> YOUR 7PM CHECK-IN
                    </span>
                    <span className="pill">ACST · UTC +9:30</span>
                  </div>
                  <div className="hunger-intro">
                    <div>
                      <h2>How’s your hunger?</h2>
                      <p>No right answers. Just a little awareness.</p>
                    </div>
                    <Mascot small />
                  </div>
                  <div className="hunger-number">
                    {hunger}
                    <span>/ 10</span>
                  </div>
                  <input
                    className="hunger-range"
                    aria-label="Hunger level"
                    type="range"
                    min="1"
                    max="10"
                    value={hunger}
                    onChange={(e) => setHunger(Number(e.target.value))}
                  />
                  <div className="range-labels">
                    <span>Feeling satisfied</span>
                    <span>Very hungry</span>
                  </div>
                  <p className="hunger-reply">
                    {hunger >= 8
                      ? "That sounds like real hunger. A nourishing meal is a good next step."
                      : hunger >= 5
                        ? "A satisfying snack could be just the thing. Let’s find your favourite."
                        : "Feeling comfortable? Enjoy your evening. Food is here when you need it."}
                  </p>
                  <button
                    className="button button-primary"
                    onClick={() => {
                      change((s) => ({
                        ...s,
                        hunger: { ...s.hunger, [acstDay]: hunger },
                      }));
                      notify(
                        "Check-in saved. Thanks for listening to yourself.",
                      );
                    }}
                  >
                    <Check size={16} />{" "}
                    {state.hunger[acstDay] === undefined
                      ? "Save my check-in"
                      : "Update my check-in"}
                  </button>
                  <button
                    className="text-button reminder-button"
                    disabled={notificationPermission === "granted"}
                    onClick={async () => {
                      if (typeof Notification === "undefined") {
                        notify("This browser doesn’t support reminders.");
                        return;
                      }
                      const permission = await Notification.requestPermission();
                      setNotificationPermission(permission);
                      if (permission !== "granted")
                        notify("You can still check in here any time.");
                    }}
                  >
                    <Bell size={14} />{" "}
                    {notificationPermission === "granted"
                      ? "Reminders enabled while the app is open"
                      : "Remind me at 7pm ACST"}
                  </button>
                  <p className="fine-print">
                    Reminders run while this app is open. ACST stays UTC+9:30
                    through daylight saving.
                  </p>
                </section>
                <aside className="snack-card evening-snacks">
                  <span className="snack-eyebrow">
                    <Sparkles size={15} /> YOUR EVENING MENU
                  </span>
                  <h2>
                    A little something
                    <br />
                    to look forward to.
                  </h2>
                  <p>
                    You have <strong>{number(remaining)} kcal</strong> in your
                    estimated budget.
                  </p>
                  <SnackList full />
                  <button
                    className="text-button"
                    onClick={() => setFavoriteOpen(true)}
                  >
                    <Plus size={14} /> Add a favourite snack
                  </button>
                  <button
                    className="button button-secondary ai-snack-button"
                    disabled={aiSnackBusy}
                    onClick={suggestWithAI}
                  >
                    {aiSnackBusy ? (
                      <LoaderCircle size={15} className="spin" />
                    ) : (
                      <Sparkles size={15} />
                    )}{" "}
                    Personalise with AI
                  </button>
                  {aiSnackNote && <p className="inline-note">{aiSnackNote}</p>}
                  <p className="fine-print">
                    {integrations.ai.configured
                      ? "AI explains choices from your saved favourites; you decide what to eat."
                      : "Budget-based favourites work now. Personalised AI suggestions need a server API key."}
                  </p>
                </aside>
              </div>
              <div className="evening-grid">
                <section className="card flexibility-card">
                  <span className="round-icon pale">
                    <BookOpen size={20} />
                  </span>
                  <h2>A little flexibility</h2>
                  <p>
                    Your week has a rhythm of its own. Confirmed food diaries
                    can leave a little room for another day.
                  </p>
                  <div className="bank-number">
                    {bankCredit || bank}
                    <span> kcal available</span>
                  </div>
                  <p className="inline-note">
                    Up to 200 kcal from completed days in the last week. No
                    borrowing from future days, and no making up for food
                    tomorrow.
                  </p>
                  <button
                    className="button button-secondary"
                    disabled={bank <= 0 || !!state.bankUsed[today]}
                    onClick={() => {
                      change((s) => ({
                        ...s,
                        bankUsed: { ...s.bankUsed, [today]: bank },
                      }));
                      notify("A little weekly flexibility added to today.");
                    }}
                  >
                    {state.bankUsed[today] ? (
                      <>
                        <Check size={15} /> Added to today
                      </>
                    ) : (
                      <>
                        Use today’s flexibility <ArrowRight size={15} />
                      </>
                    )}
                  </button>
                </section>
                <section className="card movement-card">
                  <span className="round-icon peach">
                    <Dumbbell size={20} />
                  </span>
                  <h2>Move because it feels good</h2>
                  <p>
                    A walk, a swim, your favourite workout. Movement can gently
                    increase your estimated budget, but you never need to earn
                    your food.
                  </p>
                  <div className="activity-pills">
                    {[
                      ...new Set([
                        ...state.activities
                          .map((a) => a.name)
                          .sort(
                            (a, b) =>
                              state.activities.filter((x) => x.name === b)
                                .length -
                              state.activities.filter((x) => x.name === a)
                                .length,
                          ),
                        "Walking",
                        "Cycling",
                        "Swimming",
                      ]),
                    ]
                      .slice(0, 3)
                      .map((name) => (
                        <span key={name}>
                          {name === "Walking"
                            ? "🚶"
                            : name === "Cycling"
                              ? "🚲"
                              : name === "Swimming"
                                ? "🏊"
                                : "✨"}{" "}
                          {name}
                        </span>
                      ))}
                  </div>
                  <button
                    className="button button-secondary"
                    onClick={() => setModal("activity")}
                  >
                    <Plus size={15} /> Log some movement
                  </button>
                  <p className="fine-print">
                    Manual movement receives 50% calorie credit, capped at 500
                    kcal. Fitbit totals replace estimates instead of being added
                    twice.
                  </p>
                </section>
              </div>
            </>
          )}
          <footer>
            <a
              className="footer-brand"
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setTab("today");
              }}
            >
              <Sprout size={16} /> lighter.
            </a>
            <span>A little kinder. A little healthier. A little more you.</span>
            <span className="save-status">
              <span /> {loaded ? storage : "Loading…"}
            </span>
          </footer>
        </main>
      </div>
      {guide && (
        <ConnectionGuide
          onClose={() => setGuide(false)}
          onChanged={refreshConnections}
        />
      )}
      {modal && (
        <EntryModal
          kind={modal}
          onSetup={() => {
            setModal(null);
            setGuide(true);
          }}
          profile={p}
          onClose={() => {
            setModal(null);
            setStartingFresh(false);
          }}
          onSave={save}
        />
      )}
      {connect && (
        <div
          className="modal-backdrop"
          onClick={(e) => e.target === e.currentTarget && setConnect(false)}
        >
          <section
            className="modal integration-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Your Fitbit connection"
          >
            <div className="modal-head">
              <span className="round-icon pale">
                <Watch size={22} />
              </span>
              <button
                className="icon-button"
                aria-label="Close Fitbit connection"
                onClick={() => setConnect(false)}
              >
                <X size={20} />
              </button>
            </div>
            <h2>Your day, connected.</h2>
            <p>
              Bring in your steps, energy burn, workouts, sleep and latest
              weight from Fitbit.
            </p>
            <div className="connection-status">
              <span
                className={
                  integrations.fitbit.connected
                    ? "connected-dot"
                    : "disconnected-dot"
                }
              />
              <strong>
                {integrations.fitbit.connected
                  ? "Fitbit connected"
                  : "Fitbit isn’t connected yet"}
              </strong>
            </div>
            {integrations.fitbit.configured ? (
              <>
                <a className="button button-primary" href="/api/fitbit/connect">
                  <Watch size={17} />
                  {integrations.fitbit.connected
                    ? "Reconnect Fitbit"
                    : "Connect with Fitbit"}
                </a>
                {integrations.fitbit.connected && (
                  <button
                    className="button button-secondary"
                    disabled={busy}
                    onClick={sync}
                  >
                    {busy ? (
                      <LoaderCircle size={16} className="spin" />
                    ) : (
                      <ArrowDown size={16} />
                    )}{" "}
                    Sync my day
                  </button>
                )}
                {integrations.fitbit.connected && (
                  <button
                    className="text-button disconnect-button"
                    onClick={async () => {
                      try {
                        const r = await apiFetch("/api/fitbit", {
                          method: "DELETE",
                        });
                        if (!r.ok) throw Error();
                        setIntegrations((v) => ({
                          ...v,
                          fitbit: {
                            ...v.fitbit,
                            connected: false,
                            lastSyncedAt: null,
                          },
                        }));
                        change((s) => ({ ...s, fitbit: null }));
                        notify(
                          "Fitbit disconnected. Your logged entries are still here.",
                        );
                      } catch {
                        notify("Could not disconnect. Try again.");
                      }
                    }}
                  >
                    <LogOut size={13} /> Disconnect Fitbit
                  </button>
                )}
              </>
            ) : (
              <div className="setup-note">
                <strong>Let’s connect your Fitbit, step by step.</strong>
                <p>
                  There’s a one-time registration with Fitbit before it can
                  share data with Lighter. The guide will show you what to copy
                  and where to put it.
                </p>
                <button
                  className="button button-primary"
                  onClick={() => {
                    setConnect(false);
                    setGuide(true);
                  }}
                >
                  Open my connection guide <ArrowRight size={15} />
                </button>
              </div>
            )}
            {state.fitbit && (
              <div className="synced-details">
                <p>
                  Last synced{" "}
                  {new Date(state.fitbit.lastSyncedAt).toLocaleString("en-AU")}
                </p>
                {state.fitbit.workouts.map((a) => (
                  <div key={a.id}>
                    <Dumbbell size={14} />
                    {a.name} · {a.durationMinutes} min
                  </div>
                ))}
                {state.fitbit.sleepMinutes != null && (
                  <p>
                    Sleep · {(state.fitbit.sleepMinutes / 60).toFixed(1)} hours
                  </p>
                )}
                {state.fitbit.restingHeartRate && (
                  <p>
                    Resting heart rate · {state.fitbit.restingHeartRate} bpm
                  </p>
                )}
              </div>
            )}
            <p className="fine-print">
              Fitbit calories are an evolving daily total, so your budget may
              change as the day goes on. Syncing all historical Fitbit data
              isn’t included in this first version.
            </p>
          </section>
        </div>
      )}
      {help && (
        <div
          className="modal-backdrop"
          onClick={(e) => e.target === e.currentTarget && setHelp(false)}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="How Lighter works"
          >
            <div className="modal-head">
              <span className="eyebrow">
                <Sprout size={17} /> A LITTLE ABOUT LIGHTER
              </span>
              <button
                className="icon-button"
                aria-label="Close help"
                onClick={() => setHelp(false)}
              >
                <X size={20} />
              </button>
            </div>
            <h2>Built around balance.</h2>
            <p>
              Your starting budget estimates daily energy needs from age,
              height, weight and activity. Your chosen pace sets a deficit,
              limited to 25% of estimated maintenance.
            </p>
            <p>
              Budgets adjust with your weight. Adult intake floors of 1,200 kcal
              for women and 1,500 kcal for men are guardrails, not personalised
              medical advice. Plans aren’t intended for under-18s, pregnancy,
              breastfeeding or eating-disorder recovery.
            </p>
            <p>
              Steps and manually logged workouts aren’t counted on top of Fitbit
              calorie totals. Photo nutrition is always an estimate; portions,
              sauces and hidden ingredients need your review.
            </p>
            <p>
              Hydration starts at 2.5 L as an editable reminder, not a
              prescription. You can adjust it for your needs.
            </p>
            <div className="field">
              <label htmlFor="water-goal">Your daily water reminder (ml)</label>
              <input
                id="water-goal"
                type="number"
                min="500"
                max="5000"
                step="250"
                value={state.waterGoal}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (n >= 500 && n <= 5000)
                    change((s) => ({ ...s, waterGoal: n }));
                }}
              />
            </div>
            <p className="fine-print">
              This is a single-user app. Your records and photos are saved on
              this device/server. Add authentication and encryption before
              hosting it publicly.
            </p>
            <button
              className="button button-primary"
              onClick={() => setHelp(false)}
            >
              Got it <Check size={15} />
            </button>
          </section>
        </div>
      )}
      {favoriteOpen && (
        <FavoriteModal
          onClose={() => setFavoriteOpen(false)}
          onSave={(f) => {
            change((s) => ({
              ...s,
              favorites: [...s.favorites, { ...f, id: uid() }],
            }));
            setFavoriteOpen(false);
            notify("Favourite saved. More of what you love.");
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <span>
            <Check size={16} />
          </span>
          {toast}
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
function FavoriteModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (f: { name: string; calories: number; emoji: string }) => void;
}) {
  const [name, setName] = useState("");
  const [calories, setCalories] = useState(150);
  return (
    <div className="modal-backdrop">
      <form
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Add a favourite snack"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ name: name.trim(), calories, emoji: "🍪" });
        }}
      >
        <div className="modal-head">
          <h2>A little favourite</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="Close favourite form"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        <div className="field">
          <label htmlFor="snack-name">Snack name</label>
          <input
            id="snack-name"
            required
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="snack-calories">Calories per serving</label>
          <input
            id="snack-calories"
            type="number"
            required
            min="1"
            max="2000"
            value={calories}
            onChange={(e) => setCalories(Number(e.target.value))}
          />
        </div>
        <button className="button button-primary" type="submit">
          Save my favourite <Heart size={16} />
        </button>
      </form>
    </div>
  );
}
export default function Lighter() {
  return (
    <PrivateSpace>
      {(privateMode, signOut) => (
        <App privateMode={privateMode} onSignOut={signOut} />
      )}
    </PrivateSpace>
  );
}
