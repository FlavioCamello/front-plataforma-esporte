export type EventStatus = 'Draft' | 'Published' | 'Closed' | 'Cancelled';
export type SportType =
  | 'Running'
  | 'Trail'
  | 'Cycling'
  | 'Swimming'
  | 'Triathlon'
  | 'Walking'
  | 'Other';
export type CategoryGender = 'Male' | 'Female' | 'Mixed' | 'Open';

export interface EventAddress {
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
}

export interface EventCategoryInput {
  id?: string | null;
  name: string;
  format?: string | null;
  activityType?: string | null;
  gender: CategoryGender;
  minAge?: number | null;
  maxAge?: number | null;
  capacity?: number | null;
  /** UC-26 — desconto (0–100) aplicado ao preço do lote na inscrição desta categoria. */
  discountPercent?: number | null;
}

export interface EventLotInput {
  id?: string | null;
  name: string;
  price: number;
  startsAt: string;
  endsAt: string;
}

export interface EventProofInput {
  id?: string | null;
  name: string;
  routeImageUrl?: string | null;
  capacity?: number | null;
  categoryIds: string[];
  /** Lotes de preço deste percurso (janelas de vigência). */
  lots: EventLotInput[];
}

/** Seção livre (título + texto) para conteúdo que não cabe nos campos padrão. */
export interface EventCustomSectionInput {
  id?: string | null;
  title: string;
  content: string;
}

export interface EventListItem {
  id: string;
  name: string;
  slug: string;
  sportType: string;
  startsAt?: string | null;
  timezone: string;
  status: EventStatus;
  venueName?: string | null;
  city?: string | null;
  state?: string | null;
  categoriesCount: number;
  updatedAtUtc?: string | null;
}

export interface PagedEventList {
  items: EventListItem[];
  total: number;
  skip: number;
  take: number;
}

export interface ListMyEventsParams {
  status?: EventStatus | null;
  skip?: number;
  take?: number;
  sort?: string | null;
}



export interface EventModules {
  route: { enabled: boolean; description?: string | null };
  routeImages: {
    enabled: boolean;
    entries: Array<{ title: string; imageUrl: string }>;
  };
  athleteKit: {
    enabled: boolean;
    items: string[];
    extrasNote?: string | null;
  };
  shirtSizeChart: {
    enabled: boolean;
    sizes: Array<{ label: string; widthCm?: number | null; heightCm?: number | null }>;
    measurementHint?: string | null;
  };
  kitPickup: { enabled: boolean; description?: string | null };
  socialLinks: {
    enabled: boolean;
    websiteUrl?: string | null;
    instagramUrl?: string | null;
  };
  discounts: { enabled: boolean };
  services: { enabled: boolean };
  customForm: { enabled: boolean };
}

export interface CreateEventRequest {
  name: string;
  slug?: string | null;
  sportType: string;
  description?: string | null;
  bannerUrl?: string | null;
  startsAt?: string | null;
  timezone?: string | null;
  registrationClosesAt?: string | null;
  venueName?: string | null;
  address?: EventAddress | null;
  categories?: EventCategoryInput[] | null;
  regulationUrl?: string | null;
  regulationText?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  modules: EventModules;
}

/** PATCH UC-14 — front envia snapshot editável (modules completo quando enviado). */
export interface UpdateEventRequest {
  name?: string | null;
  description?: string | null;
  sportType?: string | null;
  bannerUrl?: string | null;
  startsAt?: string | null;
  registrationClosesAt?: string | null;
  venueName?: string | null;
  address?: EventAddress | null;
  categories?: EventCategoryInput[] | null;
  proofs?: EventProofInput[] | null;
  regulationUrl?: string | null;
  regulationText?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  modules?: EventModules;
  customSections?: EventCustomSectionInput[] | null;
}

export interface EventDetail {
  id: string;
  organizerId: string;
  name: string;
  slug: string;
  sportType: string;
  description?: string | null;
  bannerUrl?: string | null;
  startsAt?: string | null;
  timezone: string;
  registrationClosesAt?: string | null;
  venueName?: string | null;
  address: EventAddress;
  categories: Array<EventCategoryInput & { id: string }>;
  proofs?: Array<EventProofInput & { id: string }> | null;
  regulationUrl?: string | null;
  regulationText?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  modules: EventModules;
  status: EventStatus;
  publishedAt?: string | null;
  createdAtUtc: string;
  updatedAtUtc?: string | null;
  customSections?: Array<EventCustomSectionInput & { id: string }> | null;
}

/** UC-18 — detalhe público (sem organizerId interno). */
export interface PublicEventDetail {
  id: string;
  name: string;
  slug: string;
  sportType: string;
  description?: string | null;
  bannerUrl?: string | null;
  startsAt?: string | null;
  timezone: string;
  registrationClosesAt?: string | null;
  venueName?: string | null;
  address: EventAddress;
  categories: Array<EventCategoryInput & { id: string }>;
  proofs: Array<EventProofInput & { id: string }>;
  regulationUrl?: string | null;
  regulationText?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  modules: EventModules;
  status: EventStatus;
  publishedAt?: string | null;
  organizerName: string;
  registrationOpen: boolean;
  customSections?: Array<EventCustomSectionInput & { id: string }> | null;
}

export interface PublicEventListItem {
  id: string;
  name: string;
  slug: string;
  sportType: string;
  bannerUrl?: string | null;
  startsAt?: string | null;
  venueName?: string | null;
  city?: string | null;
  state?: string | null;
  status: EventStatus;
  registrationOpen: boolean;
  organizerName: string;
}

export interface PagedPublicEventList {
  items: PublicEventListItem[];
  total: number;
  skip: number;
  take: number;
}

/** Módulos desligados — contrato do wizard inicial (UC-11). */
export function createDisabledModules(): EventModules {
  return {
    route: { enabled: false, description: null },
    routeImages: { enabled: false, entries: [] },
    athleteKit: { enabled: false, items: [], extrasNote: null },
    shirtSizeChart: { enabled: false, sizes: [], measurementHint: null },
    kitPickup: { enabled: false, description: null },
    socialLinks: { enabled: false, websiteUrl: null, instagramUrl: null },
    discounts: { enabled: false },
    services: { enabled: false },
    customForm: { enabled: false },
  };
}

export const SPORT_TYPE_OPTIONS: Array<{ value: SportType; label: string }> = [
  { value: 'Running', label: 'Corrida' },
  { value: 'Trail', label: 'Trail Run' },
  { value: 'Walking', label: 'Caminhada' },
  { value: 'Cycling', label: 'Ciclismo' },
  { value: 'Swimming', label: 'Natação / Travessia' },
  { value: 'Triathlon', label: 'Triathlon' },
  { value: 'Other', label: 'Outro' },
];

export const CATEGORY_GENDER_OPTIONS: Array<{ value: CategoryGender; label: string }> = [
  { value: 'Open', label: 'Aberto' },
  { value: 'Male', label: 'Masculino' },
  { value: 'Female', label: 'Feminino' },
  { value: 'Mixed', label: 'Misto' },
];

/** Catálogo sugerido de tamanhos (apenas UI — back persiste só os selecionados). */
export const SHIRT_SIZE_CATALOG: Array<{
  label: string;
  widthCm: number;
  heightCm: number;
}> = [
  { label: 'PP', widthCm: 96, heightCm: 63 },
  { label: 'P', widthCm: 102, heightCm: 65 },
  { label: 'M', widthCm: 108, heightCm: 67 },
  { label: 'G', widthCm: 114, heightCm: 69 },
  { label: 'GG', widthCm: 120, heightCm: 71 },
  { label: 'XG', widthCm: 126, heightCm: 73 },
  { label: 'G1', widthCm: 132, heightCm: 75 },
  { label: 'G2', widthCm: 138, heightCm: 77 },
  { label: 'G3', widthCm: 144, heightCm: 79 },
];
