import React from "react";
import { useNavigate } from "react-router-dom";
import { buildAuthUrl } from "../utils/nav";

/**
 * SafeAuthLink - Centralized auth navigation component
 *
 * Uses buildAuthUrl() to ensure proper navigation to /auth?mode=X
 * Prevents the common bug: navigate({ search: '?mode=signin' }) → /?mode=signin
 */
export default function SafeAuthLink({ mode = "signin", children, className, style }) {
  const navigate = useNavigate();

  // Build proper auth URL with pathname + search
  const authUrl = buildAuthUrl(mode);

  const onClick = (e) => {
    e.preventDefault();
    e.stopPropagation();

    console.log(`🔗 SafeAuthLink: Navigating to /auth?mode=${mode}`);
    navigate(authUrl);
  };

  // Use regular anchor with onClick handler
  // href provides fallback for accessibility and no-JS scenarios
  return (
    <a
      href={`/auth?mode=${mode}`}
      onClick={onClick}
      className={className}
      style={style}
      data-auth-link={mode}
    >
      {children ?? 'Sign in'}
    </a>
  );
}
