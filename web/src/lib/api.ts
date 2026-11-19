// Centralized API base URL.
// Defaults to same-origin relative `/api/...` (proxied through Next.js to
// Vercel's internal `APP_URL` binding or http://localhost:8000 in local dev).
// Override via NEXT_PUBLIC_API_URL to target an external backend directly.
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
