import { useEffect, useCallback } from 'react';
import { triggerHaptic } from '../utils/streamUtils';

/**
 * Keyboard shortcuts hook for streaming controls
 * @param {Object} handlers - Object containing handler functions
 * @param {boolean} enabled - Whether shortcuts are enabled
 */
export const useStreamKeyboardShortcuts = (handlers = {}, enabled = true) => {
  const handleKeyPress = useCallback((event) => {
    // Ignore if user is typing in an input
    if (event.target.tagName === 'INPUT' ||
        event.target.tagName === 'TEXTAREA' ||
        event.target.isContentEditable) {
      return;
    }

    // Ignore if modifier keys are pressed (except shift for help)
    if (event.ctrlKey || event.altKey || (event.metaKey && event.key !== '?')) {
      return;
    }

    const key = event.key.toLowerCase();

    // Define shortcuts
    const shortcuts = {
      'm': () => {
        handlers.onToggleMute?.();
        triggerHaptic(30);
      },
      'v': () => {
        handlers.onToggleVideo?.();
        triggerHaptic(30);
      },
      's': () => {
        handlers.onToggleScreenShare?.();
        triggerHaptic(30);
      },
      'c': () => {
        handlers.onToggleChat?.();
        triggerHaptic(20);
      },
      'a': () => {
        handlers.onToggleAnalytics?.();
        triggerHaptic(20);
      },
      'g': () => {
        handlers.onToggleGifts?.();
        triggerHaptic(20);
      },
      'r': () => {
        if (event.shiftKey) {
          handlers.onToggleRecording?.();
          triggerHaptic(50);
        }
      },
      'f': () => {
        handlers.onToggleFullscreen?.();
        triggerHaptic(20);
      },
      'l': () => {
        handlers.onCycleLayout?.();
        triggerHaptic(20);
      },
      '1': () => {
        handlers.onSetLayout?.('classic');
        triggerHaptic(20);
      },
      '2': () => {
        handlers.onSetLayout?.('theater');
        triggerHaptic(20);
      },
      '3': () => {
        handlers.onSetLayout?.('focus');
        triggerHaptic(20);
      },
      'escape': () => {
        handlers.onEscape?.();
      },
      '?': () => {
        if (event.shiftKey) {
          handlers.onToggleHelp?.();
          triggerHaptic(20);
        }
      },
      ' ': () => {
        // Spacebar - play/pause for viewers
        if (!handlers.isCreator) {
          event.preventDefault();
          handlers.onTogglePlayPause?.();
          triggerHaptic(30);
        }
      },
      'arrowup': () => {
        // Volume up for viewers
        if (!handlers.isCreator) {
          event.preventDefault();
          handlers.onVolumeUp?.();
        }
      },
      'arrowdown': () => {
        // Volume down for viewers
        if (!handlers.isCreator) {
          event.preventDefault();
          handlers.onVolumeDown?.();
        }
      },
      'arrowleft': () => {
        // Rewind for recorded streams
        if (handlers.isRecordedStream) {
          event.preventDefault();
          handlers.onSeekBackward?.();
        }
      },
      'arrowright': () => {
        // Forward for recorded streams
        if (handlers.isRecordedStream) {
          event.preventDefault();
          handlers.onSeekForward?.();
        }
      },
      'p': () => {
        // Picture-in-picture
        handlers.onTogglePictureInPicture?.();
        triggerHaptic(20);
      },
      'n': () => {
        // Network stats
        handlers.onToggleNetworkStats?.();
        triggerHaptic(20);
      },
      't': () => {
        // Theater mode quick toggle
        handlers.onToggleTheaterMode?.();
        triggerHaptic(20);
      },
      'e': () => {
        // Emoji picker for chat
        handlers.onOpenEmojiPicker?.();
        triggerHaptic(20);
      },
      'enter': () => {
        // Focus chat input
        if (!event.target.tagName || event.target.tagName === 'BODY') {
          handlers.onFocusChat?.();
        }
      }
    };

    // Execute the shortcut if it exists
    const shortcutHandler = shortcuts[key];
    if (shortcutHandler) {
      shortcutHandler();
    }
  }, [handlers]);

  useEffect(() => {
    if (!enabled) return;

    // Add event listener
    document.addEventListener('keydown', handleKeyPress);

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [handleKeyPress, enabled]);

  // Return a function to programmatically trigger shortcuts
  return {
    triggerShortcut: (key) => {
      const event = new KeyboardEvent('keydown', { key });
      handleKeyPress(event);
    }
  };
};

/**
 * Get shortcut help text for display
 */
export const getShortcutHelp = (isCreator = true, isRecordedStream = false) => {
  const creatorShortcuts = [
    { key: 'M', action: 'Toggle Mute' },
    { key: 'V', action: 'Toggle Video' },
    { key: 'S', action: 'Share Screen' },
    { key: 'Shift+R', action: 'Toggle Recording' },
    { key: 'C', action: 'Toggle Chat' },
    { key: 'A', action: 'Toggle Analytics' },
    { key: 'G', action: 'Toggle Gifts Panel' },
    { key: 'L', action: 'Cycle Layout' },
    { key: '1/2/3', action: 'Set Layout (Classic/Theater/Focus)' },
    { key: 'F', action: 'Fullscreen' },
    { key: 'P', action: 'Picture-in-Picture' },
    { key: 'N', action: 'Network Stats' },
    { key: 'T', action: 'Theater Mode' },
    { key: 'E', action: 'Emoji Picker' },
    { key: 'Enter', action: 'Focus Chat' },
    { key: '?', action: 'Toggle Help' },
    { key: 'Esc', action: 'Exit Fullscreen/Modal' }
  ];

  const viewerShortcuts = [
    { key: 'Space', action: 'Play/Pause' },
    { key: '↑/↓', action: 'Volume Up/Down' },
    { key: 'M', action: 'Toggle Mute' },
    { key: 'C', action: 'Toggle Chat' },
    { key: 'F', action: 'Fullscreen' },
    { key: 'P', action: 'Picture-in-Picture' },
    { key: 'T', action: 'Theater Mode' },
    { key: 'E', action: 'Emoji Picker' },
    { key: 'Enter', action: 'Focus Chat' },
    { key: '?', action: 'Toggle Help' },
    { key: 'Esc', action: 'Exit Fullscreen' }
  ];

  const recordedStreamShortcuts = [
    ...viewerShortcuts.filter(s => s.key !== '↑/↓'),
    { key: '←/→', action: 'Seek Backward/Forward' },
    { key: '↑/↓', action: 'Volume Up/Down' }
  ];

  if (isRecordedStream) {
    return recordedStreamShortcuts;
  }

  return isCreator ? creatorShortcuts : viewerShortcuts;
};

export default useStreamKeyboardShortcuts;