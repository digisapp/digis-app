import React from "react";
import { Link } from "react-router-dom";

/**
 * SafeAuthLink - Proper React Router link to auth page
 *
 * Uses Link with pathname + search (search MUST start with '?')
 * No custom onClick needed - React Router handles it correctly
 */
export default function SafeAuthLink({ mode = "signin", children, className = "" }) {
  return (
    <Link
      to={{ pathname: '/auth', search: `?mode=${mode}` }}
      className={className}
    >
      {children ?? 'Sign in'}
    </Link>
  );
}
