/**
 * Stub for authMonitoring - deprecated, minimal implementation
 */

export function trackInteractionBlocked(interaction, reason) {
  console.log('[AuthMonitoring] Interaction blocked:', interaction, reason);
}

export function trackInteractionAllowed(interaction) {
  console.log('[AuthMonitoring] Interaction allowed:', interaction);
}
