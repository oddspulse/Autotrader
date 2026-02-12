import { NextRequest, NextResponse } from "next/server";

/**
 * Simple password-based auth gate for the dashboard.
 *
 * The dashboard is read-only but still protects your trading data.
 * Set DASHBOARD_PASSWORD in environment variables.
 *
 * Authentication flow:
 * 1. User visits the dashboard
 * 2. If no auth cookie present, they get a 401 with a password prompt
 * 3. They send password via ?password=xxx query param
 * 4. If correct, a cookie is set and they proceed
 */
export function middleware(request: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;

  // If no password configured, allow access (dev mode)
  if (!password) {
    return NextResponse.next();
  }

  // Check for auth cookie
  const authCookie = request.cookies.get("autotrader_auth");
  if (authCookie?.value === password) {
    return NextResponse.next();
  }

  // Check for password in query params (login attempt)
  const url = new URL(request.url);
  const submittedPassword = url.searchParams.get("password");

  if (submittedPassword === password) {
    // Set auth cookie and redirect to clean URL
    url.searchParams.delete("password");
    const response = NextResponse.redirect(url);
    response.cookies.set("autotrader_auth", password, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
    return response;
  }

  // Return login page
  return new NextResponse(
    `<!DOCTYPE html>
<html>
<head><title>Autotrader Login</title>
<style>
  body { background: #030712; color: #f3f4f6; font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
  .box { background: #111827; padding: 2rem; border-radius: 12px; border: 1px solid #374151; width: 320px; }
  h1 { font-size: 1.25rem; margin: 0 0 1rem; color: #60a5fa; }
  input { width: 100%; padding: 0.75rem; background: #1f2937; border: 1px solid #374151; border-radius: 8px; color: white; font-size: 14px; box-sizing: border-box; }
  button { width: 100%; padding: 0.75rem; background: #3b82f6; border: none; border-radius: 8px; color: white; font-weight: 600; cursor: pointer; margin-top: 0.75rem; font-size: 14px; }
  button:hover { background: #2563eb; }
</style>
</head>
<body>
<div class="box">
  <h1>Autotrader Dashboard</h1>
  <form method="GET">
    <input type="password" name="password" placeholder="Enter dashboard password" autofocus />
    <button type="submit">Login</button>
  </form>
</div>
</body>
</html>`,
    {
      status: 401,
      headers: { "Content-Type": "text/html" },
    }
  );
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
