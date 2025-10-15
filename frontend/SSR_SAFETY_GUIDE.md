# SSR Safety Guide

This guide ensures we prevent React hydration mismatches (error #310) and maintain SSR compatibility.

## The Problem

When server-rendered HTML doesn't match the client's first render, React throws error #310 (Suspense hydration mismatch). This commonly happens on iOS Safari when:

- Browser APIs (`localStorage`, `window`, `document`, `navigator`) are accessed during render
- Time/locale strings are computed differently between server and client
- Device detection logic runs during initial render
- Random IDs or dynamic values differ between SSR and first client render

## The Solution: HydrationGate

Use `<HydrationGate>` to defer rendering until after hydration when browser APIs are available.

### Usage

```jsx
import HydrationGate from './components/HydrationGate';

// ✅ Correct: Wrap components that need browser APIs
<HydrationGate fallback={<LoadingSpinner />}>
  <ComponentThatUsesLocalStorage />
</HydrationGate>

// ❌ Wrong: Direct browser API access during render
function MyComponent() {
  const theme = localStorage.getItem('theme'); // Causes hydration mismatch!
  return <div>{theme}</div>;
}

// ✅ Correct: Use useEffect for browser APIs
function MyComponent() {
  const [theme, setTheme] = useState('light'); // Static default

  useEffect(() => {
    setTheme(localStorage.getItem('theme') || 'light'); // Client-only
  }, []);

  return <div>{theme}</div>;
}
```

## Common Patterns

### Device Detection

```jsx
// ❌ Wrong: Computed during render
const isMobile = window.innerWidth < 768;

// ✅ Correct: Static default, client-only update
const [isMobile, setIsMobile] = useState(false);
useEffect(() => {
  setIsMobile(window.innerWidth < 768);
}, []);
```

### LocalStorage

```jsx
// ❌ Wrong: Direct access during render
const user = JSON.parse(localStorage.getItem('user'));

// ✅ Correct: useEffect pattern
const [user, setUser] = useState(null);
useEffect(() => {
  const stored = localStorage.getItem('user');
  if (stored) setUser(JSON.parse(stored));
}, []);
```

### Media Queries

```jsx
// ❌ Wrong: matchMedia during render
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ✅ Correct: Static default + useEffect
const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
useEffect(() => {
  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  setPrefersReducedMotion(mediaQuery.matches);

  const handler = (e) => setPrefersReducedMotion(e.matches);
  mediaQuery.addEventListener('change', handler);
  return () => mediaQuery.removeEventListener('change', handler);
}, []);
```

### Date/Time Strings

```jsx
// ❌ Wrong: Dynamic time during SSR
<div>Last updated: {new Date().toLocaleDateString()}</div>

// ✅ Correct: Server timestamp or client-only
const [timestamp, setTimestamp] = useState(null);
useEffect(() => {
  setTimestamp(new Date().toLocaleDateString());
}, []);

return <div>{timestamp ? `Last updated: ${timestamp}` : 'Loading...'}</div>;
```

## When to Use HydrationGate

Wrap these component types with `<HydrationGate>`:

1. **Authentication flows** that check `localStorage` for tokens
2. **Onboarding/tutorial flows** that track progress in storage
3. **Theme toggles** that read dark mode preference
4. **Device-specific UIs** that differ based on viewport
5. **Geolocation features** that use `navigator.geolocation`
6. **Analytics trackers** that access browser info
7. **PWA install prompts** that check service worker state

## ESLint Guardrails

Our ESLint config warns about unsafe patterns:

```bash
⚠️  SSR Warning: localStorage accessed during render may cause hydration mismatch.
   Use within useEffect() or wrap component with <HydrationGate>.
```

To suppress false positives (e.g., in event handlers):

```jsx
// eslint-disable-next-line no-restricted-globals
const handleClick = () => {
  localStorage.setItem('clicked', 'true'); // Safe in event handler
};
```

## Suspense Fallback Safety

Keep Suspense fallbacks static and identical between SSR and client:

```jsx
// ✅ Correct: Static, identical fallback
<Suspense fallback={<div className="spinner" />}>
  <LazyComponent />
</Suspense>

// ❌ Wrong: Dynamic fallback content
<Suspense fallback={<div>Loading {userName}...</div>}>
  <LazyComponent />
</Suspense>
```

## Testing Checklist

Before deploying SSR changes:

1. **Hard refresh on iOS Safari** (unauth'd user)
2. **Login on iPhone** (portrait + landscape)
3. **Check DevTools Console** for React error #310
4. **Verify no flash of wrong content** on first paint
5. **Test with Service Worker disabled** (clear cache)

## Resources

- `src/components/HydrationGate.jsx` - Reference implementation
- React docs: [Hydration Errors](https://react.dev/reference/react-dom/client/hydrateRoot#hydrating-server-rendered-html)
- ESLint config: `frontend/.eslintrc.json` (see `no-restricted-globals`)

## Quick Reference

| Pattern | Safe? | Alternative |
|---------|-------|-------------|
| `localStorage.getItem()` in render | ❌ | Use in `useEffect` |
| `window.innerWidth` in render | ❌ | Use in `useEffect` |
| `document.cookie` in render | ❌ | Use in `useEffect` |
| `navigator.userAgent` in render | ❌ | Use in `useEffect` |
| `new Date()` in render output | ❌ | Use in `useEffect` or static prop |
| `Math.random()` in render | ❌ | Generate server-side or client-only |
| Browser API in `useEffect` | ✅ | Safe! |
| Browser API in event handler | ✅ | Safe! |
| Static JSX | ✅ | Always safe |
