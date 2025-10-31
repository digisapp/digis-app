import React from "react";

/**
 * SafeAuthLink - Just a plain link, no React Router
 *
 * Nuclear option: use window.location.href to force navigation
 */
export default function SafeAuthLink({ mode = "signin", children, className = "" }) {
  const handleClick = (e) => {
    e.preventDefault();
    // Force a full page navigation - bypasses all React Router logic
    window.location.href = `/auth?mode=${mode}`;
  };

  return (
    <a
      href={`/auth?mode=${mode}`}
      onClick={handleClick}
      className={className}
    >
      {children ?? 'Sign in'}
    </a>
  );
}
