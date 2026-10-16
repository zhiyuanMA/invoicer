"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12 text-center">
      <h1 className="mb-2 text-lg font-semibold text-zinc-900">Something went wrong</h1>
      <p className="mb-4 text-sm text-zinc-600">
        If the database is not running, start it with <code>npm run db:up</code> and try again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
      >
        Try again
      </button>
    </main>
  );
}
