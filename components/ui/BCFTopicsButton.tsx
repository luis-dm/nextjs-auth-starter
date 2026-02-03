import React from "react";

interface BCFTopicsButtonProps {
  onClick?: () => void;
}

export function BCFTopicsButton({ onClick }: BCFTopicsButtonProps) {
  return (
    <button
      className="fixed top-[160px] right-4 w-[50px] h-[50px] rounded-full bg-stone-800 border-none cursor-pointer shadow-[0_4px_16px_rgba(0,0,0,0.1),0_2px_8px_rgba(0,0,0,0.05)] transition-all duration-200 ease-in-out flex items-center justify-center z-[100]"
      onClick={onClick}
      title="BCF Topics"
    >
      <span className="material-icons text-[28px] text-white">topic</span>
    </button>
  );
}
