// Utility functions for handling @username mentions in chat

/**
 * Detect if a text contains @mentions
 * @param {string} text - The text to check
 * @returns {boolean} - Whether the text contains mentions
 */
export const containsMentions = (text) => {
  const mentionRegex = /@[a-zA-Z0-9_]+/g;
  return mentionRegex.test(text);
};

/**
 * Extract all @mentions from text
 * @param {string} text - The text to parse
 * @returns {string[]} - Array of usernames (without @ symbol)
 */
export const extractMentions = (text) => {
  const mentionRegex = /@([a-zA-Z0-9_]+)/g;
  const mentions = [];
  let match;
  
  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push(match[1]);
  }
  
  return [...new Set(mentions)]; // Remove duplicates
};

/**
 * Parse text and convert @mentions to highlighted spans
 * @param {string} text - The text to parse
 * @param {string} currentUsername - Current user's username to highlight differently
 * @returns {JSX.Element[]} - Array of React elements with highlighted mentions
 */
export const parseMentions = (text, currentUsername = null) => {
  const mentionRegex = /@([a-zA-Z0-9_]+)/g;
  const parts = [];
  let lastIndex = 0;
  let match;
  let key = 0;
  
  while ((match = mentionRegex.exec(text)) !== null) {
    // Add text before mention
    if (match.index > lastIndex) {
      parts.push(
        <span key={key++}>{text.substring(lastIndex, match.index)}</span>
      );
    }
    
    // Add mention with styling
    const username = match[1];
    const isCurrentUser = currentUsername && username.toLowerCase() === currentUsername.toLowerCase();
    
    parts.push(
      <span
        key={key++}
        className={`font-semibold cursor-pointer hover:underline ${
          isCurrentUser 
            ? 'text-yellow-400 bg-yellow-400/20 px-1 rounded' 
            : 'text-purple-400 hover:text-purple-300'
        }`}
        data-username={username}
        onClick={(e) => {
          e.stopPropagation();
          // Trigger user profile view or other action
          window.dispatchEvent(new CustomEvent('mention-clicked', { 
            detail: { username } 
          }));
        }}
      >
        @{username}
      </span>
    );
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(
      <span key={key++}>{text.substring(lastIndex)}</span>
    );
  }
  
  return parts.length > 0 ? parts : [<span key={0}>{text}</span>];
};

/**
 * Get the current word being typed for autocomplete
 * @param {string} text - The input text
 * @param {number} cursorPosition - Current cursor position
 * @returns {object|null} - Object with mention info or null
 */
export const getCurrentMention = (text, cursorPosition) => {
  // Find the @ symbol before cursor
  let startIndex = cursorPosition - 1;
  
  while (startIndex >= 0) {
    const char = text[startIndex];
    
    if (char === '@') {
      // Found @ symbol, extract the partial username
      const endIndex = cursorPosition;
      const partialUsername = text.substring(startIndex + 1, endIndex);
      
      // Check if it's a valid partial username (alphanumeric and underscore only)
      if (/^[a-zA-Z0-9_]*$/.test(partialUsername)) {
        return {
          startIndex,
          endIndex,
          partialUsername,
          fullMatch: '@' + partialUsername
        };
      }
      return null;
    }
    
    // If we hit a space or newline, stop searching
    if (char === ' ' || char === '\n') {
      return null;
    }
    
    startIndex--;
  }
  
  return null;
};

/**
 * Replace a mention in text with a selected username
 * @param {string} text - The original text
 * @param {number} startIndex - Start index of the mention
 * @param {number} endIndex - End index of the mention
 * @param {string} username - The selected username to insert
 * @returns {string} - Updated text with the mention replaced
 */
export const replaceMention = (text, startIndex, endIndex, username) => {
  return text.substring(0, startIndex) + '@' + username + ' ' + text.substring(endIndex);
};

/**
 * Check if a username is mentioned in the text
 * @param {string} text - The text to check
 * @param {string} username - The username to look for
 * @returns {boolean} - Whether the username is mentioned
 */
export const isUserMentioned = (text, username) => {
  if (!text || !username) return false;
  
  const mentions = extractMentions(text);
  return mentions.some(mention => 
    mention.toLowerCase() === username.toLowerCase()
  );
};

/**
 * Format message with mention notifications
 * @param {string} message - The message text
 * @param {string[]} mentions - Array of mentioned usernames
 * @returns {object} - Formatted message object
 */
export const formatMessageWithMentions = (message, mentions = []) => {
  return {
    text: message,
    mentions: mentions,
    hasMentions: mentions.length > 0,
    mentionedUsers: mentions.map(username => ({
      username,
      notified: false // Track if notification was sent
    }))
  };
};