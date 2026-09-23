import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <div className="text-brand-gradient text-7xl font-black">404</div>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Page not found</h1>
      <p className="mt-2 text-sm text-slate-500">The page you are looking for does not exist or is no longer available.</p>
      <Link href="/" className="bg-brand-gradient mt-6 inline-flex rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-glow">
        Back to home
      </Link>
    </div>
  );
}
