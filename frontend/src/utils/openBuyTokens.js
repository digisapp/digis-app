import { useModal, MODALS } from '../contexts/ModalContext';

/**
 * Custom hook for opening the Buy Tokens modal
 * Automatically detects mobile vs desktop and opens the appropriate modal
 *
 * @returns {Function} openBuyTokens - Function to open the buy tokens modal
 *
 * @example
 * const openBuyTokens = useOpenBuyTokens();
 *
 * // Usage in a button
 * <button onClick={() => openBuyTokens({
 *   onSuccess: (tokensAdded) => {
 *     console.log(`Added ${tokensAdded} tokens!`);
 *     refreshWallet();
 *   }
 * })}>
 *   Buy Tokens
 * </button>
 */
export function useOpenBuyTokens() {
  const { open } = useModal();

  return ({ onSuccess }) => {
    const isMobile = window.matchMedia('(max-width: 768px)').matches;

    if (isMobile) {
      open(MODALS.MOBILE_TOKEN_PURCHASE, {
        onPurchaseSuccess: onSuccess
      });
    } else {
      open(MODALS.TOKEN_PURCHASE, {
        onSuccess
      });
    }
  };
}
