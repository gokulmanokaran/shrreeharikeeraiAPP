import { useState } from "react";
import { motion } from "framer-motion";
import { signInWithGoogle } from "../../services/authService";

function GoogleIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.25C.45 8.17 0 9.99 0 12s.45 3.83 1.25 5.42l4.03-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  );
}

interface GoogleAuthButtonProps {
  targetPath?: string;
  onError?: (err: string) => void;
  disabled?: boolean;
}

export function GoogleAuthButton({
  targetPath = "/",
  onError,
  disabled = false,
}: GoogleAuthButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    if (loading || disabled) return;

    setLoading(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("shreehari_auth_redirect", targetPath);
    }

    // Redirect to the application root or login page after Google OAuth
    const redirectUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/login`
        : undefined;

    const res = await signInWithGoogle(redirectUrl);

    if (res.error) {
      setLoading(false);
      onError?.(res.error);
    }
  };

  return (
    <div className="w-full">
      <div className="relative flex items-center justify-center my-3.5">
        <div className="border-t border-[#EAEAEA] w-full" />
        <span className="bg-white px-3 text-[11px] font-bold text-[#999999] uppercase tracking-wider absolute">
          or
        </span>
      </div>

      <motion.button
        type="button"
        whileTap={{ scale: 0.97 }}
        onClick={handleGoogleLogin}
        disabled={loading || disabled}
        className="w-full h-12 rounded-[14px] border-2 border-[#EAEAEA] hover:border-gray-300 hover:bg-gray-50/50 bg-white text-sm font-bold text-[#111111] flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-xs disabled:opacity-50"
      >
        {loading ? (
          <span className="w-4 h-4 border-2 border-[#00A651] border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <GoogleIcon className="w-5 h-5" />
            <span>Continue with Google</span>
          </>
        )}
      </motion.button>
    </div>
  );
}
