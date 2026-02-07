"use client";

import { Info, Users } from "lucide-react";

interface OrganizationCardProps {
  id: string;
  name: string;
  role: string;
  onInvite: (id: string, name: string) => void;
  onViewMembers: (id: string, name: string) => void;
}

export default function OrganizationCard({
  id,
  name,
  role,
  onInvite,
  onViewMembers,
}: OrganizationCardProps) {
  const isManager = role === "MANAGER";

  return (
    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
      <div className="flex-1">
        <p className="font-medium text-gray-900">{name}</p>
        <p className="text-sm text-gray-500">
          Role:{" "}
          <span
            className={`font-medium ${
              isManager ? "text-gray-800" : "text-gray-500"
            }`}
          >
            {isManager ? "Manager" : "Member"}
          </span>
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onViewMembers(id, name)}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          title="View members"
        >
          <Info className="w-4 h-4" />
          Info
        </button>
        {isManager && (
          <button
            onClick={() => onInvite(id, name)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            <Users className="w-4 h-4" />
            Invite
          </button>
        )}
      </div>
    </div>
  );
}
