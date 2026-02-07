"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";

export function EmailVerificationBanner() {
  const { data: session } = useSession();
  const [dismissed, setDismissed] = useState(false);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState<boolean | null>(null);

  // Fetch verification status
  useEffect(() => {
    if (!session?.user?.email) {
      setIsVerified(null);
      return;
    }

    const checkVerification = async () => {
      try {
        const response = await fetch("/api/auth/verification-status");
        if (response.ok) {
          const data = await response.json();
          setIsVerified(data.emailVerified);
        }
      } catch (error) {
        console.error("Failed to check verification status:", error);
      }
    };

    checkVerification();
  }, [session?.user?.email]);

  // Don't show if dismissed, no session, or email is verified
  if (
    dismissed ||
    !session?.user?.email ||
    isVerified === true ||
    isVerified === null
  ) {
    return null;
  }

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
    <div className="bg-yellow-50 mb-8 border-b border-yellow-200 w-1/2 mx-auto">
      <div className="max-w-7xl mx-auto py-3 px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center flex-1 min-w-0">
            <span className="flex p-2 rounded-lg bg-yellow-100 shrink-0">
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
            <div className="ml-3 flex-1 min-w-0">
              <p className="font-medium text-yellow-800 text-sm">
                Please verify your email address to access all features.
              </p>
              {message && (
                <p className="text-sm text-yellow-700 mt-1">{message}</p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-3 shrink-0">
            <button
              onClick={handleResend}
              disabled={resending}
              className="text-sm font-medium text-yellow-800 hover:text-yellow-900 underline disabled:opacity-50 whitespace-nowrap"
            >
              {resending ? "Sending..." : "Resend Email"}
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="p-1 rounded-md hover:bg-yellow-100 shrink-0"
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
