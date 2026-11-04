import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold text-slate-900">Document not found</h1>
      <p className="text-slate-600">
        This document does not exist, or it has not been shared with your account.
      </p>
      <Link
        href="/docs"
        className="mx-auto rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
      >
        Back to documents
      </Link>
    </main>
  );
}
