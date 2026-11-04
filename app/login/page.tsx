import { redirect } from "next/navigation";
import { SignInForm } from "@/components/sign-in-form";
import { getCurrentUser } from "@/lib/current-user";
import { listUsers } from "@/lib/documents";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  let users: Awaited<ReturnType<typeof listUsers>> = [];
  let signedIn = false;
  let loadError: string | null = null;

  // A missing or unreachable database should explain itself rather than crash.
  try {
    // Checking that the account still exists, not just that a cookie is
    // present: a cookie left over from a reseed or redeploy would otherwise
    // bounce between /login and /docs forever.
    signedIn = (await getCurrentUser()) !== null;
    users = await listUsers();
  } catch {
    loadError = "Could not reach the database. Check DATABASE_URL and run npm run setup.";
  }

  // redirect() throws, so it must happen outside the try block.
  if (signedIn) redirect("/docs");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 px-6 py-12">
      <div>
        <p className="text-sm font-medium tracking-wide text-blue-600">Ajaia Docs</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
          Choose an account
        </h1>
        <p className="mt-3 text-slate-600">
          Authentication is mocked for this demo: pick one of the seeded accounts, no password
          needed. To try sharing, sign in as a second account in a separate browser profile or an
          incognito window.
        </p>
      </div>

      {loadError ? (
        <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          {loadError}
        </div>
      ) : (
        <SignInForm users={users} />
      )}
    </main>
  );
}
