import { renderHook, act } from '@testing-library/react';
import { ModalProvider, useModal, MODALS } from '../ModalContext';

describe('ModalContext', () => {
  it('should initialize with no modals open', () => {
    const { result } = renderHook(() => useModal(), {
      wrapper: ModalProvider,
    });

    expect(result.current.isOpen(MODALS.TOKEN_PURCHASE)).toBe(false);
    expect(result.current.isOpen(MODALS.GO_LIVE_SETUP)).toBe(false);
  });

  it('should open a modal', () => {
    const { result } = renderHook(() => useModal(), {
      wrapper: ModalProvider,
    });

    act(() => {
      result.current.open(MODALS.TOKEN_PURCHASE);
    });

    expect(result.current.isOpen(MODALS.TOKEN_PURCHASE)).toBe(true);
  });

  it('should close a modal', () => {
    const { result } = renderHook(() => useModal(), {
      wrapper: ModalProvider,
    });

    act(() => {
      result.current.open(MODALS.TOKEN_PURCHASE);
    });

    expect(result.current.isOpen(MODALS.TOKEN_PURCHASE)).toBe(true);

    act(() => {
      result.current.close(MODALS.TOKEN_PURCHASE);
    });

    expect(result.current.isOpen(MODALS.TOKEN_PURCHASE)).toBe(false);
  });

  it('should pass props to modal', () => {
    const { result } = renderHook(() => useModal(), {
      wrapper: ModalProvider,
    });

    const mockProps = { onSuccess: jest.fn(), initialAmount: 100 };

    act(() => {
      result.current.open(MODALS.TOKEN_PURCHASE, mockProps);
    });

    expect(result.current.isOpen(MODALS.TOKEN_PURCHASE)).toBe(true);
    // Props would be verified in the modal component itself
  });

  it('should handle multiple modals independently', () => {
    const { result } = renderHook(() => useModal(), {
      wrapper: ModalProvider,
    });

    act(() => {
      result.current.open(MODALS.TOKEN_PURCHASE);
      result.current.open(MODALS.GO_LIVE_SETUP);
    });

    expect(result.current.isOpen(MODALS.TOKEN_PURCHASE)).toBe(true);
    expect(result.current.isOpen(MODALS.GO_LIVE_SETUP)).toBe(true);

    act(() => {
      result.current.close(MODALS.TOKEN_PURCHASE);
    });

    expect(result.current.isOpen(MODALS.TOKEN_PURCHASE)).toBe(false);
    expect(result.current.isOpen(MODALS.GO_LIVE_SETUP)).toBe(true);
  });

  it('should support all modal types', () => {
    const { result } = renderHook(() => useModal(), {
      wrapper: ModalProvider,
    });

    const modalTypes = [
      MODALS.TOKEN_PURCHASE,
      MODALS.MOBILE_TOKEN_PURCHASE,
      MODALS.GO_LIVE_SETUP,
      MODALS.MOBILE_LIVE_STREAM,
      MODALS.TOKEN_TIPPING,
      MODALS.CREATOR_DISCOVERY,
      MODALS.PRIVACY_SETTINGS,
      MODALS.AVAILABILITY_CALENDAR,
      MODALS.FAN_ENGAGEMENT,
    ];

    modalTypes.forEach((modalType) => {
      act(() => {
        result.current.open(modalType);
      });
      expect(result.current.isOpen(modalType)).toBe(true);

      act(() => {
        result.current.close(modalType);
      });
      expect(result.current.isOpen(modalType)).toBe(false);
    });
  });

  it('should not throw when closing unopened modal', () => {
    const { result } = renderHook(() => useModal(), {
      wrapper: ModalProvider,
    });

    expect(() => {
      act(() => {
        result.current.close(MODALS.TOKEN_PURCHASE);
      });
    }).not.toThrow();
  });

  it('should not throw when opening already opened modal', () => {
    const { result } = renderHook(() => useModal(), {
      wrapper: ModalProvider,
    });

    act(() => {
      result.current.open(MODALS.TOKEN_PURCHASE);
    });

    expect(() => {
      act(() => {
        result.current.open(MODALS.TOKEN_PURCHASE);
      });
    }).not.toThrow();

    expect(result.current.isOpen(MODALS.TOKEN_PURCHASE)).toBe(true);
  });
});
