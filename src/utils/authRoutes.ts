export const AUTH_PATHS = ["/login", "/signup", "/forgot-password", "/reset-password"];

export function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.some((p) => pathname === p);
}
