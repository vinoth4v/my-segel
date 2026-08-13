import { signInAction } from "./actions.ts"

export const dynamic = "force-dynamic"

/**
 * The way in. One credential for the household — see lib/deck-gate.ts for why
 * the Segler and the Kapitän are two views behind it rather than two accounts.
 *
 * German, like the rest of the app. She will see this screen too, even though
 * it is her father who types into it.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <main>
      <p className="chartlabel">Segel</p>
      <h1>Anmelden</h1>

      {error ? (
        // Never say which half was wrong.
        <p role="alert">Diese Kombination aus E-Mail und Passwort wurde nicht akzeptiert.</p>
      ) : null}

      <form action={signInAction} className="panel">
        <p>
          <label htmlFor="email">E-Mail</label>
          <input id="email" name="email" type="email" autoComplete="username" required />
        </p>
        <p>
          <label htmlFor="password">Passwort</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </p>
        <button type="submit">Anmelden</button>
      </form>
    </main>
  )
}
