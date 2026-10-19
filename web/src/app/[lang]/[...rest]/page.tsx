import { notFound } from "next/navigation";

// Any address that doesn't match a page shows the not-found page.
export default function CatchAll() {
  notFound();
}
