"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-2xl font-bold text-gray-800">Something went wrong</h1>
        <p className="text-gray-500">
          We hit an unexpected error loading this page. Please try again.
        </p>
        {error.digest && (
          <p className="text-xs text-gray-400 font-mono">Error ID: {error.digest}</p>
        )}
        <div className="flex justify-center gap-3 mt-2">
          <button
            onClick={reset}
            className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
          >
            Try again
          </button>
          <a
            href="/"
            className="px-5 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-100 transition"
          >
            Go home
          </a>
        </div>
      </div>
    </main>
  );
}
