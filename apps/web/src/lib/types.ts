export type Role = 'BUYER' | 'VENDOR' | 'ADMIN';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: 'ACTIVE' | 'BLOCKED';
  createdAt: string;
  vendor: { id: string; storeName: string; slug: string; status: VendorStatus } | null;
}

export type VendorStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED';
export type ProductStatus = 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'UNPUBLISHED' | 'BLOCKED';
export type OrderStatus = 'PENDING' | 'PAID' | 'FAILED' | 'CANCELED' | 'REFUNDED';
export type WithdrawalStatus = 'REQUESTED' | 'APPROVED' | 'PAID' | 'REJECTED' | 'FAILED';
export type SubscriptionStatus = 'PENDING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED';

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  sortOrder: number;
  productCount?: number;
}

export interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  priceCents: number;
  currency: string;
  interval: 'MONTH' | 'YEAR';
  commissionRateBps: number;
  maxProducts: number | null;
  withdrawalsPerWeek: number;
  isActive: boolean;
  sortOrder: number;
  activeSubscriptions?: number;
}

export interface ProductCard {
  id: string;
  title: string;
  slug: string;
  shortDescription: string;
  priceCents: number;
  currency: string;
  thumbnailUrl: string | null;
  salesCount: number;
  publishedAt: string | null;
  tags: string[];
  category: { id: string; name: string; slug: string };
  vendor: { id: string; storeName: string; slug: string };
}

export interface ProductFile {
  id: string;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  isMain: boolean;
  storageKey?: string;
}

export interface ProductDetail extends ProductCard {
  description: string;
  demoUrl: string | null;
  version: string | null;
  previewImageUrls: (string | null)[];
  files: ProductFile[];
  vendor: { id: string; storeName: string; slug: string; logoUrl?: string | null };
}

export interface VendorProduct {
  id: string;
  title: string;
  slug: string;
  shortDescription: string;
  description: string;
  priceCents: number;
  currency: string;
  status: ProductStatus;
  rejectionReason: string | null;
  thumbnailKey: string | null;
  thumbnailUrl: string | null;
  previewImageKeys: string[];
  previewImageUrls?: (string | null)[];
  demoUrl: string | null;
  version: string | null;
  tags: string[];
  salesCount: number;
  categoryId: string;
  category: { id: string; name: string; slug: string };
  files?: ProductFile[];
  fileCount?: number;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  vendor?: { id: string; storeName: string; slug: string; status: VendorStatus; user?: { email: string } };
}

export interface VendorPublic {
  id: string;
  storeName: string;
  slug: string;
  description: string | null;
  status: VendorStatus;
  createdAt: string;
  productCount: number;
}

export interface Subscription {
  id: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  canceledAt: string | null;
  createdAt: string;
  plan: Plan;
}

export interface VendorMe {
  id: string;
  storeName: string;
  slug: string;
  description: string | null;
  status: VendorStatus;
  payoutDetails: PayoutDetails | null;
  user: { id: string; email: string; name: string };
  subscription: Subscription | null;
  usage: { listedProducts: number; maxProducts: number | null };
}

export interface PayoutDetails {
  type: 'PIX' | 'BANK';
  pixKey?: string;
  holderName?: string;
  holderDocument?: string;
  bankCode?: string;
  branch?: string;
  accountNumber?: string;
  accountType?: 'CHECKING' | 'SAVINGS';
}

export interface CartItem {
  id: string;
  productId: string;
  product: {
    id: string;
    title: string;
    slug: string;
    priceCents: number;
    currency: string;
    thumbnailUrl: string | null;
    vendor: { id: string; storeName: string; slug: string };
  };
}

export interface Cart {
  id: string;
  items: CartItem[];
  subtotalCents: number;
  removedUnavailable: number;
}

export interface OrderItem {
  id: string;
  productId: string;
  productTitle: string;
  priceCents: number;
  commissionRateBps: number;
  commissionCents: number;
  vendorNetCents: number;
  product: { id: string; slug: string; thumbnailUrl?: string | null; version: string | null; files?: ProductFile[] };
  vendor: { id: string; storeName: string; slug: string };
  order?: { id: string; orderNumber: string; paidAt: string | null; buyer?: { name: string; email?: string } };
  _count?: { downloads: number };
}

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  subtotalCents: number;
  totalCents: number;
  currency: string;
  paymentMethod: string | null;
  failureReason: string | null;
  paidAt: string | null;
  createdAt: string;
  items: OrderItem[];
  buyer?: { id: string; name: string; email: string };
}

export interface VendorSale {
  id: string;
  productTitle: string;
  priceCents: number;
  commissionRateBps: number;
  commissionCents: number;
  vendorNetCents: number;
  createdAt: string;
  downloads: number;
  order: { id: string; orderNumber: string; paidAt: string | null; paymentMethod: string | null; currency: string; buyer: { name: string } };
  product: { id: string; slug: string; title: string; thumbnailUrl: string | null; version: string | null };
  plan: { id: string; name: string } | null;
  ledgerEntries: Array<{ id: string; type: string; status: 'PENDING' | 'AVAILABLE'; amountCents: number; availableAt: string | null }>;
}

export interface Balance {
  pendingCents: number;
  availableCents: number;
}

export interface LedgerEntry {
  id: string;
  type: string;
  status: 'PENDING' | 'AVAILABLE';
  amountCents: number;
  availableAt: string | null;
  description: string | null;
  createdAt: string;
  orderItem?: { productTitle: string; order: { orderNumber: string } } | null;
  withdrawal?: { id: string; status: WithdrawalStatus } | null;
}

export interface Withdrawal {
  id: string;
  vendorId: string;
  amountCents: number;
  status: WithdrawalStatus;
  requestedAt: string;
  reviewedAt: string | null;
  paidAt: string | null;
  rejectionReason: string | null;
  adminNotes: string | null;
  vendor?: { id: string; storeName: string; slug: string; payoutDetails: PayoutDetails | null };
  reviewedBy?: { id: string; name: string } | null;
}

export interface WithdrawalEligibility {
  ok: boolean;
  amountCents?: number;
  reason?: string;
  code?: string;
  availableCents: number;
  minWithdrawalCents: number;
  requestsInLastWeek: number;
  withdrawalsPerWeek: number;
}

export interface PublicSettings {
  siteName: string;
  currency: string;
  minWithdrawalCents: number;
  pendingHoldDays: number;
  maxUploadMb: number;
  allowedFileExtensions: string[];
  payoutMode: 'manual' | 'gateway';
}

export interface AdminVendor {
  id: string;
  storeName: string;
  slug: string;
  status: VendorStatus;
  createdAt: string;
  user: { id: string; email: string; name: string; status: string };
  activePlan: { id: string; name: string } | null;
  productCount: number;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: 'ACTIVE' | 'BLOCKED';
  createdAt: string;
  vendor: { id: string; storeName: string; slug: string; status: VendorStatus } | null;
}

export interface FinanceSummary {
  grossSalesCents: number;
  paidItems: number;
  commissionCents: number;
  vendorPendingCents: number;
  vendorAvailableCents: number;
  withdrawals: { status: WithdrawalStatus; count: number; amountCents: number }[];
}
