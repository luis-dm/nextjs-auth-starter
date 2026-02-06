"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Plus, X } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [memberEmails, setMemberEmails] = useState<string[]>([""]);
  const [inviteLinks, setInviteLinks] = useState<Array<{
    email: string;
    link: string;
  }> | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [userCredentials, setUserCredentials] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const addEmailField = () => {
    setMemberEmails([...memberEmails, ""]);
  };

  const removeEmailField = (index: number) => {
    if (memberEmails.length > 1) {
      setMemberEmails(memberEmails.filter((_, i) => i !== index));
    }
  };

  const updateEmail = (index: number, value: string) => {
    const updated = [...memberEmails];
    updated[index] = value;
    setMemberEmails(updated);
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    try {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);

      // Filter out empty email fields
      const validEmails = memberEmails.filter((email) => email.trim() !== "");

      // Register user and create organization
      const registerResponse = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          email: formData.get("email"),
          password: formData.get("password"),
          organizationName: formData.get("organizationName"),
          inviteEmails: validEmails,
        }),
      });

      if (!registerResponse.ok) {
        const error = await registerResponse.json();
        setError(error.error || "Registration failed");
        return;
      }

      const registerData = await registerResponse.json();

      // Store credentials for later sign-in
      const email = formData.get("email") as string;
      const password = formData.get("password") as string;
      setUserCredentials({ email, password });

      // If there are invite links, show them
      if (registerData.inviteLinks && registerData.inviteLinks.length > 0) {
        setInviteLinks(registerData.inviteLinks);
        setShowSuccess(true);
        return;
      }

      // Otherwise, sign in and redirect
      const signInResult = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (signInResult?.error) {
        setError("Failed to sign in after registration");
        return;
      }

      router.push("/org/facility");
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Registration failed");
    }
  }

  const handleContinue = async () => {
    if (!userCredentials) {
      router.push("/org/facility");
      return;
    }

    const signInResult = await signIn("credentials", {
      email: userCredentials.email,
      password: userCredentials.password,
      redirect: false,
    });

    if (signInResult?.error) {
      setError("Failed to sign in");
      return;
    }

    router.push("/org/facility");
    router.refresh();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (showSuccess && inviteLinks) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl w-full space-y-8">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-gray-900">
              Registration Successful! 🎉
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Share these invite links with your team members
            </p>
          </div>

          <div className="bg-white shadow rounded-lg p-6 space-y-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Invite Links
            </h3>
            {inviteLinks.map(({ email, link }) => (
              <div
                key={email}
                className="border border-gray-200 rounded-lg p-4 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">{email}</span>
                  <button
                    onClick={() => copyToClipboard(link)}
                    className="text-sm text-gray-800 hover:text-gray-500 font-medium"
                  >
                    Copy Link
                  </button>
                </div>
                <div className="bg-gray-50 p-2 rounded text-xs text-gray-600 font-mono break-all">
                  {link}
                </div>
              </div>
            ))}
          </div>

          <div className="text-center">
            <button
              onClick={handleContinue}
              className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-gray-800 hover:bg-gray-500 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-gray-900"
            >
              Continue to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Create your account
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {/* User Information */}
          <div className="rounded-md shadow-xs space-y-4">
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
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-hidden focus:ring-gray-900 focus:border-gray-900 focus:z-10 sm:text-sm"
                placeholder="John Doe"
              />
            </div>
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
                required
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-hidden focus:ring-gray-900 focus:border-gray-900 focus:z-10 sm:text-sm"
                placeholder="john@company.com"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-hidden focus:ring-gray-900 focus:border-gray-900 focus:z-10 sm:text-sm"
                placeholder="••••••••"
              />
            </div>
          </div>

          {/* Organization Information */}
          <div className="space-y-4">
            <div>
              <label
                htmlFor="organizationName"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Organization Name
              </label>
              <input
                id="organizationName"
                name="organizationName"
                type="text"
                required
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-hidden focus:ring-gray-900 focus:border-gray-900 focus:z-10 sm:text-sm"
                placeholder="Your Company"
              />
            </div>

            {/* Invite Members */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Invite Team Members (Optional)
              </label>
              <div className="space-y-2">
                {memberEmails.map((email, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => updateEmail(index, e.target.value)}
                      className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-hidden focus:ring-gray-900 focus:border-gray-900 sm:text-sm"
                      placeholder="teammate@company.com"
                    />
                    {memberEmails.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeEmailField(index)}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addEmailField}
                className="mt-2 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
              >
                <Plus className="w-4 h-4" />
                Add another member
              </button>
            </div>
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center">{error}</div>
          )}

          <div>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-gray-800 hover:bg-gray-500 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-gray-900"
            >
              Register
            </button>
          </div>
        </form>
        <div className="text-center">
          <Link href="/login" className="text-gray-600 hover:underline">
            Already have an account? Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
