// lib/types/ticket.ts
// Support : tickets et leur fil d'événements.
import type { ISODateString, Enveloped } from './common';

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type TicketEventType = 'CREATED' | 'STATUS_CHANGED' | 'PRIORITY_CHANGED' | 'MESSAGE' | 'ASSIGNED' | 'RESOLVED' | 'REOPENED';

export interface TicketEvent {
  id: string;
  ticketId: string;
  type: TicketEventType;
  /** Contenu propre au type : message, statut d'arrivée, origine de l'escalade… */
  payload?: {
    content?: string;
    fromAdmin?: boolean;
    /** Nouveau statut ou nouvelle priorité. */
    to?: string;
    reason?: string;
    source?: string;
    problemType?: string;
    [k: string]: unknown;
  } | null;
  authorId?: string | null;
  visibility?: string;
  createdAt: ISODateString;
}

export interface Ticket {
  id: string;
  userId?: string;
  requestId?: number | null;
  title: string;
  description?: string;
  status: TicketStatus;
  /** Toujours posée par le serveur (défaut MEDIUM). */
  priority: TicketPriority;
  createdAt: ISODateString;
  updatedAt?: ISODateString;
  events?: TicketEvent[];
}

/** GET /tickets — tableau, `{ data }` ou `{ tickets }` selon la version. */
export type TicketsResponse =
  | (Ticket[] & { data?: undefined; tickets?: undefined })
  | { data?: Ticket[]; tickets?: Ticket[] };

/** GET /tickets/:id */
export type TicketResponse = Enveloped<Ticket>;

/** GET /tickets/:id/events */
export type TicketEventsResponse = Enveloped<TicketEvent[]>;
