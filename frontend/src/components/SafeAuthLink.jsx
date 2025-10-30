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
    // CRITICAL: Prevent default and stop propagation IMMEDIATELY
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation(); // Stop other listeners on the same element

    console.log(`🔗 SafeAuthLink: Navigating to /auth?mode=${mode}`);
    console.log(`🔗 Current location:`, window.location.href);
    console.log(`🔗 Router context available:`, inRouter);

    if (inRouter) {
      try {
        // Use navigate with explicit pathname object (can't be stripped)
        console.log(`🔗 Using navigate() with:`, toObj);
        navigate(toObj);

        // Double-check navigation happened correctly after a brief delay
        setTimeout(() => {
          const currentPath = window.location.pathname;
          const currentSearch = window.location.search;
          console.log(`🔗 Post-navigation check:`, { pathname: currentPath, search: currentSearch });

          // If we ended up on /?mode=signin instead of /auth?mode=signin, force correct navigation
          if (currentPath === '/' && currentSearch.includes(`mode=${mode}`)) {
            console.error(`❌ Navigation was hijacked! Expected /auth?mode=${mode}, got ${currentPath}${currentSearch}`);
            console.log(`🔗 Forcing correct navigation via window.location`);
            window.location.href = `/auth?mode=${mode}`;
          }
        }, 100);
      } catch (error) {
        console.error('❌ Navigate failed:', error);
        // Fallback to window.location
        window.location.href = `/auth?mode=${mode}`;
      }
    } else {
      // Fallback: manually construct URL and navigate
      console.warn('⚠️ Router context missing, using window.location fallback');
      const url = new URL(window.location.href);
      url.pathname = "/auth";
      url.search = `?mode=${mode}`;
      const targetUrl = url.toString();
      console.log(`🔗 Navigating to:`, targetUrl);
      window.location.assign(targetUrl);
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
