import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <h1 className="text-3xl font-bold">Page not found</h1>
      <p className="mt-2 text-slate-500">The page you are looking for does not exist or is no longer available.</p>
      <Link href="/" className="mt-6 inline-block text-indigo-600 hover:underline">
        Back to home
      </Link>
    </div>
  );
}
