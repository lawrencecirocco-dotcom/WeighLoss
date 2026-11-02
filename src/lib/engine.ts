export type Pace = "slow" | "moderate" | "aggressive";
export type Activity = "sedentary" | "light" | "moderate" | "active";

export interface Profile {
  name: string;
  age: number;
  heightCm: number;
  sex: "female" | "male";
  activity: Activity;
  startWeightKg: number;
  currentWeightKg: number;
  goalWeightKg: number;
  pace: Pace;
  targetDate?: string;
  minimumCalories?: number;
}

export interface Plan {
  maintenance: number;
  minimumCalories: number;
  requestedDeficit: number;
  deficit: number;
  dailyTarget: number;
  weeklyLossKg: number;
  goalDate: string | null;
  daysToGoal: number | null;
  warnings: string[];
  feasible: boolean;
}

const ACTIVITY: Record<Activity, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
};
const DEFICIT: Record<Pace, number> = {
  slow: 250,
  moderate: 500,
  aggressive: 750,
};
const DAY = 86_400_000;
const KG_ENERGY = 7700;

function finite(value: number, label: string, minimum = 0) {
  if (!Number.isFinite(value) || value < minimum)
    throw new Error(`${label} must be a valid number of at least ${minimum}.`);
}

function dateNumber(date: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new Error("Use a valid date in YYYY-MM-DD format.");
  const n = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(n) || new Date(n).toISOString().slice(0, 10) !== date)
    throw new Error("Use a valid calendar date.");
  return n;
}

export function localDate(
  date = new Date(),
  timeZone = "Australia/Adelaide",
): string {
  if (!Number.isFinite(date.getTime())) throw new Error("Use a valid date.");
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (name: string) => parts.find((p) => p.type === name)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** Mifflin–St Jeor is a starting estimate, not a measurement of metabolism. */
export function getPlan(profile: Profile, now = new Date()): Plan {
  finite(profile.age, "Age", 1);
  finite(profile.heightCm, "Height", 1);
  finite(profile.currentWeightKg, "Current weight", 1);
  finite(profile.startWeightKg, "Starting weight", 1);
  finite(profile.goalWeightKg, "Goal weight", 1);
  if (
    !(profile.activity in ACTIVITY) ||
    !(profile.pace in DEFICIT) ||
    !["female", "male"].includes(profile.sex)
  )
    throw new Error("Choose valid profile options.");
  const bmr =
    10 * profile.currentWeightKg +
    6.25 * profile.heightCm -
    5 * profile.age +
    (profile.sex === "male" ? 5 : -161);
  const minimum = profile.sex === "male" ? 1500 : 1200;
  if (profile.minimumCalories !== undefined)
    finite(profile.minimumCalories, "Minimum calories", minimum);
  const minimumCalories = Math.max(minimum, profile.minimumCalories ?? minimum);
  const maintenance = Math.max(
    minimumCalories,
    Math.round(bmr * ACTIVITY[profile.activity]),
  );
  const remainingKg = Math.max(
    0,
    profile.currentWeightKg - profile.goalWeightKg,
  );
  const warnings: string[] = [];
  let requestedDeficit = remainingKg > 0 ? DEFICIT[profile.pace] : 0;
  let feasible = true;
  const today = localDate(now);
  if (profile.targetDate && remainingKg > 0) {
    const days = Math.round(
      (dateNumber(profile.targetDate) - dateNumber(today)) / DAY,
    );
    if (days <= 0) {
      warnings.push(
        "Choose a future goal date. The suggested pace is used until then.",
      );
      feasible = false;
    } else {
      requestedDeficit = Math.round((remainingKg * KG_ENERGY) / days);
    }
  }
  const maximumDeficit = Math.max(
    0,
    Math.min(maintenance * 0.25, maintenance - minimumCalories),
  );
  let deficit = Math.round(Math.min(requestedDeficit, maximumDeficit));
  // Avoid rounding a fractional upper bound upward beyond the configured limit.
  deficit = Math.min(deficit, Math.floor(maximumDeficit));
  if (requestedDeficit > maximumDeficit) {
    warnings.push(
      "Your requested pace is faster than this app’s calorie limits. The plan uses a gentler deficit and a later estimated date.",
    );
    feasible = false;
  }
  if (profile.age < 18) {
    warnings.push(
      "Calorie deficit planning is for adults. A clinician can help set an appropriate plan for your age.",
    );
    feasible = false;
    deficit = 0;
  }
  const goalBmi = profile.goalWeightKg / (profile.heightCm / 100) ** 2;
  if (remainingKg > 0 && goalBmi < 18.5) {
    warnings.push(
      "This goal falls below the standard adult healthy BMI range. Review it with a clinician before planning weight loss.",
    );
    feasible = false;
    deficit = 0;
  }
  const daysToGoal =
    remainingKg === 0
      ? 0
      : deficit > 0
        ? Math.ceil((remainingKg * KG_ENERGY) / deficit)
        : null;
  const goalDate =
    daysToGoal === null
      ? null
      : new Date(dateNumber(today) + daysToGoal * DAY)
          .toISOString()
          .slice(0, 10);
  return {
    maintenance,
    minimumCalories,
    requestedDeficit,
    deficit,
    dailyTarget: maintenance - deficit,
    weeklyLossKg: (deficit * 7) / KG_ENERGY,
    goalDate,
    daysToGoal,
    warnings,
    feasible,
  };
}

export interface DailyBudgetInput {
  consumedCalories: number;
  manualExerciseCalories?: number;
  /** Fitbit's total expenditure includes activity: never add exercise to it. */
  fitbitCaloriesOut?: number | null;
  bankCredit?: number;
}

export interface DailyBudget extends Plan {
  burnedCalories: number;
  exerciseCredit: number;
  bankCredit: number;
  source: "fitbit" | "estimate";
  target: number;
  remaining: number;
  consumed: number;
}

export function getDailyBudget(
  profile: Profile,
  input: DailyBudgetInput,
  now = new Date(),
): DailyBudget {
  finite(input.consumedCalories, "Food calories");
  finite(input.manualExerciseCalories ?? 0, "Exercise calories");
  finite(input.bankCredit ?? 0, "Bank credit");
  if (input.fitbitCaloriesOut !== null && input.fitbitCaloriesOut !== undefined)
    finite(input.fitbitCaloriesOut, "Fitbit calories", 1);
  const plan = getPlan(profile, now);
  const hasFitbit =
    input.fitbitCaloriesOut !== null && input.fitbitCaloriesOut !== undefined;
  const exerciseCredit = hasFitbit
    ? 0
    : Math.min(500, Math.round((input.manualExerciseCalories ?? 0) * 0.5));
  // The Fitbit daily summary is expenditure so far, not a full-day forecast.
  // Keep the full-day baseline until measured expenditure exceeds it. In
  // particular, syncing at breakfast must not turn an ordinary day's plan into
  // an artificially low intake target. Actual workouts are never added again.
  const burnedCalories = hasFitbit
    ? Math.max(plan.maintenance, input.fitbitCaloriesOut!)
    : plan.maintenance + exerciseCredit;
  const bankCredit = Math.min(200, Math.round(input.bankCredit ?? 0));
  const target =
    Math.max(plan.minimumCalories, Math.round(burnedCalories - plan.deficit)) +
    bankCredit;
  const warnings = [...plan.warnings];
  if (hasFitbit)
    warnings.push(
      "Full-day budget projection: estimated maintenance is used until Fitbit’s expenditure so far exceeds it. Fitbit totals already include exercise; workouts are not added again.",
    );
  return {
    ...plan,
    warnings,
    burnedCalories,
    exerciseCredit,
    bankCredit,
    source: hasFitbit ? "fitbit" : "estimate",
    target,
    remaining: Math.max(0, target - input.consumedCalories),
    consumed: input.consumedCalories,
  };
}

export interface CompletedDay {
  date: string;
  consumedCalories: number;
  targetCalories: number;
  minimumCalories?: number;
  complete: boolean;
}

/** Optional flexibility from the previous six completed days, never unlogged days. */
export function getBankCredit(
  days: CompletedDay[],
  today = localDate(),
): number {
  return getBankAvailable(days, today, {});
}

/**
 * Saved day targets include any bank allowance applied on that day. Reservations
 * record the actual amount applied (never a boolean or assumed 200 kcal). Taking
 * these amounts off the uncapped balance prevents the same credit being reused,
 * while allowing fresh savings to build up after a reservation has been spent.
 * Include today's reservation to get the amount still available to reserve;
 * today's applied budget itself should retain the saved reservation amount.
 */
export function getBankAvailable(
  days: CompletedDay[],
  today = localDate(),
  usedReservations: Record<string, number> = {},
): number {
  const todayN = dateNumber(today);
  const seen = new Set<string>();
  let balance = 0;
  for (const day of days) {
    const dayN = dateNumber(day.date);
    if (seen.has(day.date)) continue;
    seen.add(day.date);
    if (!day.complete || dayN >= todayN || dayN < todayN - 6 * DAY) continue;
    finite(day.consumedCalories, "Food calories");
    finite(day.targetCalories, "Target calories");
    const floor = Math.max(1200, day.minimumCalories ?? 1200);
    // Very low intake is not a source of food credit; overspending still counts.
    if (day.consumedCalories < floor) continue;
    balance += day.targetCalories - day.consumedCalories;
  }
  for (const [date, amount] of Object.entries(usedReservations)) {
    const reservationDay = dateNumber(date);
    finite(amount, "Reserved bank calories");
    if (reservationDay <= todayN && reservationDay >= todayN - 6 * DAY)
      balance -= amount;
  }
  return Math.min(200, Math.max(0, Math.floor(balance)));
}

export interface WeightEntry {
  date: string;
  weightKg: number;
}
export interface Projection {
  goalDate: string | null;
  daysToGoal: number | null;
  weeklyLossKg: number;
  source: "trend" | "plan";
}

/** A seven-day-plus trend is less sensitive to individual water-weight changes. */
export function getProjection(
  weights: WeightEntry[],
  goalWeightKg: number,
  fallbackDailyDeficit: number,
  now = new Date(),
): Projection {
  finite(goalWeightKg, "Goal weight", 1);
  finite(fallbackDailyDeficit, "Daily deficit");
  const today = dateNumber(localDate(now));
  const unique = new Map<string, WeightEntry>();
  for (const weight of weights) {
    finite(weight.weightKg, "Weight", 1);
    const n = dateNumber(weight.date);
    if (n <= today && n >= today - 42 * DAY) unique.set(weight.date, weight);
  }
  const sorted = [...unique.values()].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  let dailyLoss = fallbackDailyDeficit / KG_ENERGY;
  let source: "trend" | "plan" = "plan";
  if (
    sorted.length >= 3 &&
    dateNumber(sorted.at(-1)!.date) - dateNumber(sorted[0].date) >= 7 * DAY
  ) {
    // Least squares uses every observation, instead of two potentially noisy endpoints.
    const xs = sorted.map(
      (w) => (dateNumber(w.date) - dateNumber(sorted[0].date)) / DAY,
    );
    const meanX = xs.reduce((sum, x) => sum + x, 0) / xs.length;
    const meanY =
      sorted.reduce((sum, w) => sum + w.weightKg, 0) / sorted.length;
    const covariance = xs.reduce(
      (sum, x, i) => sum + (x - meanX) * (sorted[i].weightKg - meanY),
      0,
    );
    const variance = xs.reduce((sum, x) => sum + (x - meanX) ** 2, 0);
    dailyLoss = -covariance / variance;
    source = "trend";
  }
  const remaining = sorted.length
    ? Math.max(0, sorted.at(-1)!.weightKg - goalWeightKg)
    : null;
  const daysToGoal =
    remaining === 0
      ? 0
      : remaining !== null && dailyLoss > 0
        ? Math.ceil(remaining / dailyLoss)
        : null;
  const goalDate =
    daysToGoal === null || daysToGoal > 3650
      ? null
      : new Date(today + daysToGoal * DAY).toISOString().slice(0, 10);
  return {
    goalDate,
    daysToGoal: goalDate === null ? null : daysToGoal,
    weeklyLossKg: dailyLoss * 7,
    source,
  };
}

export interface FavoriteFood {
  id: string;
  name: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  emoji?: string;
}

export function suggestSnacks(
  favorites: FavoriteFood[],
  budget: number,
  hunger = 5,
): FavoriteFood[] {
  finite(budget, "Remaining calories");
  if (!Number.isFinite(hunger) || hunger < 0 || hunger > 10)
    throw new Error("Hunger must be between 0 and 10.");
  return favorites
    .filter(
      (food) =>
        Number.isFinite(food.calories) &&
        food.calories > 0 &&
        food.calories <= budget,
    )
    .sort((a, b) =>
      hunger >= 7
        ? (b.protein ?? 0) - (a.protein ?? 0)
        : Math.abs(budget * 0.5 - a.calories) -
          Math.abs(budget * 0.5 - b.calories),
    )
    .slice(0, 4);
}

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

function clockMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return (
    Number(parts.find((p) => p.type === "hour")!.value) * 60 +
    Number(parts.find((p) => p.type === "minute")!.value)
  );
}

export function mealTypeAt(
  date = new Date(),
  timeZone = "Australia/Adelaide",
): MealType {
  const hour = clockMinutes(date, timeZone) / 60;
  if (hour >= 5 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 15) return "lunch";
  if (hour >= 17 && hour < 21) return "dinner";
  return "snack";
}

/** ACST is always UTC+09:30; Adelaide observes daylight saving in summer. */
export function isEveningCheckInDue(
  now = new Date(),
  timeMode: "ACST" | "Adelaide" = "ACST",
): boolean {
  const minutes =
    timeMode === "ACST"
      ? (now.getUTCHours() * 60 + now.getUTCMinutes() + 570) % 1440
      : clockMinutes(now, "Australia/Adelaide");
  return minutes >= 19 * 60;
}

export function nextMilestone(
  currentWeightKg: number,
  goalWeightKg: number,
  deficit: number,
  now = new Date(),
) {
  finite(currentWeightKg, "Current weight", 1);
  finite(goalWeightKg, "Goal weight", 1);
  finite(deficit, "Daily deficit");
  const weightKg = Math.max(
    goalWeightKg,
    Math.ceil(currentWeightKg / 5) * 5 - 5,
  );
  const days =
    deficit > 0 && currentWeightKg > goalWeightKg
      ? Math.ceil(
          (Math.max(0, currentWeightKg - weightKg) * KG_ENERGY) / deficit,
        )
      : null;
  return {
    weightKg,
    days,
    date:
      days === null
        ? null
        : new Date(dateNumber(localDate(now)) + days * DAY)
            .toISOString()
            .slice(0, 10),
  };
}
