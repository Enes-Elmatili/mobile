/**
 * types.ts — Interfaces TypeScript calquées sur les modèles Prisma
 *
 * Source de vérité : backend/prisma/schema.prisma
 * Les champs optionnels reflètent les `?` Prisma.
 */

// ── Enums ─────────────────────────────────────────────────────────────────────

export type ProviderDocStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type ProviderStatus    = 'ONLINE' | 'READY' | 'OFFLINE' | 'BUSY';
export type RequestStatus     = 'PUBLISHED' | 'ACCEPTED' | 'ONGOING' | 'DONE' | 'CANCELLED' | 'PENDING_PAYMENT';
export type WalletTxType      = 'CREDIT' | 'DEBIT' | 'HOLD' | 'RELEASE';
export type WithdrawStatus    = 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
export type TicketStatus      = 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
export type TicketPriority    = 'LOW' | 'MEDIUM' | 'HIGH';

// ── Core models ───────────────────────────────────────────────────────────────

export interface Role {
  id: string;
  name: string;
  description?: string;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  city?: string;
  pushToken?: string;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  roles: Role[];
  provider?: Provider;
  wallet?: WalletAccount;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  price?: number;
}

export interface Subcategory {
  id: number;
  categoryId: number;
  name: string;
  slug: string;
  description: string;
  choices?: unknown;
  multiChoice?: unknown;
  openQuestions?: unknown;
}

// ── Provider ──────────────────────────────────────────────────────────────────

export interface Provider {
  id: string;
  userId: string;
  name: string;
  email?: string;
  phone?: string;
  city?: string;
  description?: string;
  lat?: number;
  lng?: number;
  status: ProviderStatus;
  isActive: boolean;
  jobsCompleted: number;
  avgRating: number;
  totalRatings: number;
  totalRequests: number;
  acceptedRequests: number;
  premium: boolean;
  lastActiveAt?: string;
  createdAt: string;
  updatedAt: string;
  categories: Category[];
  documents?: ProviderDocument[];
}

export interface ProviderDocument {
  id: string;
  providerId: string;
  categoryId?: number;
  docKey: string;
  fileUrl: string;
  status: ProviderDocStatus;
  rejectedAt?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderQuizResult {
  id: string;
  providerId: string;
  categoryId: number;
  passed: boolean;
  score: number;
  total: number;
  attemptAt: string;
}

// ── Requests (missions) ───────────────────────────────────────────────────────

export interface Request {
  id: number;
  serviceType: string;
  description: string;
  address: string;
  lat: number;
  lng: number;
  status: RequestStatus;
  urgent: boolean;
  price?: number;
  preferredTimeStart?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  categoryId: number;
  subcategoryId?: number;
  providerId?: string;
  clientId: string;
  category?: Category;
  subcategory?: Subcategory;
  provider?: Provider;
}

// ── Wallet ────────────────────────────────────────────────────────────────────

export interface WalletAccount {
  id: string;
  userId: string;
  balance: number;
}

export interface WalletTransaction {
  id: string;
  accountId: string;
  amount: number;
  type: WalletTxType;
  reference?: string;
  balanceBefore: number;
  balanceAfter: number;
  createdAt: string;
}

export interface WithdrawRequest {
  id: string;
  userId: string;
  amount: number;
  method?: string;
  destination?: string;
  note?: string;
  status: WithdrawStatus;
  approvedAt?: string;
  processedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Quiz & Doc config ─────────────────────────────────────────────────────────

export interface QuizQuestion {
  q: string;
  options: string[];
  // `answer` intentionally absent — masked server-side
}

export interface QuizConfig {
  slug: string;
  label: string;
  passMark: number;
  questions: QuizQuestion[];
}

export interface DocConfig {
  key: string;
  label: string;
  mimeTypes: string[];
  mandatory: boolean;
}

export interface CategoryDocConfig {
  slug: string;
  label: string;
  requiredDocs: DocConfig[];
  hasQuiz: boolean;
}

export interface QuizSubmitResult {
  passed: boolean;
  score: number;
  total: number;
  passMark: number;
  detail?: boolean[];
}

// ── Messages ──────────────────────────────────────────────────────────────────

export interface Message {
  id: string;
  senderId: string;
  recipientId: string;
  text: string;
  createdAt: string;
  readAt?: string;
}

export interface Conversation {
  userId: string;
  name?: string;
  lastMessage: string;
  lastAt: string;
  unread: number;
}

// ── Notifications ─────────────────────────────────────────────────────────────

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  readAt?: string;
  createdAt: string;
}

// ── Utility ───────────────────────────────────────────────────────────────────

/** Erreur enrichie renvoyée par apiClient */
export interface ApiError extends Error {
  status?: number;
  data?: unknown;
}
