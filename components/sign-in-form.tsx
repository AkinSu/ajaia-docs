"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Avatar } from "@/components/avatar";

type DemoUser = { id: string; name: string; email: string };

export function SignInForm({ users }: { users: DemoUser[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [signingIn, setSigningIn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signIn(user: DemoUser) {
    setError(null);
    setSigningIn(user.id);
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not sign in.");
      }
      startTransition(() => {
        router.replace("/docs");
        router.refresh();
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sign in.");
      setSigningIn(null);
    }
  }

  if (users.length === 0) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-medium">No demo accounts found.</p>
        <p className="mt-1">
          Run <code className="rounded bg-amber-100 px-1">npm run setup</code> to create the
          database tables and seed the demo users.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {users.map((user) => {
        const busy = signingIn === user.id || (pending && signingIn === user.id);
        return (
          <button
            key={user.id}
            type="button"
            onClick={() => signIn(user)}
            disabled={signingIn !== null}
            className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Avatar name={user.name} email={user.email} className="size-10" />
            <span className="min-w-0">
              <span className="block truncate font-medium text-slate-900">{user.name}</span>
              <span className="block truncate text-sm text-slate-500">{user.email}</span>
            </span>
            <span className="ml-auto text-sm text-slate-400">
              {busy ? "Signing in…" : "Continue"}
            </span>
          </button>
        );
      })}

      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
