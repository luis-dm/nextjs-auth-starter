"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

interface JoinFormProps {
  token: string;
  email: string;
  organizationName: string;
  existingUser: boolean;
}

export default function JoinForm({
  token,
  email,
  organizationName,
  existingUser,
}: JoinFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const validatePassword = (password: string): string | null => {
    if (password.length < 8) {
      return "Password must be at least 8 characters long";
    }
    if (!/[A-Z]/.test(password)) {
      return "Password must contain at least one uppercase letter";
    }
    if (!/[a-z]/.test(password)) {
      return "Password must contain at least one lowercase letter";
    }
    if (!/[0-9]/.test(password)) {
      return "Password must contain at least one number";
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      return "Password must contain at least one special character";
    }
    return null;
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const formData = new FormData(event.currentTarget);
      const password = formData.get("password") as string;
      const name = formData.get("name") as string;

      // Validate password for new users
      if (!existingUser) {
        const passwordError = validatePassword(password);
        if (passwordError) {
          setError(passwordError);
          setIsLoading(false);
          return;
        }
      }

      if (existingUser) {
        // For existing users, just sign in first to verify password
        const signInResult = await signIn("credentials", {
          email,
          password,
          redirect: false,
        });

        if (signInResult?.error) {
          setError("Incorrect password. Please try again.");
          setIsLoading(false);
          return;
        }

        // Then add them to the organization
        const response = await fetch("/api/auth/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            password,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          setError(error.error || "Failed to join organization");
          setIsLoading(false);
          return;
        }
      } else {
        // For new users, create account and join
        const response = await fetch("/api/auth/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            password,
            name,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          setError(error.error || "Failed to join organization");
          setIsLoading(false);
          return;
        }

        // Sign in the new user
        const signInResult = await signIn("credentials", {
          email,
          password,
          redirect: false,
        });

        if (signInResult?.error) {
          setError(
            "Account created but failed to sign in. Please try logging in manually.",
          );
          setIsLoading(false);
          return;
        }
      }

      // Redirect to facility list
      router.push("/org/facility");
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "An error occurred");
      setIsLoading(false);
    }
  }

  return (
    <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
      <div className="rounded-md shadow-xs space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Email Address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            disabled
            value={email}
            className="appearance-none relative block w-full px-3 py-2 border border-gray-300 bg-gray-50 text-gray-500 rounded-md sm:text-sm cursor-not-allowed"
          />
        </div>

        {!existingUser && (
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Full Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-hidden focus:ring-gray-900 focus:border-gray-900 sm:text-sm"
              placeholder="John Doe"
            />
          </div>
        )}

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {existingUser ? "Enter Your Password to Join" : "Set Password"}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-hidden focus:ring-gray-900 focus:border-gray-900 sm:text-sm"
            placeholder="••••••••"
          />
          {existingUser ? (
            <p className="mt-1 text-xs text-gray-500">
              Enter your password to confirm and join the organization
            </p>
          ) : (
            <p className="mt-1 text-xs text-gray-500">
              Must be 8+ characters with uppercase, lowercase, number, and
              special character
            </p>
          )}
        </div>
      </div>

      {error && <div className="text-red-500 text-sm text-center">{error}</div>}

      <div>
        <button
          type="submit"
          disabled={isLoading}
          className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-gray-800 hover:bg-gray-500 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading
            ? "Joining..."
            : existingUser
              ? `Join ${organizationName}`
              : `Create Account & Join ${organizationName}`}
        </button>
      </div>
    </form>
  );
}
