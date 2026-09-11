import { motion, HTMLMotionProps } from "framer-motion";
import React from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type ButtonSize = "sm" | "md" | "lg" | "xl";

interface ButtonProps
  extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  children: React.ReactNode;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-[#00A651] text-white shadow-sm hover:bg-[#087A43] active:bg-[#087A43]",
  secondary:
    "bg-[#EAF8F0] text-[#00A651] hover:bg-[#D4F1E4] active:bg-[#D4F1E4]",
  ghost: "bg-transparent text-[#00A651] hover:bg-[#EAF8F0] active:bg-[#EAF8F0]",
  danger: "bg-red-50 text-red-600 hover:bg-red-100 active:bg-red-100",
  outline:
    "bg-transparent border border-[#00A651] text-[#00A651] hover:bg-[#EAF8F0]",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs rounded-[10px] gap-1.5",
  md: "h-10 px-4 text-sm rounded-[12px] gap-2",
  lg: "h-12 px-6 text-base rounded-[14px] gap-2",
  xl: "h-14 px-8 text-base font-semibold rounded-[16px] gap-2.5",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = false,
  children,
  icon,
  iconPosition = "left",
  disabled,
  className = "",
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <motion.button
      whileTap={{ scale: isDisabled ? 1 : 0.96 }}
      whileHover={{ scale: isDisabled ? 1 : 1.01 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
      disabled={isDisabled}
      className={[
        "inline-flex items-center justify-center font-semibold cursor-pointer",
        "transition-colors duration-150 select-none",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        variantStyles[variant],
        sizeStyles[size],
        fullWidth ? "w-full" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <>
          {icon && iconPosition === "left" && icon}
          {children}
          {icon && iconPosition === "right" && icon}
        </>
      )}
    </motion.button>
  );
}
