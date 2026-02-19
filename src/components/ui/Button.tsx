import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

export default function Button({
  variant = "primary",
  size = "md",
  children,
  className = "",
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center font-medium border-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    primary:
      "bg-[#2DD4BF] border-[#1E1E1E] text-[#1E1E1E] hover:bg-[#1E1E1E] hover:text-white",
    secondary:
      "bg-white border-[#1E1E1E] text-[#1E1E1E] hover:bg-[#F6F0EA]",
    ghost:
      "bg-transparent border-transparent text-[#6B6B6B] hover:bg-[#F6F0EA]",
    danger:
      "bg-white border-red-500 text-red-600 hover:bg-red-50",
  };

  const sizes = {
    sm: "text-xs px-3 py-1.5 rounded-[12px]",
    md: "text-sm px-4 py-2 rounded-[16px]",
    lg: "text-base px-6 py-3 rounded-[22px]",
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
