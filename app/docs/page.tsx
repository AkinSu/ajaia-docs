import Link from "next/link";
import { redirect } from "next/navigation";
import { DocumentActions } from "@/components/document-actions";
import { DocumentCard } from "@/components/document-card";
import { UserMenu } from "@/components/user-menu";
import { getCurrentUser } from "@/lib/current-user";
import { listDocumentsForUser } from "@/lib/documents";
import { previewBlocks } from "@/lib/preview";

export const dynamic = "force-dynamic";

function EmptyState({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
      {message}
    </p>
  );
}

export default async function DocumentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { owned, shared } = await listDocumentsForUser(user.id);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <Link href="/docs" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" width={28} height={28} className="size-7 rounded-lg" />
            <span className="text-base font-semibold tracking-tight text-slate-900">
              Ajaia Docs
            </span>
          </Link>
          <UserMenu name={user.name} email={user.email} />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-[28px] font-semibold tracking-tight text-slate-900">
              Your documents
            </h1>
            <p className="mt-1 text-[15px] text-slate-600">
              Create a document, or import an existing file to start from.
            </p>
          </div>
          <DocumentActions />
        </div>

        <section className="mt-10">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Owned by me
          </h2>
          {owned.length === 0 ? (
            <div className="mt-3">
              <EmptyState message="You have no documents yet. Create one or import a file to get started." />
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {owned.map((document) => (
                <DocumentCard
                  key={document.id}
                  id={document.id}
                  title={document.title}
                  updatedAt={document.updatedAt.toISOString()}
                  blocks={previewBlocks(document.content)}
                  deletable
                  badge={
                    document.shareCount > 0
                      ? { text: `Shared · ${document.shareCount}`, tone: "neutral" }
                      : null
                  }
                />
              ))}
            </div>
          )}
        </section>

        <section className="mt-12">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Shared with me
          </h2>
          {shared.length === 0 ? (
            <div className="mt-3">
              <EmptyState message="Nothing has been shared with you yet." />
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {shared.map((document) => (
                <DocumentCard
                  key={document.id}
                  id={document.id}
                  title={document.title}
                  updatedAt={document.updatedAt.toISOString()}
                  blocks={previewBlocks(document.content)}
                  subtitle={document.ownerName}
                  badge={{
                    text: document.role === "editor" ? "Can edit" : "View only",
                    tone: document.role === "editor" ? "green" : "neutral",
                  }}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
