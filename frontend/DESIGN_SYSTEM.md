# Digis Design System

## Overview
This document outlines the design standards and UI patterns used throughout the Digis application to ensure consistency and maintainability.

## Core Principles
- **Consistency**: Use the same patterns across all pages
- **Accessibility**: Follow WCAG guidelines
- **Performance**: Optimize for speed and efficiency
- **Responsiveness**: Mobile-first approach

## Color Palette

### Primary Colors
- **Purple**: `purple-600` (primary actions)
- **Pink**: `pink-600` (accent)
- **Gradient**: `from-purple-600 to-pink-600`

### Semantic Colors
- **Success**: `green-600`
- **Warning**: `yellow-600` / `orange-600`
- **Error**: `red-600`
- **Info**: `blue-600`

### Neutral Colors
- **Gray Scale**: `gray-50` to `gray-900`
- **Background Light**: `white` / `gray-50`
- **Background Dark**: `gray-800` / `gray-900`

## Typography

### Text Sizes
```css
/* Headings */
.page-header: text-xl sm:text-2xl font-bold
.section-header: text-lg font-semibold  
.card-title: text-base font-medium
.body-text: text-base
.small-text: text-sm
.tiny-text: text-xs

/* Consistent responsive scaling */
.responsive-header: text-xl sm:text-2xl
```

## Layout & Spacing

### Container
```css
.main-container: max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6
```

### Section Spacing
```css
.section-spacing: space-y-6
.large-section-spacing: space-y-8
.compact-spacing: space-y-4
```

### Grid Systems
```css
.responsive-grid: grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6
```

## Components

### Cards
```css
/* Standard Card */
.card: bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 md:p-6

/* Elevated Card */
.card-elevated: bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl

/* Gradient Card */
.card-gradient: bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl shadow-lg
```

### Buttons

Always use the `Button` component from `components/ui/Button.js`:

```jsx
import Button from '../ui/Button';

// Primary Button
<Button variant="primary" size="md">
  Click Me
</Button>

// Secondary Button  
<Button variant="secondary" size="sm">
  Cancel
</Button>

// Icon Button
<Button variant="ghost" size="sm" icon={PlusIcon}>
  Add Item
</Button>
```

**Button Variants:**
- `primary`: Purple/pink gradient
- `secondary`: White with border
- `success`: Green gradient
- `danger`: Red gradient
- `warning`: Yellow/orange gradient
- `ghost`: Transparent
- `outline`: Purple border

**Button Sizes:**
- `xs`: px-3 py-1.5 text-xs
- `sm`: px-4 py-2 text-sm
- `md`: px-5 py-2.5 text-base (default)
- `lg`: px-6 py-3 text-lg
- `xl`: px-8 py-4 text-xl

### Form Inputs
```css
.input: px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500
```

### Navigation Icons
```css
.nav-icon: w-6 h-6 (consistent size, no responsive shrinking)
```

### Modals
```css
.modal-container: bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6
.modal-header: text-xl font-bold mb-4
.modal-body: space-y-4
```

## Dark Mode

All components should support dark mode using Tailwind's dark variant:

```css
/* Light/Dark mode pattern */
bg-white dark:bg-gray-800
text-gray-900 dark:text-white
border-gray-200 dark:border-gray-700
```

## Responsive Design

### Breakpoints
- `sm`: 640px
- `md`: 768px  
- `lg`: 1024px
- `xl`: 1280px
- `2xl`: 1536px

### Mobile-First Approach
Start with mobile styles and add responsive modifiers:

```css
/* Mobile first */
text-base sm:text-lg md:text-xl
px-4 sm:px-6 lg:px-8
```

## Animation & Transitions

### Standard Transitions
```css
.transition-standard: transition-all duration-200
.transition-colors: transition-colors duration-200
.transition-shadow: transition-shadow duration-200
```

### Hover Effects
```css
.hover-lift: hover:shadow-lg hover:scale-105
.hover-glow: hover:shadow-xl
.hover-darken: hover:bg-opacity-90
```

## Best Practices

### Do's
- ✅ Use the Button component for all buttons
- ✅ Use consistent spacing (space-y-6 for sections)
- ✅ Use rounded-xl for main cards
- ✅ Use shadow-md for standard elevation
- ✅ Follow the color palette
- ✅ Test in both light and dark modes
- ✅ Ensure mobile responsiveness

### Don'ts
- ❌ Don't use inline styles for buttons
- ❌ Don't mix different border radius sizes
- ❌ Don't use inconsistent spacing
- ❌ Don't hardcode colors - use theme classes
- ❌ Don't forget hover states
- ❌ Don't neglect accessibility

## Component Examples

### Page Layout Template
```jsx
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
  {/* Page Header */}
  <div>
    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
      Page Title
    </h1>
    <p className="text-gray-600 dark:text-gray-400 mt-1">
      Page description
    </p>
  </div>

  {/* Content Sections */}
  <div className="space-y-6">
    {/* Card Section */}
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 md:p-6">
      {/* Card content */}
    </div>
  </div>
</div>
```

### Card Component Template
```jsx
<div className="bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-lg transition-shadow p-4 md:p-6">
  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
    Card Title
  </h2>
  <div className="space-y-4">
    {/* Card content */}
  </div>
</div>
```

## Token Display
- Always show full numbers with commas: `1,000` not `1k`
- Use `toLocaleString()` for formatting

## Implementation Checklist

When creating new pages or components:

- [ ] Use standard container padding: `px-4 sm:px-6 lg:px-8 py-6`
- [ ] Apply consistent header sizes: `text-xl sm:text-2xl font-bold`
- [ ] Use rounded-xl for cards
- [ ] Apply shadow-md for standard cards
- [ ] Use space-y-6 for section spacing
- [ ] Import and use Button component (not inline styles)
- [ ] Test in both light and dark modes
- [ ] Ensure mobile responsiveness
- [ ] Follow color palette guidelines
- [ ] Add proper hover states

## Maintenance

This design system should be updated whenever:
- New patterns are introduced
- Existing patterns are modified
- Inconsistencies are discovered
- New components are added

Last Updated: 2025-08-27