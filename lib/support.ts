// Centralized support / help configuration.
// Single source of truth for contact channels, response SLAs, and ticket helpers.

export const SUPPORT_CHANNELS = {
  whatsappNumber: '32492123456', // E.164 sans +
  whatsappFallback: 'https://wa.me/message/SXNKDKILPEFMO1',
  emergencyPhone: '+32492123456',
  email: 'support@thefixed.app',
  helpCenterUrl: 'https://thefixed.app/help',
};

// SLA promised to user, by severity. Used in ResolutionView for confidence-building copy.
export const RESPONSE_SLA: Record<'low' | 'medium' | 'high', { label: string; minutes: number }> = {
  low: { label: 'Sous 24 h', minutes: 24 * 60 },
  medium: { label: 'Sous 1 h', minutes: 60 },
  high: { label: 'Immédiat (< 5 min)', minutes: 5 },
};

/**
 * Build a wa.me deep-link with prefilled text. Always prefer this over the
 * generic profile link — it gives the support agent the full context upfront.
 */
export function buildWhatsAppUrl(message: string, number: string = SUPPORT_CHANNELS.whatsappNumber): string {
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${number}?text=${encoded}`;
}

/**
 * Construct a structured support message. Order matters — the support agent
 * scans top-to-bottom: greeting → ticket ref → mission context → user → problem.
 */
export function buildSupportMessage(opts: {
  ticketRef?: string;
  missionId?: number;
  serviceType?: string;
  address?: string;
  createdAt?: string;
  userName?: string;
  problemLabel: string;
}): string {
  const lines: string[] = ['Bonjour FIXED Support,'];

  if (opts.ticketRef) lines.push(`Ticket : ${opts.ticketRef}`);

  if (opts.missionId) {
    lines.push(`Mission : #${opts.missionId}${opts.serviceType ? ` — ${opts.serviceType}` : ''}`);
    if (opts.address) lines.push(`Adresse : ${opts.address}`);
    if (opts.createdAt) {
      const date = new Date(opts.createdAt).toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'long', year: 'numeric',
      });
      lines.push(`Date : ${date}`);
    }
  }

  lines.push(`Problème : ${opts.problemLabel}`);
  if (opts.userName) lines.push(`Client : ${opts.userName}`);

  return lines.join('\n');
}

/**
 * Generates a short user-facing ticket reference from a server-side ticketId
 * (cuid). Truncates to last 8 chars for readability — full ID is the source of truth.
 */
export function shortTicketRef(ticketId: string): string {
  return `FXD-${ticketId.slice(-8).toUpperCase()}`;
}
