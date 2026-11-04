import { notFound, redirect } from "next/navigation";
import { DocumentEditor } from "@/components/editor/document-editor";
import { getCurrentUser } from "@/lib/current-user";
import { loadDocumentForUser } from "@/lib/documents";
import { isUuid } from "@/lib/validation";

export const dynamic = "force-dynamic";

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  // A malformed id is treated exactly like one that does not exist.
  if (!isUuid(id)) notFound();

  const found = await loadDocumentForUser(id, user.id);

  // loadDocumentForUser returns null both for "no such document" and "no
  // access", so an outsider cannot tell the two apart.
  if (!found) notFound();

  return (
    <DocumentEditor
      documentId={found.document.id}
      initialTitle={found.document.title}
      initialContent={found.document.content}
      initialVersion={found.document.version}
      role={found.role}
      owner={{ name: found.owner.name, email: found.owner.email }}
      viewerEmail={user.email}
    />
  );
}
