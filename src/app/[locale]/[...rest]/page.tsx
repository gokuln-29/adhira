import { notFound } from "next/navigation";

// Any unknown URL under a locale (e.g. /en/nothing-here) lands here so the
// localized not-found page renders with the header and footer.
export default function CatchAllPage() {
  notFound();
}
