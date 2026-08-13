import { expect, test } from "@playwright/test"

test("an unauthenticated visitor is sent to the login page", async ({ page }) => {
  await page.goto("/")

  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole("heading", { name: "Anmelden" })).toBeVisible()
  await expect(page.getByLabel("E-Mail")).toBeVisible()
  await expect(page.getByLabel("Passwort")).toBeVisible()

  // The gate has to actually withhold the page, not merely change the URL.
  // The Logbuch is the home screen, so its heading is what must not leak.
  await expect(page.getByText("Die sechs Fahrten")).toHaveCount(0)
})

test("the station player is behind the gate too", async ({ page }) => {
  // Closed by default is the whole point: a route is protected because it
  // exists. This checks a deep link, which is the shape someone would actually
  // use to skip a login screen.
  await page.goto("/fahrt/die-jagd/die-jagd")

  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByText("Das stimmt nicht")).toHaveCount(0)
})

test("the parent deck is behind the gate too", async ({ page }) => {
  await page.goto("/deck")

  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByText("Transkripte")).toHaveCount(0)
})

test("the login page is styled by the token stylesheet", async ({ page }) => {
  await page.goto("/login")

  // Proves the generated CSS was built and served — a missing dist/tokens.css
  // leaves this custom property undefined.
  const background = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--color-bg").trim(),
  )

  expect(background).not.toBe("")

  // And that it is Segel's palette rather than the template default, which is
  // the difference between "a build ran" and "this app was designed".
  const brass = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--color-brass").trim(),
  )

  expect(brass).not.toBe("")
})
