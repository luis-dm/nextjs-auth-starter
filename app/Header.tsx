"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useState, useRef, useEffect } from "react";
import { User } from "lucide-react";

export default function Header() {
  const { data: session } = useSession();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);

  return (
    <header className="w-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.1)] border-b border-gray-300 py-4 px-8">
      <nav className="flex justify-between items-center">
        <Link
          href="/"
          className="text-3xl font-bold text-gray-800 hover:text-blue-600 transition-colors"
        >
          OpenBIM
        </Link>
        <div className="flex items-center space-x-4">
          {session ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer"
              >
                <div className="flex items-center justify-center w-10 h-10 bg-gray-200 rounded-full">
                  <User className="w-5 h-5 text-gray-600" />
                </div>
                <div className="flex flex-col items-start text-left">
                  <div className="font-semibold text-gray-900">
                    {session.user?.name || "User"}
                  </div>
                  <div className="text-sm text-gray-500">
                    {session.user?.email}
                  </div>
                </div>
              </button>

              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      signOut({
                        callbackUrl: `${window.location.origin}/login`,
                      });
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 transition-colors rounded-md"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition"
            >
              Sign In
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
