import React from 'react';

interface ToolbarButtonProps {
  icon: string;
  label: string;
  title: string;
  onClick: (event: React.MouseEvent) => void;
  isActive?: boolean;
  isDisabled?: boolean;
  isLoading?: boolean;
}

export default function ToolbarButton({
  icon,
  label,
  title,
  onClick,
  isActive = false,
  isDisabled = false,
  isLoading = false,
}: ToolbarButtonProps) {
  return (
    <div
      className={`toolbar-button flex flex-col items-center py-2 px-3 transition-all duration-200 ease-in-out min-w-[60px] select-none ${
        isDisabled
          ? 'opacity-50 cursor-not-allowed'
          : 'cursor-pointer hover:border-gray-300 hover:bg-gray-50'
      } ${isActive ? 'active' : ''}`}
      onClick={isDisabled ? undefined : onClick}
      title={title}
    >
      <span
        className={`material-icons text-xl mb-0.5 transition-colors duration-200 ease-in-out ${
          isDisabled
            ? 'text-gray-400'
            : isActive
              ? 'text-[#3870D5]'
              : 'text-gray-600'
        }`}
      >
        {icon}
      </span>
      <span
        className={`button-label text-[10px] font-medium text-center leading-tight transition-colors duration-200 ease-in-out ${
          isDisabled
            ? 'text-gray-300'
            : isActive
              ? 'text-[#3870D5]'
              : 'text-gray-400'
        }`}
      >
        {label}
      </span>
    </div>
  );
}
