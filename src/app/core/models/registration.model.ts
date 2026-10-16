export type RegistrationStatus = 'Pending' | 'Confirmed' | 'Cancelled';

export interface CreateRegistrationRequest {
  proofId: string;
  categoryId: string;
  regulationAccepted: boolean;
  shirtSize?: string | null;
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

export interface ListEventRegistrationsParams {
  proofId?: string | null;
  categoryId?: string | null;
  status?: RegistrationStatus | string | null;
  q?: string | null;
  skip?: number;
  take?: number;
  sort?: string | null;
}
