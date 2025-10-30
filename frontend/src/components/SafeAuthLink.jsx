import React from "react";
import { Link, useNavigate, useInRouterContext } from "react-router-dom";

/**
 * SafeAuthLink - A defensive auth navigation component that prevents URL hijacking
 *
 * Problem: Something is intercepting Link clicks and stripping /auth from the URL,
 * resulting in /?mode=signin instead of /auth?mode=signin
 *
 * Solution: This component uses multiple fallbacks to ensure navigation always works:
 * 1. Uses React Router's navigate() with explicit pathname object
 * 2. Intercepts click events to prevent hijacking
 * 3. Falls back to window.location if Router context is missing
 * 4. Uses data-auth-link attribute for debugging/tracking
 */
export default function SafeAuthLink({ mode = "signin", children, className, style }) {
  const navigate = useNavigate();
  const inRouter = useInRouterContext();

  // Build explicit navigation object with both pathname and search
  const toObj = { pathname: "/auth", search: `?mode=${mode}` };

  const onClick = (e) => {
    // Prevent default to stop any global handlers from interfering
    e.preventDefault();
    e.stopPropagation();

    console.log(`🔗 SafeAuthLink: Navigating to /auth?mode=${mode}`);

    if (inRouter) {
      // Use navigate with explicit pathname object (can't be stripped)
      navigate(toObj);
    } else {
      // Fallback: manually construct URL and navigate
      console.warn('⚠️ Router context missing, using window.location fallback');
      const url = new URL(window.location.href);
      url.pathname = "/auth";
      url.search = `?mode=${mode}`;
      window.location.assign(url.toString());
    }
  };

  // Use both Link (for accessibility/SEO) + onClick (for resilience)
  return (
    <Link
      to={toObj}
      onClick={onClick}
      className={className}
      style={style}
      data-auth-link={mode}
    >
      {children}
    </Link>
  );
}
