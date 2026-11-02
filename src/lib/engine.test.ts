import test from "node:test";
import assert from "node:assert/strict";
import {
  getPlan,
  getDailyBudget,
  getBankCredit,
  getBankAvailable,
  getProjection,
  localDate,
  mealTypeAt,
  isEveningCheckInDue,
  suggestSnacks,
  nextMilestone,
  type Profile,
} from "./engine";

const NOW = new Date("2026-11-02T05:00:00Z");
const profile: Profile = {
  name: "Alex",
  age: 35,
  heightCm: 175,
  sex: "male",
  activity: "light",
  startWeightKg: 95,
  currentWeightKg: 90,
  goalWeightKg: 80,
  pace: "moderate",
};

test("recalculates maintenance and intake as weight decreases", () => {
  const before = getPlan(profile, NOW);
  const after = getPlan({ ...profile, currentWeightKg: 85 }, NOW);
  assert.ok(after.maintenance < before.maintenance);
  assert.ok(after.dailyTarget < before.dailyTarget);
  assert.ok(before.goalDate! > localDate(NOW));
});

test("aggressive deficits respect both intake floors and 25% maintenance", () => {
  const plan = getPlan(
    {
      ...profile,
      currentWeightKg: 63,
      goalWeightKg: 60,
      heightCm: 160,
      activity: "sedentary",
      pace: "aggressive",
    },
    NOW,
  );
  assert.ok(plan.dailyTarget >= 1500);
  assert.ok(plan.deficit <= plan.maintenance * 0.25);
  assert.equal(plan.feasible, false);
  assert.ok(plan.warnings.length);
});

test("deadline that cannot be met is reported, with later feasible date", () => {
  const plan = getPlan({ ...profile, targetDate: "2026-11-10" }, NOW);
  assert.equal(plan.feasible, false);
  assert.ok(plan.goalDate! > "2026-11-10");
  assert.ok(plan.dailyTarget >= plan.minimumCalories);
});

test("invalid numbers and impossible calendar dates fail explicitly", () => {
  assert.throws(
    () => getPlan({ ...profile, currentWeightKg: NaN }, NOW),
    /valid number/,
  );
  assert.throws(
    () => getPlan({ ...profile, targetDate: "2027-02-30" }, NOW),
    /valid calendar date/,
  );
  assert.throws(
    () => getDailyBudget(profile, { consumedCalories: -100 }),
    /valid number/,
  );
});

test("no calorie deficit target is offered to minors or low BMI goals", () => {
  assert.equal(getPlan({ ...profile, age: 16 }, NOW).deficit, 0);
  assert.equal(getPlan({ ...profile, goalWeightKg: 45 }, NOW).deficit, 0);
});

test("Fitbit total expenditure never receives additional workout credit", () => {
  const one = getDailyBudget(
    profile,
    {
      consumedCalories: 1000,
      fitbitCaloriesOut: 2800,
      manualExerciseCalories: 800,
    },
    NOW,
  );
  const two = getDailyBudget(
    profile,
    { consumedCalories: 1000, fitbitCaloriesOut: 2800 },
    NOW,
  );
  assert.equal(one.target, two.target);
  assert.equal(one.burnedCalories, 2800);
  assert.equal(one.exerciseCredit, 0);
  assert.equal(one.source, "fitbit");
});

test("manual exercise earns a conservative capped estimate; partial Fitbit preserves full-day baseline", () => {
  const manual = getDailyBudget(
    profile,
    { consumedCalories: 0, manualExerciseCalories: 1400 },
    NOW,
  );
  assert.equal(manual.exerciseCredit, 500);
  const partial = getDailyBudget(
    profile,
    { consumedCalories: 0, fitbitCaloriesOut: 500 },
    NOW,
  );
  assert.equal(partial.target, getPlan(profile, NOW).dailyTarget);
  assert.equal(partial.burnedCalories, getPlan(profile, NOW).maintenance);
  assert.match(partial.warnings.join(" "), /Full-day budget projection/);
});

test("overspending never creates a negative remaining budget", () => {
  assert.equal(
    getDailyBudget(profile, { consumedCalories: 9000 }, NOW).remaining,
    0,
  );
});

test("weekly flexibility ignores incomplete, current, old, duplicate and very low intake days", () => {
  const days = [
    {
      date: "2026-11-01",
      consumedCalories: 1800,
      targetCalories: 1950,
      complete: true,
    },
    {
      date: "2026-11-01",
      consumedCalories: 1800,
      targetCalories: 1950,
      complete: true,
    },
    {
      date: "2026-10-31",
      consumedCalories: 0,
      targetCalories: 2000,
      complete: false,
    },
    {
      date: "2026-10-30",
      consumedCalories: 400,
      targetCalories: 2000,
      complete: true,
    },
    {
      date: "2026-10-20",
      consumedCalories: 1500,
      targetCalories: 2000,
      complete: true,
    },
    {
      date: "2026-11-02",
      consumedCalories: 1500,
      targetCalories: 2000,
      complete: true,
    },
  ];
  assert.equal(getBankCredit(days, "2026-11-02"), 150);
  assert.equal(
    getBankCredit(
      [
        ...days,
        {
          date: "2026-10-29",
          consumedCalories: 1600,
          targetCalories: 2000,
          complete: true,
        },
      ],
      "2026-11-02",
    ),
    200,
  );
});

test("weekly spending offsets savings and cannot create negative credit", () => {
  assert.equal(
    getBankCredit(
      [
        {
          date: "2026-11-01",
          consumedCalories: 1800,
          targetCalories: 2000,
          complete: true,
        },
        {
          date: "2026-10-31",
          consumedCalories: 2400,
          targetCalories: 2000,
          complete: true,
        },
      ],
      "2026-11-02",
    ),
    0,
  );
});

test("bank reservations use actual amounts before capping and new savings remain available", () => {
  const days = [
    {
      date: "2026-10-28",
      consumedCalories: 1850,
      targetCalories: 2000,
      complete: true,
    },
    // Only 150 kcal was available on the 29th. Its saved target includes it.
    {
      date: "2026-10-29",
      consumedCalories: 2150,
      targetCalories: 2150,
      complete: true,
    },
    {
      date: "2026-10-30",
      consumedCalories: 1800,
      targetCalories: 2000,
      complete: true,
    },
  ];
  assert.equal(
    getBankAvailable(days, "2026-11-02", { "2026-10-29": 150 }),
    200,
  );
  // Today's reservation remains a fixed 200 in the app's budget, and cannot
  // also appear as another 200 available to reserve.
  assert.equal(
    getBankAvailable(days, "2026-11-02", {
      "2026-10-29": 150,
      "2026-11-02": 200,
    }),
    0,
  );
});

test("unused reserved calories are recovered through the inclusive completed target", () => {
  const days = [
    {
      date: "2026-10-30",
      consumedCalories: 1850,
      targetCalories: 2000,
      complete: true,
    },
    {
      date: "2026-10-31",
      consumedCalories: 2000,
      targetCalories: 2150,
      complete: true,
    },
  ];
  assert.equal(
    getBankAvailable(days, "2026-11-02", { "2026-10-31": 150 }),
    150,
  );
});

test("bank floors use configured adult minimum and ignore future reservations", () => {
  const days = [
    {
      date: "2026-11-01",
      consumedCalories: 1400,
      targetCalories: 2000,
      minimumCalories: 1500,
      complete: true,
    },
  ];
  assert.equal(getBankAvailable(days, "2026-11-02", { "2026-11-03": 100 }), 0);
});

test("seven-day weight trend produces projection, rising trend does not promise a goal date", () => {
  const trend = getProjection(
    [
      { date: "2026-10-20", weightKg: 91 },
      { date: "2026-10-25", weightKg: 90.5 },
      { date: "2026-11-01", weightKg: 90 },
    ],
    80,
    500,
    NOW,
  );
  assert.equal(trend.source, "trend");
  assert.ok(trend.daysToGoal! > 0);
  const rising = getProjection(
    [
      { date: "2026-10-20", weightKg: 89 },
      { date: "2026-10-25", weightKg: 89.5 },
      { date: "2026-11-01", weightKg: 90 },
    ],
    80,
    500,
    NOW,
  );
  assert.equal(rising.goalDate, null);
});

test("Adelaide day and meal bucket account for daylight saving", () => {
  assert.equal(localDate(new Date("2026-11-01T14:00:00Z")), "2026-11-02");
  assert.equal(mealTypeAt(new Date("2026-11-01T21:00:00Z")), "breakfast");
  assert.equal(mealTypeAt(new Date("2026-11-02T02:00:00Z")), "lunch");
});

test("7pm fixed ACST differs from 7pm Adelaide daylight time", () => {
  const summer = new Date("2026-11-02T08:30:00Z");
  assert.equal(isEveningCheckInDue(summer, "Adelaide"), true);
  assert.equal(isEveningCheckInDue(summer, "ACST"), false);
  assert.equal(
    isEveningCheckInDue(new Date("2026-11-02T09:30:00Z"), "ACST"),
    true,
  );
});

test("snack suggestions fit remaining budget and prioritise protein at high hunger", () => {
  const foods = [
    { id: "1", name: "Yoghurt", calories: 150, protein: 15 },
    { id: "2", name: "Chocolate", calories: 130, protein: 2 },
    { id: "3", name: "Large snack", calories: 600 },
  ];
  assert.equal(suggestSnacks(foods, 200, 8)[0].name, "Yoghurt");
  assert.equal(suggestSnacks(foods, 100, 8).length, 0);
});

test("next milestone stays between current weight and goal", () => {
  assert.equal(nextMilestone(83, 81, 500, NOW).weightKg, 81);
  assert.equal(nextMilestone(90, 80, 500, NOW).weightKg, 85);
});
