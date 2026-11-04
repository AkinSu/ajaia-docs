import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6">
      <div>
        <p className="text-sm font-medium tracking-wide text-blue-600">Ajaia</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-900">
          Collaborative document editor
        </h1>
        <p className="mt-4 text-lg text-slate-600">
          Create and format rich-text documents, import existing files, and share them with
          your team.
        </p>
      </div>
      <div>
        <Link
          href="/docs"
          className="inline-flex rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700"
        >
          Open documents
        </Link>
      </div>
    </main>
  );
}
