"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/components/avatar";

export function UserMenu({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    await fetch("/api/session", { method: "DELETE" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <Avatar name={name} email={email} className="size-8" />
      <div className="text-right">
        <p className="text-sm font-medium text-slate-900">{name}</p>
        <p className="text-xs text-slate-500">{email}</p>
      </div>
      <button
        type="button"
        onClick={signOut}
        disabled={busy}
        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
      >
        {busy ? "Signing out…" : "Switch account"}
      </button>
    </div>
  );
}
