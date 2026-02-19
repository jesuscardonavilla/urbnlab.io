import React from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export default function Card({ children, className = "", onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-white border-2 border-[#1E1E1E] rounded-[16px] p-4 ${
        onClick
          ? "cursor-pointer hover:bg-[#F6F0EA] transition-colors"
          : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
