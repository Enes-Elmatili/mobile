import { FEEDBACK_EVENTS, FeedbackEventDef, FeedbackEventName } from '../events';

test('every event has a valid tier and channels', () => {
  const tiers = ['micro', 'standard', 'celebration'];
  for (const [name, def] of Object.entries(FEEDBACK_EVENTS) as [string, FeedbackEventDef][]) {
    expect(tiers).toContain(def.tier);
    if (def.haptic) expect(['light','medium','heavy','selection','success','warning','error']).toContain(def.haptic);
    if (def.toast) expect(['success','error','info']).toContain(def.toast.type);
    if (def.tier === 'celebration') {
      expect(def.celebrate).toBeDefined();
      expect(def.toast).toBeDefined();
    }
  }
});

test('key milestone events exist', () => {
  const required: FeedbackEventName[] = ['quote_accepted','payment_received','mission_complete','quote_refused','error_generic','tap_primary'];
  for (const r of required) expect(FEEDBACK_EVENTS[r]).toBeDefined();
});
