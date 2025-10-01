import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Button from '../../../components/ui/Button';
import { GiftIcon } from '@heroicons/react/24/outline';

// Mock framer-motion to avoid animation issues in tests
jest.mock('framer-motion', () => ({
  motion: {
    button: ({ children, ...props }) => <button {...props}>{children}</button>,
  },
}));

describe('Button Component', () => {
  test('renders with children text', () => {
    render(<Button>Click Me</Button>);
    expect(screen.getByRole('button', { name: 'Click Me' })).toBeInTheDocument();
  });

  test('applies primary variant styles by default', () => {
    render(<Button>Primary Button</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('from-purple-600');
    expect(button).toHaveClass('to-pink-600');
  });

  test('applies different variant styles', () => {
    const { rerender } = render(<Button variant="secondary">Secondary</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-white', 'border-gray-300');

    rerender(<Button variant="success">Success</Button>);
    expect(screen.getByRole('button')).toHaveClass('from-green-500');

    rerender(<Button variant="danger">Danger</Button>);
    expect(screen.getByRole('button')).toHaveClass('from-red-500');

    rerender(<Button variant="warning">Warning</Button>);
    expect(screen.getByRole('button')).toHaveClass('from-yellow-500');

    rerender(<Button variant="ghost">Ghost</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-transparent');

    rerender(<Button variant="outline">Outline</Button>);
    expect(screen.getByRole('button')).toHaveClass('border-purple-600');
  });

  test('applies different size styles', () => {
    const { rerender } = render(<Button size="xs">Extra Small</Button>);
    expect(screen.getByRole('button')).toHaveClass('text-xs');

    rerender(<Button size="sm">Small</Button>);
    expect(screen.getByRole('button')).toHaveClass('text-sm');

    rerender(<Button size="md">Medium</Button>);
    expect(screen.getByRole('button')).toHaveClass('text-base');

    rerender(<Button size="lg">Large</Button>);
    expect(screen.getByRole('button')).toHaveClass('text-lg');

    rerender(<Button size="xl">Extra Large</Button>);
    expect(screen.getByRole('button')).toHaveClass('text-xl');
  });

  test('handles click events', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click Me</Button>);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  test('handles keyboard events (Enter and Space)', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Press Me</Button>);
    
    const button = screen.getByRole('button');
    
    // Test Enter key
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(handleClick).toHaveBeenCalledTimes(1);
    
    // Test Space key
    fireEvent.keyDown(button, { key: ' ' });
    expect(handleClick).toHaveBeenCalledTimes(2);
    
    // Test other keys (should not trigger)
    fireEvent.keyDown(button, { key: 'a' });
    expect(handleClick).toHaveBeenCalledTimes(2);
  });

  test('does not handle keyboard events for submit buttons', () => {
    const handleClick = jest.fn();
    render(<Button type="submit" onClick={handleClick}>Submit</Button>);
    
    const button = screen.getByRole('button');
    fireEvent.keyDown(button, { key: 'Enter' });
    
    expect(handleClick).not.toHaveBeenCalled();
  });

  test('renders in disabled state', () => {
    const handleClick = jest.fn();
    render(<Button disabled onClick={handleClick}>Disabled</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveClass('disabled:opacity-50', 'disabled:cursor-not-allowed');
    
    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  test('renders in loading state', () => {
    render(<Button loading>Loading</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    
    // Check for spinner SVG
    const spinner = button.querySelector('svg');
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveClass('animate-spin');
  });

  test('renders with string icon (emoji)', () => {
    render(<Button icon="🎁">Gift</Button>);
    
    const button = screen.getByRole('button');
    const icon = button.querySelector('span[aria-hidden="true"]');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveTextContent('🎁');
  });

  test('renders with JSX icon (Heroicon)', () => {
    render(<Button icon={<GiftIcon data-testid="gift-icon" />}>Gift</Button>);
    
    const button = screen.getByRole('button');
    const icon = screen.getByTestId('gift-icon');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveClass('w-5', 'h-5');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  test('handles invalid icon prop gracefully', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    
    render(<Button icon={123}>Invalid Icon</Button>);
    
    expect(consoleSpy).toHaveBeenCalledWith('Invalid icon prop. Expected string or React element.');
    
    consoleSpy.mockRestore();
  });

  test('applies fullWidth prop', () => {
    render(<Button fullWidth>Full Width</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('w-full');
  });

  test('applies custom className', () => {
    render(<Button className="custom-class shadow-lg">Custom</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('custom-class', 'shadow-lg');
  });

  test('uses custom aria-label when provided', () => {
    render(<Button ariaLabel="Custom label">Button</Button>);
    
    const button = screen.getByRole('button', { name: 'Custom label' });
    expect(button).toBeInTheDocument();
  });

  test('validates and falls back for invalid variant', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    
    render(<Button variant="invalid-variant">Invalid</Button>);
    
    expect(consoleSpy).toHaveBeenCalledWith('Invalid button variant: invalid-variant. Using primary.');
    const button = screen.getByRole('button');
    expect(button).toHaveClass('from-purple-600'); // Primary variant
    
    consoleSpy.mockRestore();
  });

  test('validates and falls back for invalid size', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    
    render(<Button size="invalid-size">Invalid</Button>);
    
    expect(consoleSpy).toHaveBeenCalledWith('Invalid button size: invalid-size. Using md.');
    const button = screen.getByRole('button');
    expect(button).toHaveClass('text-base'); // Medium size
    
    consoleSpy.mockRestore();
  });

  test('passes through additional props', () => {
    render(
      <Button 
        data-testid="test-button"
        id="my-button"
        name="button-name"
      >
        Props Test
      </Button>
    );
    
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('data-testid', 'test-button');
    expect(button).toHaveAttribute('id', 'my-button');
    expect(button).toHaveAttribute('name', 'button-name');
  });

  test('focuses on click and shows focus ring', () => {
    render(<Button>Focus Me</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('focus:ring-2', 'focus:ring-purple-500', 'focus:ring-offset-2');
  });
});