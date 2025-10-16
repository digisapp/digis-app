/**
 * Legacy Creator Redirect Component
 *
 * Handles redirects from old /creator/:username routes to new /:username vanity URLs.
 * Uses React Router's useParams hook for proper param reading (SSR-safe).
 *
 * Example: /creator/Miriam → /miriam
 */

import React from 'react';
import { Navigate, useParams } from 'react-router-dom';

export default function LegacyCreatorRedirect() {
  const { username = '' } = useParams();

  // Normalize and encode username (lowercase, trim, URI-safe)
  const safe = String(username).trim().toLowerCase();

  return <Navigate to={`/${encodeURIComponent(safe)}`} replace />;
}
