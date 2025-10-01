import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Modal from '../../../components/ui/Modal';
import { ThemeProvider } from '../../../contexts/ThemeContext';

// Mock framer-motion to avoid animation issues in tests
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => <div {...props}>{children}</div>,
    button: ({ children, ...props }) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }) => <>{children}</>,
}));

// Mock createPortal
jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  createPortal: (children) => children,
}));

// Helper function to render with theme context
const renderWithTheme = (component, animations = true) => {
  return render(
    <ThemeProvider value={{ animations }}>
      {component}
    </ThemeProvider>
  );
};

describe('Modal Component', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    children: <div>Modal Content</div>,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset body overflow
    document.body.style.overflow = 'unset';
  });

  test('renders when isOpen is true', () => {
    renderWithTheme(<Modal {...defaultProps} />);
    
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Modal Content')).toBeInTheDocument();
  });

  test('does not render when isOpen is false', () => {
    renderWithTheme(<Modal {...defaultProps} isOpen={false} />);
    
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('renders with title', () => {
    renderWithTheme(<Modal {...defaultProps} title="Test Modal" id="test-modal" />);
    
    expect(screen.getByText('Test Modal')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby', 'test-modal-title');
  });

  test('renders close button when closable', () => {
    renderWithTheme(<Modal {...defaultProps} closable={true} />);
    
    const closeButton = screen.getByLabelText('Close modal');
    expect(closeButton).toBeInTheDocument();
  });

  test('does not render close button when not closable', () => {
    renderWithTheme(<Modal {...defaultProps} closable={false} />);
    
    expect(screen.queryByLabelText('Close modal')).not.toBeInTheDocument();
  });

  test('calls onClose when close button is clicked', () => {
    const onClose = jest.fn();
    renderWithTheme(<Modal {...defaultProps} onClose={onClose} closable={true} />);
    
    const closeButton = screen.getByLabelText('Close modal');
    fireEvent.click(closeButton);
    
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('closes on Escape key when closeOnEscape is true', () => {
    const onClose = jest.fn();
    renderWithTheme(<Modal {...defaultProps} onClose={onClose} closeOnEscape={true} />);
    
    fireEvent.keyDown(document, { key: 'Escape' });
    
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('does not close on Escape key when closeOnEscape is false', () => {
    const onClose = jest.fn();
    renderWithTheme(<Modal {...defaultProps} onClose={onClose} closeOnEscape={false} />);
    
    fireEvent.keyDown(document, { key: 'Escape' });
    
    expect(onClose).not.toHaveBeenCalled();
  });

  test('closes on backdrop click when closeOnOverlayClick is true', () => {
    const onClose = jest.fn();
    renderWithTheme(<Modal {...defaultProps} onClose={onClose} closeOnOverlayClick={true} />);
    
    const backdrop = screen.getByLabelText('Close modal by clicking outside');
    fireEvent.click(backdrop);
    
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('does not close on backdrop click when closeOnOverlayClick is false', () => {
    const onClose = jest.fn();
    renderWithTheme(<Modal {...defaultProps} onClose={onClose} closeOnOverlayClick={false} />);
    
    // Find backdrop (it won't have the button role or aria-label when not clickable)
    const dialog = screen.getByRole('dialog');
    const backdrop = dialog.querySelector('.bg-black\\/50');
    fireEvent.click(backdrop);
    
    expect(onClose).not.toHaveBeenCalled();
  });

  test('applies different size classes', () => {
    const { rerender } = renderWithTheme(<Modal {...defaultProps} size="xs" />);
    let dialog = screen.getByRole('dialog');
    expect(dialog.querySelector('.max-w-xs')).toBeInTheDocument();

    rerender(<ThemeProvider><Modal {...defaultProps} size="sm" /></ThemeProvider>);
    dialog = screen.getByRole('dialog');
    expect(dialog.querySelector('.max-w-md')).toBeInTheDocument();

    rerender(<ThemeProvider><Modal {...defaultProps} size="lg" /></ThemeProvider>);
    dialog = screen.getByRole('dialog');
    expect(dialog.querySelector('.max-w-2xl')).toBeInTheDocument();

    rerender(<ThemeProvider><Modal {...defaultProps} size="full" /></ThemeProvider>);
    dialog = screen.getByRole('dialog');
    expect(dialog.querySelector('.max-w-full')).toBeInTheDocument();
  });

  test('applies different variant styles', () => {
    const { rerender } = renderWithTheme(<Modal {...defaultProps} variant="default" />);
    let dialog = screen.getByRole('dialog');
    expect(dialog.querySelector('.bg-white')).toBeInTheDocument();

    rerender(<ThemeProvider><Modal {...defaultProps} variant="premium" /></ThemeProvider>);
    dialog = screen.getByRole('dialog');
    expect(dialog.querySelector('.bg-gradient-to-br')).toBeInTheDocument();
  });

  test('applies glass effect', () => {
    renderWithTheme(<Modal {...defaultProps} glass={true} />);
    
    const dialog = screen.getByRole('dialog');
    expect(dialog.querySelector('.backdrop-blur-xl')).toBeInTheDocument();
  });

  test('renders loading state', () => {
    renderWithTheme(<Modal {...defaultProps} loading={true} />);
    
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    const spinner = screen.getByRole('dialog').querySelector('svg.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  test('sets body overflow to hidden when open', () => {
    renderWithTheme(<Modal {...defaultProps} isOpen={true} />);
    
    expect(document.body.style.overflow).toBe('hidden');
  });

  test('restores body overflow when closed', () => {
    const { rerender } = renderWithTheme(<Modal {...defaultProps} isOpen={true} />);
    expect(document.body.style.overflow).toBe('hidden');
    
    rerender(<ThemeProvider><Modal {...defaultProps} isOpen={false} /></ThemeProvider>);
    expect(document.body.style.overflow).toBe('unset');
  });

  test('validates invalid size prop', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    
    renderWithTheme(<Modal {...defaultProps} size="invalid-size" />);
    
    expect(consoleSpy).toHaveBeenCalledWith('Invalid modal size: invalid-size. Using md.');
    
    consoleSpy.mockRestore();
  });

  test('validates invalid variant prop', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    
    renderWithTheme(<Modal {...defaultProps} variant="invalid-variant" />);
    
    expect(consoleSpy).toHaveBeenCalledWith('Invalid modal variant: invalid-variant. Using default.');
    
    consoleSpy.mockRestore();
  });

  test('handles missing onClose prop', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    
    renderWithTheme(<Modal isOpen={true} onClose={null}>Content</Modal>);
    
    expect(consoleSpy).toHaveBeenCalledWith('onClose must be a function');
    
    consoleSpy.mockRestore();
  });

  test('handles missing theme context gracefully', () => {
    // Render without ThemeProvider
    render(<Modal {...defaultProps} />);
    
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  test('applies custom className', () => {
    renderWithTheme(<Modal {...defaultProps} className="custom-modal-class" />);
    
    const dialog = screen.getByRole('dialog');
    const modal = dialog.querySelector('.custom-modal-class');
    expect(modal).toBeInTheDocument();
  });

  test('focuses on close button when modal opens', async () => {
    renderWithTheme(<Modal {...defaultProps} closable={true} />);
    
    await waitFor(() => {
      const closeButton = screen.getByLabelText('Close modal');
      expect(closeButton).toHaveFocus();
    });
  });

  test('traps focus within modal', async () => {
    renderWithTheme(
      <Modal {...defaultProps} closable={true}>
        <input data-testid="input-1" />
        <button data-testid="button-1">Button 1</button>
        <button data-testid="button-2">Button 2</button>
      </Modal>
    );

    const closeButton = screen.getByLabelText('Close modal');
    const input1 = screen.getByTestId('input-1');
    const button1 = screen.getByTestId('button-1');
    const button2 = screen.getByTestId('button-2');

    // Focus should start on close button
    await waitFor(() => {
      expect(closeButton).toHaveFocus();
    });

    // Tab through elements
    fireEvent.keyDown(closeButton, { key: 'Tab' });
    expect(input1).toHaveFocus();

    fireEvent.keyDown(input1, { key: 'Tab' });
    expect(button1).toHaveFocus();

    fireEvent.keyDown(button1, { key: 'Tab' });
    expect(button2).toHaveFocus();

    // Tab from last element should go back to first
    fireEvent.keyDown(button2, { key: 'Tab' });
    expect(closeButton).toHaveFocus();

    // Shift+Tab from first element should go to last
    fireEvent.keyDown(closeButton, { key: 'Tab', shiftKey: true });
    expect(button2).toHaveFocus();
  });

  test('renders decorative elements for premium variant', () => {
    renderWithTheme(<Modal {...defaultProps} variant="premium" />);
    
    const dialog = screen.getByRole('dialog');
    const decorativeElements = dialog.querySelectorAll('.animate-pulse');
    expect(decorativeElements.length).toBeGreaterThan(0);
  });

  test('has proper ARIA attributes', () => {
    renderWithTheme(<Modal {...defaultProps} title="Accessible Modal" id="test-modal" />);
    
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'test-modal-title');
    expect(dialog).toHaveAttribute('aria-describedby', 'test-modal-content');
  });

  test('handles keyboard navigation on backdrop', () => {
    const onClose = jest.fn();
    renderWithTheme(<Modal {...defaultProps} onClose={onClose} closeOnOverlayClick={true} />);
    
    const backdrop = screen.getByLabelText('Close modal by clicking outside');
    fireEvent.keyDown(backdrop, { key: 'Enter' });
    
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});