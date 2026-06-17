"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">
        <main className="min-h-screen flex items-center justify-center px-4">
          <div className="max-w-md text-center space-y-4">
            <h1 className="text-2xl font-bold text-gray-800">Something went wrong</h1>
            <p className="text-gray-500">
              We hit an unexpected error. Please try again or come back shortly.
            </p>
            {error.digest && (
              <p className="text-xs text-gray-400 font-mono">Error ID: {error.digest}</p>
            )}
            <button
              onClick={reset}
              className="inline-block mt-2 px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
