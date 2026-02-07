"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import Link from "next/link";

export function EmailVerificationBanner() {
  const { data: session } = useSession();
  const [dismissed, setDismissed] = useState(false);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Don't show if dismissed or no session
  if (dismissed || !session?.user?.email) {
    return null;
  }

  // Check if email is verified (we'll need to add this to the session)
  // For now, we'll create a separate component that fetches this

  const handleResend = async () => {
    setResending(true);
    setMessage(null);

    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: session.user.email }),
      });

      if (response.ok) {
        setMessage("Verification email sent! Please check your inbox.");
      } else {
        setMessage("Failed to send verification email. Please try again.");
      }
    } catch (error) {
      setMessage("An error occurred. Please try again.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="bg-yellow-50 border-b border-yellow-200">
      <div className="max-w-7xl mx-auto py-3 px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between flex-wrap">
          <div className="w-0 flex-1 flex items-center">
            <span className="flex p-2 rounded-lg bg-yellow-100">
              <svg
                className="h-5 w-5 text-yellow-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </span>
            <p className="ml-3 font-medium text-yellow-800 text-sm">
              <span>
                Please verify your email address to access all features.
              </span>
              {message && (
                <span className="block sm:inline sm:ml-2 text-yellow-700">
                  {message}
                </span>
              )}
            </p>
          </div>
          <div className="flex-shrink-0 flex items-center space-x-2">
            <button
              onClick={handleResend}
              disabled={resending}
              className="text-sm font-medium text-yellow-800 hover:text-yellow-900 underline disabled:opacity-50"
            >
              {resending ? "Sending..." : "Resend Email"}
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="p-1 rounded-md hover:bg-yellow-100"
            >
              <svg
                className="h-4 w-4 text-yellow-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
