"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

interface CreateOrganizationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateOrganizationModal({
  isOpen,
  onClose,
}: CreateOrganizationModalProps) {
  const [organizationName, setOrganizationName] = useState("");
  const [memberEmails, setMemberEmails] = useState<string[]>([""]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const validEmails = memberEmails.filter((email) => email.trim() !== "");

      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: organizationName,
          inviteEmails: validEmails,
        }),
      });

      if (response.ok) {
        setOrganizationName("");
        setMemberEmails([""]);
        onClose();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to create organization");
      }
    } catch (error) {
      setError("An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-xl font-bold text-gray-900">
            Create Organization
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <span className="text-2xl">&times;</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Organization Name
            </label>
            <input
              type="text"
              required
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900"
              placeholder="Your Company"
            />
          </div>

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
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900"
                    placeholder="teammate@company.com"
                  />
                  {memberEmails.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeEmailField(index)}
                      className="p-2 text-gray-400 hover:text-red-500"
                    >
                      <span className="text-xl">&times;</span>
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

          {error && (
            <div className="text-red-500 text-sm text-center">{error}</div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-50"
            >
              {isSubmitting ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
