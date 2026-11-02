import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="standalone-state">
      <span className="eyebrow">404 · A little off track</span>
      <h1>This page isn’t here.</h1>
      <p>Let’s get you back to your people.</p>
      <Link className="btn btn-primary" href="/app">
        Go to your workspace
      </Link>
    </main>
  );
}
