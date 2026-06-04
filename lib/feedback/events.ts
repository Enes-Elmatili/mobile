export type HapticKind = 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning' | 'error';
export type ToastType = 'success' | 'error' | 'info';
export type CelebrationKind = 'burst';
export type SoundKey = 'newMission' | 'missionAccepted' | 'paymentReceived' | 'providerFound';

export interface FeedbackEventDef {
  tier: 'micro' | 'standard' | 'celebration';
  haptic?: HapticKind;
  sound?: SoundKey;
  toast?: { type: ToastType; messageKey: string };
  celebrate?: { kind: CelebrationKind; titleKey: string };
}

export const FEEDBACK_EVENTS = {
  // micro (haptic only)
  tap_primary:   { tier: 'micro', haptic: 'light' },
  tap_select:    { tier: 'micro', haptic: 'selection' },
  tap_heavy:     { tier: 'micro', haptic: 'medium' },

  // standard (haptic + toast)
  quote_sent:    { tier: 'standard', haptic: 'success', toast: { type: 'success', messageKey: 'feedback.events.quote_sent' } },
  quote_refused: { tier: 'standard', haptic: 'warning', toast: { type: 'info',    messageKey: 'feedback.events.quote_refused' } },
  new_mission:   { tier: 'standard', haptic: 'medium', sound: 'newMission', toast: { type: 'info', messageKey: 'feedback.events.new_mission' } },
  provider_found:{ tier: 'standard', haptic: 'success', sound: 'providerFound', toast: { type: 'success', messageKey: 'feedback.events.provider_found' } },
  saved:         { tier: 'standard', haptic: 'success', toast: { type: 'success', messageKey: 'feedback.events.saved' } },
  error_generic: { tier: 'standard', haptic: 'error',  toast: { type: 'error',   messageKey: 'feedback.events.error_generic' } },

  // celebration (haptic + sound + toast + overlay)
  quote_accepted:  { tier: 'celebration', haptic: 'success', sound: 'missionAccepted', toast: { type: 'success', messageKey: 'feedback.events.quote_accepted' }, celebrate: { kind: 'burst', titleKey: 'feedback.celebrate.quote_accepted' } },
  payment_received:{ tier: 'celebration', haptic: 'success', sound: 'paymentReceived', toast: { type: 'success', messageKey: 'feedback.events.payment_received' }, celebrate: { kind: 'burst', titleKey: 'feedback.celebrate.payment_received' } },
  mission_complete:{ tier: 'celebration', haptic: 'success', sound: 'missionAccepted', toast: { type: 'success', messageKey: 'feedback.events.mission_complete' }, celebrate: { kind: 'burst', titleKey: 'feedback.celebrate.mission_complete' } },
} satisfies Record<string, FeedbackEventDef>;

export type FeedbackEventName = keyof typeof FEEDBACK_EVENTS;
