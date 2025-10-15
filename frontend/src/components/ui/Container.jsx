import React from 'react';

/**
 * Container component - Enforces consistent page width and horizontal spacing
 *
 * Usage:
 *   <Container>Your content here</Container>
 *   <Container className="py-8">Custom spacing</Container>
 *
 * Standards:
 *   - max-w-7xl: Prevents ultra-wide stretch (1280px max)
 *   - mx-auto: Centers content
 *   - px-4 sm:px-6 lg:px-8: Responsive gutters (16px → 24px → 32px)
 *
 * Full-bleed sections (charts, banners):
 *   Wrap with <div className="-mx-4 sm:-mx-6 lg:-mx-8"> to break out
 */
const Container = ({ className = '', children, ...props }) => {
  return (
    <div
      className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export default Container;
