import React, { forwardRef, memo } from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion } from '../../hooks/useReducedMotion';

/**
 * State-of-the-art Card component with design system integration
 * Features: variants, hover effects, glassmorphism, accessibility
 */
const Card = memo(forwardRef(({
  children,
  variant = 'elevated',
  padding = 'md',
  rounded = 'lg',
  shadow = 'md',
  hover = false,
  interactive = false,
  className = '',
  onClick,
  ariaLabel,
  ...props
}, ref) => {

  // Variant styles using design tokens - defined first for validation
  const variantClasses = {
    elevated: `
      bg-surface border border-neutral-200
      ${hover ? 'hover:shadow-lg hover:-translate-y-1' : ''}
    `,
    flat: `
      bg-surface border border-neutral-200
      ${hover ? 'hover:bg-surface-elevated' : ''}
    `,
    outlined: `
      bg-transparent border-2 border-neutral-200
      ${hover ? 'hover:border-primary hover:bg-surface' : ''}
    `,
    glass: `
      glass-medium
      ${hover ? 'hover:glass-heavy hover:shadow-lg' : ''}
    `,
    'glass-dark': `
      glass-dark
      ${hover ? 'hover:glass-heavy hover:shadow-lg' : ''}
    `,
    gradient: `
      bg-gradient-miami border border-primary/20
      ${hover ? 'hover:shadow-primary hover:shadow-lg' : ''}
    `,
    surface: `
      bg-surface-elevated border border-neutral-100
      ${hover ? 'hover:shadow-md hover:bg-surface' : ''}
    `,
    premium: `
      bg-gradient-aurora border border-transparent text-white
      ${hover ? 'hover:shadow-2xl hover:-translate-y-2 hover:shadow-glow' : ''}
    `
  };

  // Padding classes using design tokens
  const paddingClasses = {
    none: 'p-0',
    xs: 'p-2',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
    xl: 'p-8'
  };

  // Border radius classes using design tokens
  const roundedClasses = {
    none: 'rounded-none',
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    xl: 'rounded-xl',
    '2xl': 'rounded-2xl',
    '3xl': 'rounded-3xl',
    full: 'rounded-full'
  };

  // Shadow classes using design tokens
  const shadowClasses = {
    none: 'shadow-none',
    xs: 'shadow-xs',
    sm: 'shadow-sm',
    md: 'shadow-md',
    lg: 'shadow-lg',
    xl: 'shadow-xl',
    '2xl': 'shadow-2xl'
  };

  // Validate props and provide warnings
  if (!variantClasses[variant]) {
    console.warn(`Invalid card variant: ${variant}. Using elevated.`);
    variant = 'elevated';
  }
  if (!paddingClasses[padding]) {
    console.warn(`Invalid padding: ${padding}. Using md.`);
    padding = 'md';
  }
  if (!roundedClasses[rounded]) {
    console.warn(`Invalid rounded: ${rounded}. Using lg.`);
    rounded = 'lg';
  }
  if (!shadowClasses[shadow]) {
    console.warn(`Invalid shadow: ${shadow}. Using md.`);
    shadow = 'md';
  }
  if (interactive && !onClick) {
    console.warn('Interactive card requires an onClick handler');
  }

  // Base card classes using design tokens
  const baseClasses = `
    transition-all duration-normal ease-in-out
    ${interactive ? 'cursor-pointer focus-visible:ring-2 focus:outline-none' : ''}
  `.trim();

  // Check for reduced motion preference
  const prefersReducedMotion = useReducedMotion();

  // Handle keyboard interactions for accessibility
  const handleKeyDown = (e) => {
    if (interactive && (e.key === 'Enter' || e.key === ' ') && onClick) {
      e.preventDefault();
      onClick(e);
    }
  };

  const Component = interactive ? motion.div : 'div';
  const motionProps = interactive && !prefersReducedMotion ? {
    whileHover: { scale: 1.02, y: -2 },
    whileTap: { scale: 0.98 },
    transition: { type: "spring", stiffness: 300, damping: 30 }
  } : {};

  return (
    <Component
      ref={ref}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={[
        baseClasses,
        variantClasses[variant] || variantClasses.elevated,
        paddingClasses[padding] || paddingClasses.md,
        roundedClasses[rounded] || roundedClasses.lg,
        shadowClasses[shadow] || shadowClasses.md,
        className
      ].filter(Boolean).join(' ')}
      tabIndex={interactive ? 0 : undefined}
      role={interactive ? 'button' : undefined}
      aria-label={interactive ? ariaLabel : undefined}
      {...motionProps}
      {...props}
    >
      {children}
    </Component>
  );
}));

Card.displayName = 'Card';

// Card sub-components for better composition
const CardHeader = memo(({ children, className = '', ...props }) => (
  <div className={`mb-4 ${className}`} {...props}>
    {children}
  </div>
));

CardHeader.displayName = 'CardHeader';

const CardTitle = memo(({ children, className = '', as: Component = 'h3', ...props }) => (
  <Component className={`text-xl font-semibold text-primary leading-tight ${className}`} {...props}>
    {children}
  </Component>
));

CardTitle.displayName = 'CardTitle';

const CardSubtitle = memo(({ children, className = '', ...props }) => (
  <p className={`text-sm text-secondary mt-1 ${className}`} {...props}>
    {children}
  </p>
));

CardSubtitle.displayName = 'CardSubtitle';

const CardContent = memo(({ children, className = '', ...props }) => (
  <div className={`${className}`} {...props}>
    {children}
  </div>
));

CardContent.displayName = 'CardContent';

const CardFooter = memo(({ children, className = '', ...props }) => (
  <div className={`mt-4 pt-4 border-t border-neutral-200 ${className}`} {...props}>
    {children}
  </div>
));

CardFooter.displayName = 'CardFooter';

const CardActions = memo(({ children, className = '', justify = 'end', ...props }) => {
  // Validate justify prop
  const validJustifyValues = ['start', 'center', 'end', 'between'];
  if (!validJustifyValues.includes(justify)) {
    console.warn(`Invalid justify prop: ${justify}. Using 'end'.`);
    justify = 'end';
  }

  const justifyClasses = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
    between: 'justify-between'
  };

  return (
    <div className={`flex items-center gap-2 ${justifyClasses[justify] || justifyClasses.end} ${className}`} {...props}>
      {children}
    </div>
  );
});

CardActions.displayName = 'CardActions';

// Attach sub-components
Card.Header = CardHeader;
Card.Title = CardTitle;
Card.Subtitle = CardSubtitle;
Card.Content = CardContent;
Card.Footer = CardFooter;
Card.Actions = CardActions;

export default Card;