import Link from "next/link";
import { redirect } from "next/navigation";
import { DocumentActions } from "@/components/document-actions";
import { OwnedDocumentRow } from "@/components/owned-document-row";
import { UserMenu } from "@/components/user-menu";
import { getCurrentUser } from "@/lib/current-user";
import { listDocumentsForUser } from "@/lib/documents";
import { formatRelativeTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { owned, shared } = await listDocumentsForUser(user.id);

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/docs" className="text-lg font-semibold tracking-tight text-slate-900">
            Ajaia Docs
          </Link>
          <UserMenu name={user.name} email={user.email} />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Documents</h1>
            <p className="mt-1 text-sm text-slate-600">
              Create a document, or import an existing file to start from.
            </p>
          </div>
          <DocumentActions />
        </div>

        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            My documents
          </h2>
          {owned.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
              You have no documents yet. Create one or import a file to get started.
            </p>
          ) : (
            <ul className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
              {owned.map((document) => (
                <OwnedDocumentRow
                  key={document.id}
                  document={{
                    id: document.id,
                    title: document.title,
                    updatedAt: document.updatedAt.toISOString(),
                    shareCount: document.shareCount,
                  }}
                />
              ))}
            </ul>
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Shared with me
          </h2>
          {shared.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
              Nothing has been shared with you yet.
            </p>
          ) : (
            <ul className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
              {shared.map((document) => (
                <li
                  key={document.id}
                  className="group border-b border-slate-100 last:border-b-0"
                >
                  <Link href={`/docs/${document.id}`} className="flex items-center gap-3 px-4 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-slate-900 group-hover:text-blue-700">
                        {document.title}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-slate-500">
                        Owned by {document.ownerName} · edited{" "}
                        {formatRelativeTime(document.updatedAt)}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        document.role === "editor"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {document.role === "editor" ? "Can edit" : "View only"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
