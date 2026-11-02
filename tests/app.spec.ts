import { test, expect, request as apiRequest } from "@playwright/test";

// One sequential journey avoids races against the single-user SQLite store.
// The original records are restored even when an assertion fails.
test("daily tracking, food confirmation, goals, progress and evening check-in persist", async ({
  page,
  request,
}) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  const readState = async () =>
    (await (await request.get("/api/state")).json()).state;
  const nav = (name: string) =>
    page.locator(".sidebar").getByRole("button", { name, exact: true });
  const persist = async (predicate: (state: any) => boolean) =>
    expect.poll(async () => predicate(await readState())).toBe(true);
  let original: any;
  let uploadedPhotoId: string | undefined;
  try {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "A little more balance",
    );
    await expect(page.locator(".save-status")).toContainText(
      "Saved on this device",
    );
    await expect
      .poll(async () => Boolean((await readState())?.version))
      .toBe(true);
    original = await readState();

    // Adding a glass changes the displayed amount and the persisted record.
    const hydration = page
      .locator(".metric-card")
      .filter({
        has: page.getByRole("heading", { name: "A little hydration" }),
      });
    const beforeWater = await hydration.locator(".metric-value").innerText();
    await page
      .getByRole("button", { name: "Add 250ml water", exact: true })
      .click();
    await expect(hydration.locator(".metric-value")).not.toHaveText(
      beforeWater,
    );
    await persist(
      (state) =>
        (Object.values(state.water) as number[]).reduce(
          (sum, value) => sum + value,
          0,
        ) ===
        (Object.values(original.water) as number[]).reduce(
          (sum, value) => sum + value,
          0,
        ) +
          250,
    );

    // Food isn't entered until the explicit confirmation step.
    await nav("Food diary").click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Good food. A lighter mind.",
    );
    await page
      .getByRole("button", { name: "Log food", exact: true })
      .first()
      .click();
    let dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const mealName = `Browser test yoghurt ${Date.now()}`;
    await dialog.getByLabel("What did you eat?").fill(mealName);
    await dialog.getByLabel("Calories (kcal)", { exact: true }).fill("222");
    await dialog.getByLabel("Protein (g)", { exact: true }).fill("12");
    await dialog.getByLabel("Carbohydrates (g)", { exact: true }).fill("24");
    await dialog.getByLabel("Fat (g)", { exact: true }).fill("9");
    await dialog.getByLabel("Meal", { exact: true }).selectOption("Snack");
    expect(
      (await readState()).meals.some((meal: any) => meal.name === mealName),
    ).toBe(false);
    await dialog.getByRole("button", { name: "Confirm & log meal" }).click();
    await expect(page.getByText(mealName, { exact: true })).toBeVisible();
    await persist((state) =>
      state.meals.some(
        (meal: any) =>
          meal.name === mealName &&
          meal.calories === 222 &&
          meal.protein === 12 &&
          meal.mealType === "Snack",
      ),
    );
    await page.reload();
    await expect(page.locator(".save-status")).toContainText(
      "Saved on this device",
    );
    await nav("Food diary").click();
    await expect(page.getByText(mealName, { exact: true })).toBeVisible();
    await page.getByLabel("Filter meal type").selectOption("Breakfast");
    await expect(page.getByText(mealName, { exact: true })).toHaveCount(0);
    await page.getByLabel("Filter meal type").selectOption("Snack");
    await expect(page.getByText(mealName, { exact: true })).toBeVisible();

    // The goal preview recalculates, focus stays in the modal, and the selected plan saves.
    await nav("Today").click();
    await page
      .getByRole("button", { name: "Adjust your goal", exact: true })
      .click();
    dialog = page.getByRole("dialog");
    const originalPreview = await dialog
      .locator(".plan-preview > strong")
      .innerText();
    const newPace = original.profile.pace === "slow" ? "moderate" : "slow";
    await dialog.getByLabel("Your pace").selectOption(newPace);
    await expect(dialog.locator(".plan-preview > strong")).not.toHaveText(
      originalPreview,
    );
    await dialog.getByRole("button", { name: "Close dialog" }).focus();
    await page.keyboard.press("Shift+Tab");
    await expect(
      dialog.getByRole("button", { name: "Save my plan" }),
    ).toBeFocused();
    await dialog.getByRole("button", { name: "Save my plan" }).click();
    await expect(page.locator(".energy-plan")).toContainText(newPace);
    await persist((state) => state.profile.pace === newPace);

    // A weigh-in updates both the profile budget input and the progress history.
    await page.getByRole("button", { name: "Add a weigh-in" }).click();
    dialog = page.getByRole("dialog");
    const nextWeight = Number(
      (original.profile.currentWeightKg - 0.1).toFixed(1),
    );
    await dialog
      .getByLabel("Weight (kg)", { exact: true })
      .fill(String(nextWeight));
    await dialog.getByRole("button", { name: "Save weight" }).click();
    await persist(
      (state) =>
        state.profile.currentWeightKg === nextWeight &&
        state.weights.some((weight: any) => weight.weightKg === nextWeight),
    );
    await nav("My progress").click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Small steps. Real progress.",
    );
    await expect(page.locator(".weigh-in-list")).toContainText(
      nextWeight.toFixed(1),
    );

    // Progress images use the real multipart upload and persistent image route.
    await page.getByRole("button", { name: "Add photo", exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Choose progress photo").setInputFiles({
      name: "progress-test.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGPoW1QBAANqAan1p9SSAAAAAElFTkSuQmCC",
        "base64",
      ),
    });
    await dialog
      .getByLabel("Caption (optional)")
      .fill("Browser-test progress photo");
    const uploadResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/photos") &&
        response.request().method() === "POST",
    );
    await dialog.getByRole("button", { name: "Save progress photo" }).click();
    const upload = await (await uploadResponse).json();
    uploadedPhotoId = upload.id;
    await expect(
      page.getByRole("img", { name: "Browser-test progress photo" }),
    ).toBeVisible();
    expect((await request.get(upload.url)).status()).toBe(200);
    await expect.poll(async () => page.getByRole("img", { name: "Browser-test progress photo" }).evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    await persist((state) =>
      state.photos.some((photo: any) => photo.id === uploadedPhotoId),
    );

    // Hunger and favourites offer a real evening flow, with no external AI dependency.
    await nav("Evening check-in").click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Your evening, made easier.",
    );
    await page.getByLabel("Hunger level").fill("8");
    await expect(page.locator(".hunger-reply")).toContainText(
      "A nourishing meal is a good next step",
    );
    await page
      .getByRole("button", { name: /^(Save|Update) my check-in$/ })
      .click();
    await persist((state) => Object.values(state.hunger).includes(8));
    await page.getByRole("button", { name: "Add a favourite snack" }).click();
    dialog = page.getByRole("dialog");
    const snackName = `Browser-test favourite ${Date.now()}`;
    await dialog.getByLabel("Snack name").fill(snackName);
    await dialog.getByLabel("Calories per serving").fill("25");
    await dialog.getByRole("button", { name: "Save my favourite" }).click();
    await persist((state) =>
      state.favorites.some((snack: any) => snack.name === snackName),
    );
    // A low-calorie favourite fits the seeded sample's budget.
    const snackButton = page.getByRole("button", {
      name: `Log ${snackName}`,
      exact: true,
    });
    if (await snackButton.count()) {
      await snackButton.click();
      await persist((state) =>
        state.meals.some(
          (meal: any) => meal.name === snackName && meal.calories === 25,
        ),
      );
    }

    // A small viewport still exposes navigation without horizontal overflow.
    await page.setViewportSize({ width: 390, height: 844 });
    await nav("Today").click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "A little more balance",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "Add a weigh-in" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(browserErrors).toEqual([]);
  } finally {
    // Stop debounced browser saves before restoring the original single-user data.
    await page.close();
    const cleanup = await apiRequest.newContext({
      baseURL: "http://127.0.0.1:5173",
      timeout: 5_000,
    });
    try {
      if (uploadedPhotoId)
        await cleanup.delete(`/api/photos/${uploadedPhotoId}`);
      if (original)
        expect((await cleanup.put("/api/state", { data: original })).ok()).toBe(
          true,
        );
    } finally {
      await cleanup.dispose();
    }
  }
});
