// ==================== TENANT / FARM TYPES ====================

export interface Farm {
  id?: number;
  farmId: string;
  farmCode: string;
  farmName: string;
  businessName: string;
  ownerName: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  state: string;
  lga: string;
  country: string;
  farmType: string;
  logo: string;
  subscriptionStatus: 'active' | 'trial' | 'expired' | 'suspended';
  registrationDate: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
  syncStatus: 'pending' | 'synced' | 'failed' | 'conflicted';
}

export interface ImportLog {
  id?: number;
  farmId: string;
  fileName: string;
  moduleName: string;
  importMode: 'add_new' | 'update_existing' | 'replace_existing';
  totalRows: number;
  successfulImports: number;
  updatedRecords: number;
  failedRecords: number;
  skippedRecords: number;
  duplicateRecords: number;
  processingTimeMs: number;
  importedBy: string;
  importedAt: string;
  errors?: string;
}

// ==================== CORE ENTITY TYPES ====================

export interface Batch {
  id?: number;
  farmId: string;
  batchId: string;
  batchName: string;
  house: string;
  birdType: string;
  breed: string;
  source: string;
  supplier: string;
  dateReceived: string;
  quantityReceived: number;
  initialAverageWeight: number;
  productionStage: string;
  expectedProductionDate: string;
  currentPopulation: number;
  status: 'active' | 'closed' | 'depleted';
  notes: string;
  createdBy: string;
  createdAt: string;
  modifiedBy: string;
  updatedAt: string;
  syncDate: string;
  syncStatus: 'pending' | 'synced' | 'failed' | 'conflicted';
}

export interface DailyReport {
  id?: number;
  farmId: string;
  reportDate: string;
  batchId: number;
  batchName: string;
  eggProduction: EggProduction[];
  mortality: MortalityRecord[];
  feedIntake: FeedIntake[];
  medication: MedicationRecord[];
  weights: WeightRecord[];
  environment: EnvironmentRecord[];
  notes: string;
  createdBy: string;
  createdAt: string;
  modifiedBy: string;
  updatedAt: string;
  syncDate: string;
  syncStatus: 'pending' | 'synced' | 'failed' | 'conflicted';
}

export interface EggProduction {
  id?: number;
  reportId?: number;
  totalPieces: number;
  cracked: number;
  damaged: number;
  notes: string;
}

export interface MortalityRecord {
  id?: number;
  reportId?: number;
  numberDead: number;
  reason: string;
  otherReason?: string;
  notes: string;
}

export interface FeedIntake {
  id?: number;
  reportId?: number;
  feedType: string;
  feedBrand: string;
  quantityGrams: number;
  feedingSession: string;
  notes: string;
}

export interface MedicationRecord {
  id?: number;
  reportId?: number;
  medicationName: string;
  medicationCategory: string;
  quantityUsed: number;
  unit: string;
  administrationMethod: string;
  supplier: string;
  notes: string;
}

export interface WeightRecord {
  id?: number;
  reportId?: number;
  averageEggWeight: number;
  averageBodyWeight: number;
  eggWeightUnit: string;
  bodyWeightUnit: string;
}

export interface EnvironmentRecord {
  id?: number;
  reportId?: number;
  temperature: number;
  humidity: number;
  weatherCondition: string;
  ventilationStatus: string;
  lightHours: number;
  waterConsumption: number;
  waterUnit: string;
  notes: string;
}

export interface Attachment {
  id?: number;
  farmId: string;
  reportId?: number;
  fileName: string;
  fileData: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
}

export interface Product {
  id?: number;
  farmId: string;
  productId: string;
  productName: string;
  category: string;
  unit: string;
  currentStock: number;
  minimumStock: number;
  sellingPrice: number;
  purchasePrice: number;
  image?: string;
  status: 'active' | 'inactive';
  createdBy: string;
  createdAt: string;
  modifiedBy: string;
  updatedAt: string;
  syncDate: string;
  syncStatus: 'pending' | 'synced' | 'failed' | 'conflicted';
}

export interface Purchase {
  id?: number;
  farmId: string;
  purchaseDate: string;
  supplier: string;
  supplierId?: number;
  productId: number;
  productName: string;
  category: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  paymentMethod: string;
  paymentStatus: 'paid' | 'credit' | 'partial';
  amountPaid: number;
  outstandingAmount: number;
  dueDate?: string;
  invoiceNumber: string;
  notes: string;
  imageData?: string;
  createdBy: string;
  createdAt: string;
  modifiedBy: string;
  updatedAt: string;
  syncDate: string;
  syncStatus: 'pending' | 'synced' | 'failed' | 'conflicted';
}

export interface Sale {
  id?: number;
  farmId: string;
  saleDate: string;
  customer: string;
  customerId?: number;
  productId: number;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discount: number;
  totalAmount: number;
  paymentMethod: string;
  invoiceNumber: string;
  notes: string;
  imageData?: string;
  createdBy: string;
  createdAt: string;
  modifiedBy: string;
  updatedAt: string;
  syncDate: string;
  syncStatus: 'pending' | 'synced' | 'failed' | 'conflicted';
}

export interface Customer {
  id?: number;
  farmId: string;
  customerId: string;
  customerCode: string;
  fullName: string;
  contactPerson: string;
  phone: string;
  alternativePhone: string;
  email: string;
  physicalAddress: string;
  state: string;
  lga: string;
  category: string;
  creditLimit: number;
  openingBalance: number;
  lastPurchaseDate: string;
  lastPaymentDate: string;
  status: 'active' | 'inactive';
  registrationDate: string;
  notes: string;
  profilePhoto?: string;
  createdBy: string;
  createdAt: string;
  modifiedBy: string;
  updatedAt: string;
  syncDate: string;
  syncStatus: 'pending' | 'synced' | 'failed' | 'conflicted';
}

export interface CustomerPayment {
  id?: number;
  farmId: string;
  paymentDate: string;
  customerId: number;
  customerName: string;
  paymentReference: string;
  invoiceNumber: string;
  amountPaid: number;
  paymentMethod: string;
  bank: string;
  cashier: string;
  status: 'completed' | 'pending' | 'failed' | 'reversed';
  receiptNumber: string;
  notes: string;
  attachment?: string;
  createdBy: string;
  createdAt: string;
  modifiedBy: string;
  updatedAt: string;
  syncDate: string;
  syncStatus: 'pending' | 'synced' | 'failed' | 'conflicted';
}

export interface Supplier {
  id?: number;
  farmId: string;
  supplierId: string;
  supplierCode: string;
  businessName: string;
  contactPerson: string;
  phone: string;
  alternativePhone: string;
  email: string;
  physicalAddress: string;
  state: string;
  lga: string;
  category: string;
  creditLimit: number;
  openingBalance: number;
  totalPurchases: number;
  totalPayments: number;
  outstandingBalance: number;
  lastPurchaseDate: string;
  lastPaymentDate: string;
  status: 'active' | 'inactive';
  registrationDate: string;
  taxIdentificationNumber: string;
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  notes: string;
  profilePhoto?: string;
  createdBy: string;
  createdAt: string;
  modifiedBy: string;
  updatedAt: string;
  syncDate: string;
  syncStatus: 'pending' | 'synced' | 'failed' | 'conflicted';
}

export interface SupplierPayment {
  id?: number;
  farmId: string;
  paymentDate: string;
  supplierId: number;
  supplierName: string;
  purchaseId?: number;
  paymentReference: string;
  amountPaid: number;
  paymentMethod: string;
  bank: string;
  staff: string;
  status: 'completed' | 'pending' | 'failed' | 'reversed';
  receiptNumber: string;
  notes: string;
  attachment?: string;
  createdBy: string;
  createdAt: string;
  modifiedBy: string;
  updatedAt: string;
  syncDate: string;
  syncStatus: 'pending' | 'synced' | 'failed' | 'conflicted';
}

export interface SupplierAdjustment {
  id?: number;
  farmId: string;
  adjustmentDate: string;
  supplierId: number;
  supplierName: string;
  adjustmentType: 'credit_note' | 'debit_note' | 'refund' | 'return' | 'adjustment';
  amount: number;
  referenceNumber: string;
  description: string;
  relatedPurchaseId?: number;
  createdBy: string;
  createdAt: string;
  modifiedBy: string;
  updatedAt: string;
  syncDate: string;
  syncStatus: 'pending' | 'synced' | 'failed' | 'conflicted';
}

export interface SyncQueue {
  id?: number;
  farmId: string;
  collection: string;
  recordId: number;
  operation: 'create' | 'update' | 'delete';
  data: unknown;
  createdAt: string;
  retries: number;
  status: 'pending' | 'processing' | 'failed';
}

// ==================== SETTINGS MODULE TYPES ====================

export interface Setting {
  id?: number;
  farmId: string;
  key: string;
  value: string;
  category: string;
  updatedAt: string;
}

export interface Bank {
  id?: number;
  farmId: string;
  bankName: string;
  shortName: string;
  bankCode: string;
  sortOrder: number;
  status: 'active' | 'inactive';
  notes: string;
  createdAt: string;
  updatedAt: string;
  syncStatus: 'pending' | 'synced' | 'failed' | 'conflicted';
}

export interface PaymentMethodRecord {
  id?: number;
  farmId: string;
  methodName: string;
  description: string;
  sortOrder: number;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
  syncStatus: 'pending' | 'synced' | 'failed' | 'conflicted';
}

export interface ProductCategoryRecord {
  id?: number;
  farmId: string;
  categoryName: string;
  description: string;
  sortOrder: number;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
  syncStatus: 'pending' | 'synced' | 'failed' | 'conflicted';
}

export interface UnitRecord {
  id?: number;
  farmId: string;
  unitName: string;
  abbreviation: string;
  category: string;
  sortOrder: number;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
  syncStatus: 'pending' | 'synced' | 'failed' | 'conflicted';
}

export interface NumberSequence {
  id?: number;
  farmId: string;
  transactionType: 'sale' | 'purchase' | 'receipt' | 'customer_receipt' | 'supplier_receipt';
  prefix: string;
  nextNumber: number;
  format: string;
  updatedAt: string;
}

// ==================== HEADER/DETAIL INVOICE TYPES ====================

export interface SalesHeader {
  id?: number;
  farmId: string;
  invoiceNumber: string;
  customerId: number;
  customerName: string;
  invoiceDate: string;
  dueDate: string;
  paymentMethod: string;
  salesPerson: string;
  status: 'draft' | 'posted' | 'cancelled' | 'voided';
  subtotal: number;
  discountAmount: number;
  discountPercent: number;
  taxAmount: number;
  grandTotal: number;
  amountPaid: number;
  balanceDue: number;
  notes: string;
  createdBy: string;
  createdAt: string;
  modifiedBy: string;
  updatedAt: string;
  syncDate: string;
  syncStatus: 'pending' | 'synced' | 'failed' | 'conflicted';
}

export interface SalesDetail {
  id?: number;
  farmId: string;
  headerId: number;
  productId: number;
  productName: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discount: number;
  taxRate: number;
  lineTotal: number;
  createdAt: string;
  updatedAt: string;
  syncStatus: 'pending' | 'synced' | 'failed' | 'conflicted';
}

export interface PurchaseHeader {
  id?: number;
  farmId: string;
  purchaseNumber: string;
  supplierId: number;
  supplierName: string;
  purchaseDate: string;
  dueDate: string;
  paymentMethod: string;
  status: 'draft' | 'posted' | 'cancelled' | 'voided';
  subtotal: number;
  discountAmount: number;
  discountPercent: number;
  taxAmount: number;
  grandTotal: number;
  amountPaid: number;
  balanceDue: number;
  notes: string;
  createdBy: string;
  createdAt: string;
  modifiedBy: string;
  updatedAt: string;
  syncDate: string;
  syncStatus: 'pending' | 'synced' | 'failed' | 'conflicted';
}

export interface PurchaseDetail {
  id?: number;
  farmId: string;
  headerId: number;
  productId: number;
  productName: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discount: number;
  taxRate: number;
  lineTotal: number;
  createdAt: string;
  updatedAt: string;
  syncStatus: 'pending' | 'synced' | 'failed' | 'conflicted';
}

// ==================== IMPORT/EXPORT TYPES ====================

export type ImportModule =
  | 'customers' | 'suppliers' | 'products' | 'batches'
  | 'product_categories' | 'banks' | 'units' | 'payment_methods'
  | 'daily_reports' | 'opening_stock' | 'stock_adjustments'
  | 'sales' | 'purchases' | 'customer_payments' | 'supplier_payments';

export interface ImportTemplate {
  module: ImportModule;
  label: string;
  icon: string;
  headers: ImportTemplateColumn[];
}

export interface ImportTemplateColumn {
  field: string;
  label: string;
  required: boolean;
  type: 'string' | 'number' | 'date' | 'email' | 'phone' | 'select';
  options?: string[];
  sampleValue: string;
  notes?: string;
}

export interface ValidationError {
  row: number;
  column: string;
  value: string;
  error: string;
  suggestion: string;
}

export interface ImportResult {
  totalRows: number;
  successful: number;
  updated: number;
  failed: number;
  skipped: number;
  duplicates: number;
  errors: ValidationError[];
  processingTimeMs: number;
}

// ==================== CONSTANTS ====================

export const BIRD_TYPES = ['Broiler', 'Layer', 'Turkey', 'Duck', 'Guinea Fowl', 'Quail'];
export const PRODUCTION_STAGES = ['Chick', 'Grower', 'Finisher', 'Point of Lay', 'Laying', 'Depleted'];
export const MORTALITY_REASONS = [
  'Heat Stress', 'Newcastle Disease', 'Coccidiosis', 'Gumboro',
  'Fowl Pox', "Marek's Disease", 'Salmonellosis', 'Brooder Suffocation',
  'Predator Attack', 'Cannibalism', 'Feed Poisoning', 'Water Deprivation',
  'Injury', 'Unknown', 'Others'
];
export const FEED_TYPES = ['Starter', 'Grower', 'Finisher', 'Layer Mash', 'Concentrate', 'Others'];
export const FEED_SESSIONS = ['Morning', 'Afternoon', 'Evening', 'Ad Libitum'];
export const MEDICATION_CATEGORIES = ['Vaccine', 'Antibiotic', 'Vitamin', 'Supplement', 'Dewormer', 'Disinfectant', 'Other'];
export const ADMINISTRATION_METHODS = ['Oral', 'Injection (IM)', 'Injection (SC)', 'Drinking Water', 'Spray', 'Topical', 'Other'];
export const WEATHER_CONDITIONS = ['Sunny', 'Cloudy', 'Rainy', 'Harmattan', 'Overcast', 'Windy'];
export const VENTILATION_STATUSES = ['Natural', 'Fan Assisted', 'Tunnel', 'Open', 'Closed'];
export const FEED_UNIT_OPTIONS = ['kg', 'bags'];
export const PRODUCT_CATEGORIES = ['Eggs', 'Birds', 'Feed', 'Medication', 'Equipment', 'Produce', 'Other'];
export const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'POS', 'Mobile Money', 'Cheque', 'Credit', 'Other'];
export const UNIT_OPTIONS = ['kg', 'g', 'mg', 'L', 'mL', 'pieces', 'bags', 'crates', 'bottles', 'packs'];
export const CUSTOMER_CATEGORIES = ['Retail', 'Wholesale', 'Distributor', 'Farm', 'Hotel', 'Restaurant', 'Supermarket', 'Market Trader', 'School', 'Hospital', 'Other'];
export const CUSTOMER_STATUSES = ['Active', 'Inactive'];
export const PAYMENT_STATUSES = ['Completed', 'Pending', 'Failed', 'Reversed'];
export const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe', 'Imo',
  'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nassarawa',
  'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara'
];
export const SUPPLIER_CATEGORIES = [
  'Feed Supplier', 'Chick Supplier', 'Veterinary Supplier', 'Equipment Supplier',
  'Drug Supplier', 'Packaging Supplier', 'Crop Input Supplier', 'Fuel Supplier',
  'Transport Supplier', 'General Supplier', 'Other'
];
export const SUPPLIER_STATUSES = ['Active', 'Inactive'];
export const PAYMENT_STATUSES_LIST = ['Completed', 'Pending', 'Failed', 'Reversed'];
export const SUPPLIER_ADJUSTMENT_TYPES = ['Credit Note', 'Debit Note', 'Refund', 'Return', 'Adjustment'];
export const PAYMENT_STATUS_OPTIONS = ['Paid', 'Credit', 'Partial'];
export const FARM_TYPES = ['Poultry', 'Mixed', 'Layer', 'Broiler', 'Breeder', 'Other'];

// ==================== AUTHENTICATION TYPES ====================

export interface AuthUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  providerId: string;
  emailVerified: boolean;
}

// ==================== FARM MEMBERSHIP TYPES ====================

export type MembershipStatus = 'pending' | 'active' | 'suspended' | 'rejected' | 'removed';
export type InvitationStatus = 'none' | 'pending' | 'accepted' | 'expired';

export interface FarmMembership {
  id?: number;
  membershipId: string;
  farmId: string;
  farmName: string;
  userEmail: string;
  firebaseUid: string;
  userName: string;
  userPhoto: string;
  role: FarmRole;
  status: MembershipStatus;
  invitationStatus: InvitationStatus;
  joinedDate: string;
  lastAccessedDate: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  rejectionReason?: string;
  requestMessage?: string;
}

// ==================== ROLE & PERMISSION TYPES ====================

export type FarmRole =
  | 'owner' | 'admin' | 'farm_manager' | 'accountant'
  | 'inventory_officer' | 'sales_officer' | 'poultry_supervisor'
  | 'farm_staff' | 'viewer';

export const FARM_ROLE_LABELS: Record<FarmRole, string> = {
  owner: 'Owner', admin: 'Farm Administrator', farm_manager: 'Farm Manager',
  accountant: 'Accountant', inventory_officer: 'Inventory Officer',
  sales_officer: 'Sales Officer', poultry_supervisor: 'Poultry Supervisor',
  farm_staff: 'Farm Staff', viewer: 'Viewer / Auditor',
};

export type Permission =
  | 'dashboard:view'
  | 'batches:view' | 'batches:create' | 'batches:edit' | 'batches:delete'
  | 'daily_reports:view' | 'daily_reports:create' | 'daily_reports:edit' | 'daily_reports:delete'
  | 'products:view' | 'products:create' | 'products:edit' | 'products:delete'
  | 'purchases:view' | 'purchases:create' | 'purchases:edit' | 'purchases:delete'
  | 'sales:view' | 'sales:create' | 'sales:edit' | 'sales:delete'
  | 'inventory:view' | 'inventory:create' | 'inventory:edit' | 'inventory:delete'
  | 'customers:view' | 'customers:create' | 'customers:edit' | 'customers:delete'
  | 'customer_payments:view' | 'customer_payments:create' | 'customer_payments:edit' | 'customer_payments:delete'
  | 'suppliers:view' | 'suppliers:create' | 'suppliers:edit' | 'suppliers:delete'
  | 'supplier_payments:view' | 'supplier_payments:create' | 'supplier_payments:edit' | 'supplier_payments:delete'
  | 'reports:view' | 'reports:export'
  | 'settings:view' | 'settings:edit'
  | 'members:view' | 'members:invite' | 'members:edit' | 'members:remove'
  | 'import_export:view' | 'import_export:execute'
  | 'farm_management:view' | 'farm_management:edit';

const ALL_PERMISSIONS: Permission[] = [
  'dashboard:view',
  'batches:view', 'batches:create', 'batches:edit', 'batches:delete',
  'daily_reports:view', 'daily_reports:create', 'daily_reports:edit', 'daily_reports:delete',
  'products:view', 'products:create', 'products:edit', 'products:delete',
  'purchases:view', 'purchases:create', 'purchases:edit', 'purchases:delete',
  'sales:view', 'sales:create', 'sales:edit', 'sales:delete',
  'inventory:view', 'inventory:create', 'inventory:edit', 'inventory:delete',
  'customers:view', 'customers:create', 'customers:edit', 'customers:delete',
  'customer_payments:view', 'customer_payments:create', 'customer_payments:edit', 'customer_payments:delete',
  'suppliers:view', 'suppliers:create', 'suppliers:edit', 'suppliers:delete',
  'supplier_payments:view', 'supplier_payments:create', 'supplier_payments:edit', 'supplier_payments:delete',
  'reports:view', 'reports:export',
  'settings:view', 'settings:edit',
  'members:view', 'members:invite', 'members:edit', 'members:remove',
  'import_export:view', 'import_export:execute',
  'farm_management:view', 'farm_management:edit',
];

export const ROLE_PERMISSIONS: Record<FarmRole, Permission[]> = {
  owner: [...ALL_PERMISSIONS],
  admin: [...ALL_PERMISSIONS.filter(p => !p.includes('farm_management:edit'))],
  farm_manager: [
    'dashboard:view',
    'batches:view', 'batches:create', 'batches:edit',
    'daily_reports:view', 'daily_reports:create', 'daily_reports:edit',
    'products:view', 'products:create', 'products:edit',
    'inventory:view', 'inventory:edit',
    'purchases:view', 'purchases:create',
    'sales:view', 'sales:create',
    'customers:view',
    'suppliers:view',
    'reports:view',
    'import_export:view',
  ],
  accountant: [
    'dashboard:view',
    'sales:view', 'sales:create', 'sales:edit',
    'purchases:view', 'purchases:create', 'purchases:edit',
    'customers:view', 'customers:create', 'customers:edit',
    'customer_payments:view', 'customer_payments:create', 'customer_payments:edit',
    'suppliers:view', 'suppliers:create', 'suppliers:edit',
    'supplier_payments:view', 'supplier_payments:create', 'supplier_payments:edit',
    'reports:view', 'reports:export',
  ],
  inventory_officer: [
    'dashboard:view',
    'products:view', 'products:create', 'products:edit',
    'inventory:view', 'inventory:create', 'inventory:edit',
    'purchases:view', 'purchases:create',
    'reports:view',
    'import_export:view', 'import_export:execute',
  ],
  sales_officer: [
    'dashboard:view',
    'customers:view', 'customers:create', 'customers:edit',
    'sales:view', 'sales:create', 'sales:edit',
    'customer_payments:view', 'customer_payments:create',
    'reports:view',
  ],
  poultry_supervisor: [
    'dashboard:view',
    'batches:view', 'batches:create', 'batches:edit',
    'daily_reports:view', 'daily_reports:create', 'daily_reports:edit',
    'products:view',
    'reports:view',
  ],
  farm_staff: [
    'dashboard:view',
    'batches:view',
    'daily_reports:view', 'daily_reports:create',
    'products:view',
    'customers:view',
  ],
  viewer: [
    'dashboard:view',
    'batches:view', 'daily_reports:view', 'products:view',
    'purchases:view', 'sales:view', 'inventory:view',
    'customers:view', 'suppliers:view',
    'customer_payments:view', 'supplier_payments:view',
    'reports:view',
  ],
};

// ==================== NOTIFICATION TYPES ====================

export type NotificationType = 'membership_request' | 'membership_approved' | 'membership_rejected' | 'system';

export interface Notification {
  id?: number;
  farmId: string;
  type: NotificationType;
  title: string;
  message: string;
  targetEmail: string;
  fromUser: string;
  fromEmail: string;
  read: boolean;
  actionUrl?: string;
  metadata?: string;
  createdAt: string;
}
