export type RegistrationStatus = 'Pending' | 'Confirmed' | 'Cancelled';

/** UC-36 — Payment Brick. */
export interface BrickConfig {
  publicKey?: string | null;
  maxInstallments: number;
}

export interface RegistrationCheckout {
  id: string;
  eventId: string;
  eventName: string;
  eventSlug: string;
  status: string;
  priceSnapshot: number;
  paymentExpiresAt?: string | null;
  payerEmail: string;
  qrCode?: string | null;
  qrCodeBase64?: string | null;
}

export interface PayRegistrationRequest {
  paymentMethodId: string;
  token?: string | null;
  issuerId?: string | null;
  installments?: number | null;
  idempotencyKey: string;
  payer?: {
    email?: string | null;
    identification?: { type?: string | null; number?: string | null } | null;
  } | null;
}

export interface PayRegistrationResponse {
  status: 'Approved' | 'Pending' | 'Rejected' | string;
  message?: string | null;
  qrCode?: string | null;
  qrCodeBase64?: string | null;
  registrationStatus?: string | null;
}

export interface CreateRegistrationRequest {
  proofId: string;
  categoryId: string;
  regulationAccepted: boolean;
  shirtSize?: string | null;
  answers?: RegistrationAnswerDto[] | null;
}

export interface RegistrationDto {
  id: string;
  eventId: string;
  proofId: string;
  categoryId: string;
  status: RegistrationStatus | string;
  priceSnapshot: number;
  /** UC-26 — % de desconto da categoria aplicado ao preço. */
  discountPercent?: number | null;
  shirtSize?: string | null;
  regulationAcceptedAt?: string | null;
  createdAt: string;
  eventName: string;
  eventSlug: string;
  eventStartsAt?: string | null;
  /** Checkout Pro (UC-36) — redirecionar quando Pending. */
  checkoutUrl?: string | null;
  preferenceId?: string | null;
  paymentExpiresAt?: string | null;
}

export interface MyRegistrationDto {
  id: string;
  status: RegistrationStatus | string;
  priceSnapshot: number;
  /** UC-26 — % de desconto da categoria aplicado ao preço. */
  discountPercent?: number | null;
  shirtSize?: string | null;
  createdAt: string;
  eventId: string;
  eventName?: string | null;
  eventSlug?: string | null;
  sportType?: string | null;
  bannerUrl?: string | null;
  startsAt?: string | null;
  venueName?: string | null;
  proofName?: string | null;
  categoryName?: string | null;
  checkoutUrl?: string | null;
  paymentExpiresAt?: string | null;
}

export interface PagedMyRegistrations {
  items: MyRegistrationDto[];
  total: number;
  skip: number;
  take: number;
}

export interface ListMyRegistrationsParams {
  status?: RegistrationStatus | string | null;
  skip?: number;
  take?: number;
  sort?: string | null;
}

/** UC-25 — inscrito na visão do organizador. */
export interface EventRegistrationDto {
  id: string;
  status: RegistrationStatus | string;
  proofId: string;
  proofName?: string | null;
  categoryId: string;
  categoryName?: string | null;
  shirtSize?: string | null;
  priceSnapshot: number;
  /** UC-26 — % de desconto da categoria aplicado ao preço. */
  discountPercent?: number | null;
  createdAt: string;
  athleteName: string;
  athleteDocument: string;
  athleteEmail: string;
  athletePhone?: string | null;
  answers?: RegistrationAnswerDto[] | null;
}

export interface RegistrationAnswerDto {
  questionId: string;
  title: string;
  values: string[];
}

export interface RegistrationStatusCountDto {
  status: string;
  count: number;
}

export interface RegistrationProofCountDto {
  proofId: string;
  proofName?: string | null;
  count: number;
}

export interface EventRegistrationAggregatesDto {
  byStatus: RegistrationStatusCountDto[];
  byProof: RegistrationProofCountDto[];
}

export interface PagedEventRegistrations {
  items: EventRegistrationDto[];
  total: number;
  skip: number;
  take: number;
  aggregates: EventRegistrationAggregatesDto;
}

/** UC-52 — linha de corte (prova, lote ou categoria); `group` = prova do lote. */
export interface FinanceBreakdownDto {
  id: string;
  name: string;
  group?: string | null;
  confirmedCount: number;
  confirmedAmount: number;
  pendingCount: number;
  pendingAmount: number;
}

/** UC-52 — resumo financeiro (valores brutos, sem tarifa do gateway). */
export interface EventFinanceDto {
  confirmedCount: number;
  confirmedAmount: number;
  pendingCount: number;
  pendingAmount: number;
  averageTicket?: number | null;
  cancelledCount: number;
  byProof: FinanceBreakdownDto[];
  byLot: FinanceBreakdownDto[];
  byCategory: FinanceBreakdownDto[];
}

export interface ListEventRegistrationsParams {
  proofId?: string | null;
  categoryId?: string | null;
  status?: RegistrationStatus | string | null;
  q?: string | null;
  skip?: number;
  take?: number;
  sort?: string | null;
}
