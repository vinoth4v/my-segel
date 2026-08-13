import { expect, test } from "@playwright/test"

test("an unauthenticated visitor is sent to the login page", async ({ page }) => {
  await page.goto("/")

  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible()
  await expect(page.getByLabel("Email")).toBeVisible()
  await expect(page.getByLabel("Password")).toBeVisible()

  // The gate has to actually withhold the page, not merely change the URL.
  // Asserted against the real home page's own heading: an assertion about a
  // placeholder that no longer exists would pass forever without testing
  // anything.
  await expect(page.getByText("Was du gefangen hast")).toHaveCount(0)
})

test("the child's surfaces are all closed, not just the home page", async ({ page }) => {
  // Closed by default is the whole point of the gate, and the surfaces added
  // for Segel are exactly where a missed matcher entry would leak — the
  // Logbuch, the gallery and the parent deck all read from the database.
  for (const path of ["/galerie", "/deck", "/reise/die-jagd", "/reise/die-jagd/die-jagd"]) {
    await page.goto(path)
    await expect(page, path).toHaveURL(/\/login/)
  }
})

test("the model endpoints refuse an unauthenticated caller", async ({ request }) => {
  // Belt and braces against the proxy matcher: a route handler that answered
  // without a session would spend tokens for anyone who found the URL.
  const response = await request.post("/api/station/chat", {
    data: { voyageId: "die-jagd", stationId: "die-jagd", messages: [] },
    maxRedirects: 0,
  })
  expect(response.status()).not.toBe(200)
})

test("the login page is styled by the token stylesheet", async ({ page }) => {
  await page.goto("/login")

  // Proves the generated CSS was built and served — a missing dist/tokens.css
  // leaves this custom property undefined.
  const background = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--color-bg").trim(),
  )

  expect(background).not.toBe("")
})
