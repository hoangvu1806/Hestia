import Link from "next/link";

export default function NotFound() {
  return (
    <main className="not-found">
      <span>404</span>
      <h1>This kitchen is not available.</h1>
      <Link href="/en">Return to Hestia</Link>
    </main>
  );
}
