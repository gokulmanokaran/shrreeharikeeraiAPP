import { Link } from "react-router-dom";
import type { ReactNode, HTMLAttributes } from "react";

export function AuthLayout({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-[#F5FCF8] flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-[420px] bg-white rounded-[20px] border border-[#EAEAEA] shadow-sm p-5 sm:p-6">
          <h1 className="text-xl font-black text-[#111111] mb-5">{title}</h1>
          {children}
        </div>
        <p className="mt-6 text-[11px] text-[#888888] text-center max-w-sm leading-relaxed">
          Fresh greens delivered across Coimbatore.{" "}
          <Link to="/privacy-policy" className="text-[#00A651] font-semibold">
            Privacy
          </Link>
          {" · "}
          <Link to="/terms" className="text-[#00A651] font-semibold">
            Terms
          </Link>
        </p>
      </div>
    </div>
  );
}

export function AuthField({
  id,
  label,
  type = "text",
  value,
  onChange,
  error,
  placeholder,
  autoComplete,
  inputMode,
  maxLength,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder: string;
  autoComplete?: string;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-bold text-[#555555]">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
        className={`w-full h-12 px-4 border-2 rounded-[12px] text-sm font-medium focus:outline-none transition-colors ${
          error
            ? "border-[#EA4335] bg-red-50/50 focus:border-[#EA4335]"
            : "border-[#EAEAEA] focus:border-[#00A651]"
        }`}
      />
      {error && <p className="text-[#EA4335] text-xs font-semibold px-1">{error}</p>}
    </div>
  );
}
