import { avatarUrl, initials } from "@/lib/avatar";

/** Round portrait for a demo account, falling back to initials. */
export function Avatar({
  name,
  email,
  className = "size-10",
}: {
  name: string;
  email: string;
  className?: string;
}) {
  const src = avatarUrl(email);

  if (!src) {
    return (
      <span
        className={`flex shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white ${className}`}
      >
        {initials(name)}
      </span>
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className={`shrink-0 rounded-full object-cover ${className}`} />;
}
