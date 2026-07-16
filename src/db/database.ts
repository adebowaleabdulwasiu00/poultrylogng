import Dexie, { type Table } from 'dexie';
import type {
  Farm, ImportLog, Batch, DailyReport, Product, Purchase, Sale, SyncQueue, Attachment, Customer, CustomerPayment,
  Supplier, SupplierPayment, SupplierAdjustment, Setting, Bank, PaymentMethodRecord,
  ProductCategoryRecord, UnitRecord, NumberSequence, SalesHeader, SalesDetail,
  PurchaseHeader, PurchaseDetail, FarmMembership, Notification
} from './types';

const DEFAULT_FARM_ID = 'default-farm';

class FarmDatabase extends Dexie {
  farms!: Table<Farm, number>;
  importLogs!: Table<ImportLog, number>;
  batches!: Table<Batch, number>;
  dailyReports!: Table<DailyReport, number>;
  products!: Table<Product, number>;
  purchases!: Table<Purchase, number>;
  sales!: Table<Sale, number>;
  attachments!: Table<Attachment, number>;
  syncQueue!: Table<SyncQueue, number>;
  customers!: Table<Customer, number>;
  customerPayments!: Table<CustomerPayment, number>;
  suppliers!: Table<Supplier, number>;
  supplierPayments!: Table<SupplierPayment, number>;
  supplierAdjustments!: Table<SupplierAdjustment, number>;
  settings!: Table<Setting, number>;
  banks!: Table<Bank, number>;
  paymentMethods!: Table<PaymentMethodRecord, number>;
  productCategories!: Table<ProductCategoryRecord, number>;
  units!: Table<UnitRecord, number>;
  numberSequences!: Table<NumberSequence, number>;
  salesHeaders!: Table<SalesHeader, number>;
  salesDetails!: Table<SalesDetail, number>;
  purchaseHeaders!: Table<PurchaseHeader, number>;
  purchaseDetails!: Table<PurchaseDetail, number>;
  memberships!: Table<FarmMembership, number>;
  notifications!: Table<Notification, number>;

  constructor() {
    super('PoultryLogNG');
    this.version(4).stores({
      batches: '++id, batchId, batchName, status, birdType, house, syncStatus',
      dailyReports: '++id, reportDate, batchId, batchName, syncStatus, [reportDate+batchId]',
      products: '++id, productId, productName, category, status, syncStatus',
      purchases: '++id, purchaseDate, supplier, supplierId, productId, productName, category, paymentStatus, syncStatus',
      sales: '++id, saleDate, customer, customerId, productId, productName, syncStatus',
      attachments: '++id, reportId',
      syncQueue: '++id, collection, recordId, status',
      customers: '++id, customerId, customerCode, fullName, phone, email, category, status, syncStatus',
      customerPayments: '++id, paymentDate, customerId, customerName, paymentMethod, status, syncStatus',
      suppliers: '++id, supplierId, supplierCode, businessName, phone, email, category, status, syncStatus',
      supplierPayments: '++id, paymentDate, supplierId, supplierName, paymentMethod, status, syncStatus',
      supplierAdjustments: '++id, adjustmentDate, supplierId, supplierName, adjustmentType, syncStatus',
      settings: '++id, key, category, [key+category]',
      banks: '++id, bankName, status, sortOrder, syncStatus',
      paymentMethods: '++id, methodName, status, sortOrder, syncStatus',
      productCategories: '++id, categoryName, status, sortOrder, syncStatus',
      units: '++id, unitName, status, sortOrder, syncStatus',
      numberSequences: '++id, transactionType',
      salesHeaders: '++id, invoiceNumber, customerId, customerName, invoiceDate, status, syncStatus',
      salesDetails: '++id, headerId, productId, productName, syncStatus',
      purchaseHeaders: '++id, purchaseNumber, supplierId, supplierName, purchaseDate, status, syncStatus',
      purchaseDetails: '++id, headerId, productId, productName, syncStatus',
    });

    this.version(5).stores({
      farms: '++id, farmId, farmCode, farmName, status',
      importLogs: '++id, farmId, moduleName, importedAt',
      batches: '++id, farmId, batchId, batchName, status, birdType, house, syncStatus',
      dailyReports: '++id, farmId, reportDate, batchId, batchName, syncStatus, [reportDate+batchId]',
      products: '++id, farmId, productId, productName, category, status, syncStatus',
      purchases: '++id, farmId, purchaseDate, supplier, supplierId, productId, productName, category, paymentStatus, syncStatus',
      sales: '++id, farmId, saleDate, customer, customerId, productId, productName, syncStatus',
      attachments: '++id, farmId, reportId',
      syncQueue: '++id, farmId, collection, recordId, status',
      customers: '++id, farmId, customerId, customerCode, fullName, phone, email, category, status, syncStatus',
      customerPayments: '++id, farmId, paymentDate, customerId, customerName, paymentMethod, status, syncStatus',
      suppliers: '++id, farmId, supplierId, supplierCode, businessName, phone, email, category, status, syncStatus',
      supplierPayments: '++id, farmId, paymentDate, supplierId, supplierName, paymentMethod, status, syncStatus',
      supplierAdjustments: '++id, farmId, adjustmentDate, supplierId, supplierName, adjustmentType, syncStatus',
      settings: '++id, farmId, key, category, [farmId+key+category]',
      banks: '++id, farmId, bankName, status, sortOrder, syncStatus',
      paymentMethods: '++id, farmId, methodName, status, sortOrder, syncStatus',
      productCategories: '++id, farmId, categoryName, status, sortOrder, syncStatus',
      units: '++id, farmId, unitName, status, sortOrder, syncStatus',
      numberSequences: '++id, farmId, transactionType',
      salesHeaders: '++id, farmId, invoiceNumber, customerId, customerName, invoiceDate, status, syncStatus',
      salesDetails: '++id, farmId, headerId, productId, productName, syncStatus',
      purchaseHeaders: '++id, farmId, purchaseNumber, supplierId, supplierName, purchaseDate, status, syncStatus',
      purchaseDetails: '++id, farmId, headerId, productId, productName, syncStatus',
    });

    this.version(6).stores({
      memberships: '++id, membershipId, farmId, userEmail, firebaseUid, status, [farmId+userEmail], [userEmail+status]',
      notifications: '++id, farmId, type, targetEmail, read, [farmId+targetEmail], [targetEmail+read]',
    });
  }
}

export const db = new FarmDatabase();

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

export function nowISO(): string {
  return new Date().toISOString();
}

export { DEFAULT_FARM_ID };

// ==================== FARM HELPERS ====================

export async function getActiveFarmId(): Promise<string> {
  const active = localStorage.getItem('activeFarmId');
  if (active) return active;
  const firstFarm = await db.farms.where('status').equals('active').first();
  if (firstFarm) {
    localStorage.setItem('activeFarmId', firstFarm.farmId);
    return firstFarm.farmId;
  }
  return DEFAULT_FARM_ID;
}

export async function setActiveFarmId(farmId: string): Promise<void> {
  localStorage.setItem('activeFarmId', farmId);
}

export async function getActiveFarm(): Promise<Farm | undefined> {
  const farmId = await getActiveFarmId();
  return db.farms.where('farmId').equals(farmId).first();
}

// ==================== SETTINGS HELPERS ====================

export async function getSetting(key: string, defaultValue = '', farmId?: string): Promise<string> {
  const fid = farmId || await getActiveFarmId();
  const record = await db.settings.where('[farmId+key+category]').equals([fid, key, '']).first()
    || await db.settings.where({ farmId: fid, key }).first();
  return record?.value ?? defaultValue;
}

export async function getSettingsByCategory(category: string, farmId?: string): Promise<Record<string, string>> {
  const fid = farmId || await getActiveFarmId();
  const records = await db.settings.where({ farmId: fid, category }).toArray();
  const result: Record<string, string> = {};
  for (const r of records) result[r.key] = r.value;
  return result;
}

export async function setSetting(key: string, value: string, category: string, farmId?: string): Promise<void> {
  const fid = farmId || await getActiveFarmId();
  const existing = await db.settings.where({ farmId: fid, key }).first();
  const now = nowISO();
  if (existing?.id) {
    await db.settings.update(existing.id, { value, updatedAt: now });
  } else {
    await db.settings.add({ farmId: fid, key, value, category, updatedAt: now });
  }
}

export async function setSettingsBulk(entries: { key: string; value: string; category: string }[], farmId?: string): Promise<void> {
  const fid = farmId || await getActiveFarmId();
  const now = nowISO();
  for (const entry of entries) {
    const existing = await db.settings.where({ farmId: fid, key: entry.key }).first();
    if (existing?.id) {
      await db.settings.update(existing.id, { value: entry.value, updatedAt: now });
    } else {
      await db.settings.add({ farmId: fid, key: entry.key, value: entry.value, category: entry.category, updatedAt: now });
    }
  }
}

// ==================== NUMBERING ====================

export async function getNextNumber(type: NumberSequence['transactionType'], farmId?: string): Promise<string> {
  const fid = farmId || await getActiveFarmId();
  const seq = await db.numberSequences.where({ farmId: fid, transactionType: type }).first();
  if (!seq?.id) {
    const prefixMap: Record<string, string> = {
      sale: 'INV', purchase: 'PUR', receipt: 'RCP',
      customer_receipt: 'CRCP', supplier_receipt: 'SRCP'
    };
    const num = 1;
    const year = new Date().getFullYear();
    const formatted = `${prefixMap[type]}-${year}-${String(num).padStart(6, '0')}`;
    await db.numberSequences.add({
      farmId: fid, transactionType: type, prefix: prefixMap[type], nextNumber: 2,
      format: `${prefixMap[type]}-${year}-{seq}`, updatedAt: nowISO()
    });
    return formatted;
  }
  const year = new Date().getFullYear();
  const num = seq.nextNumber;
  const formatted = `${seq.prefix}-${year}-${String(num).padStart(6, '0')}`;
  await db.numberSequences.update(seq.id, { nextNumber: num + 1, updatedAt: nowISO() });
  return formatted;
}

// ==================== DATA MIGRATION (v4 -> v5) ====================

export async function migrateDataIfNeeded(): Promise<void> {
  const migratedV4 = await getSetting('_schema_migrated_v4', '', DEFAULT_FARM_ID);
  if (migratedV4 !== 'true') {
    await runV4Migration();
  }

  const migratedV5 = await getSetting('_schema_migrated_v5', '', DEFAULT_FARM_ID);
  if (migratedV5 === 'true') return;
  await runV5Migration();
}

async function runV4Migration(): Promise<void> {
  const now = nowISO();

  // Seed default settings
  const defaultSettings = [
    { key: 'farm_name', value: 'My Poultry Farm', category: 'company' },
    { key: 'business_name', value: 'PoultryLog NG', category: 'company' },
    { key: 'address', value: '', category: 'company' },
    { key: 'phone_numbers', value: '', category: 'company' },
    { key: 'email', value: '', category: 'company' },
    { key: 'website', value: '', category: 'company' },
    { key: 'tax_id', value: '', category: 'company' },
    { key: 'registration_number', value: '', category: 'company' },
    { key: 'currency', value: 'NGN', category: 'company' },
    { key: 'currency_symbol', value: '\u20a6', category: 'company' },
    { key: 'timezone', value: 'Africa/Lagos', category: 'company' },
    { key: 'country', value: 'Nigeria', category: 'company' },
    { key: 'state', value: '', category: 'company' },
    { key: 'logo', value: '', category: 'company' },
    { key: 'sale_prefix', value: 'INV', category: 'numbering' },
    { key: 'purchase_prefix', value: 'PUR', category: 'numbering' },
    { key: 'receipt_prefix', value: 'RCP', category: 'numbering' },
    { key: 'prevent_negative_stock', value: 'true', category: 'sales' },
    { key: 'default_payment_terms', value: '30', category: 'sales' },
    { key: 'default_purchase_terms', value: '30', category: 'purchase' },
  ];
  await setSettingsBulk(defaultSettings, DEFAULT_FARM_ID);

  const defaultBanks = [
    { bankName: 'Access Bank', shortName: 'Access', bankCode: '044', sortOrder: 1, status: 'active' as const, notes: '' },
    { bankName: 'First Bank of Nigeria', shortName: 'FirstBank', bankCode: '011', sortOrder: 2, status: 'active' as const, notes: '' },
    { bankName: 'Guaranty Trust Bank', shortName: 'GTBank', bankCode: '058', sortOrder: 3, status: 'active' as const, notes: '' },
    { bankName: 'United Bank for Africa', shortName: 'UBA', bankCode: '033', sortOrder: 4, status: 'active' as const, notes: '' },
    { bankName: 'Zenith Bank', shortName: 'Zenith', bankCode: '057', sortOrder: 5, status: 'active' as const, notes: '' },
    { bankName: 'Stanbic IBTC Bank', shortName: 'Stanbic', bankCode: '221', sortOrder: 6, status: 'active' as const, notes: '' },
    { bankName: 'Fidelity Bank', shortName: 'Fidelity', bankCode: '070', sortOrder: 7, status: 'active' as const, notes: '' },
    { bankName: 'Wema Bank', shortName: 'Wema', bankCode: '035', sortOrder: 8, status: 'active' as const, notes: '' },
    { bankName: 'Opay', shortName: 'Opay', bankCode: '999', sortOrder: 9, status: 'active' as const, notes: '' },
    { bankName: 'PalmPay', shortName: 'PalmPay', bankCode: '998', sortOrder: 10, status: 'active' as const, notes: '' },
  ];
  for (const bank of defaultBanks) {
    await db.banks.add({ ...bank, farmId: DEFAULT_FARM_ID, createdAt: now, updatedAt: now, syncStatus: 'synced' });
  }

  const defaultMethods = [
    { methodName: 'Cash', description: 'Physical cash payment', sortOrder: 1, status: 'active' as const },
    { methodName: 'Bank Transfer', description: 'Direct bank transfer', sortOrder: 2, status: 'active' as const },
    { methodName: 'POS', description: 'Point of Sale terminal', sortOrder: 3, status: 'active' as const },
    { methodName: 'Mobile Money', description: 'Mobile money transfer', sortOrder: 4, status: 'active' as const },
    { methodName: 'Cheque', description: 'Bank cheque', sortOrder: 5, status: 'active' as const },
    { methodName: 'Credit', description: 'Buy now, pay later', sortOrder: 6, status: 'active' as const },
    { methodName: 'Wallet', description: 'Digital wallet', sortOrder: 7, status: 'active' as const },
    { methodName: 'Other', description: 'Other payment methods', sortOrder: 8, status: 'active' as const },
  ];
  for (const m of defaultMethods) {
    await db.paymentMethods.add({ ...m, farmId: DEFAULT_FARM_ID, createdAt: now, updatedAt: now, syncStatus: 'synced' });
  }

  const defaultCategories = [
    { categoryName: 'Eggs', description: 'All egg products', sortOrder: 1, status: 'active' as const },
    { categoryName: 'Poultry', description: 'Live birds and dressed', sortOrder: 2, status: 'active' as const },
    { categoryName: 'Feed', description: 'Poultry feed', sortOrder: 3, status: 'active' as const },
    { categoryName: 'Drugs', description: 'Medications and supplements', sortOrder: 4, status: 'active' as const },
    { categoryName: 'Equipment', description: 'Farm equipment', sortOrder: 5, status: 'active' as const },
    { categoryName: 'Produce', description: 'Farm produce', sortOrder: 6, status: 'active' as const },
    { categoryName: 'Services', description: 'Service items', sortOrder: 7, status: 'active' as const },
    { categoryName: 'Other', description: 'Uncategorized items', sortOrder: 8, status: 'active' as const },
  ];
  for (const c of defaultCategories) {
    await db.productCategories.add({ ...c, farmId: DEFAULT_FARM_ID, createdAt: now, updatedAt: now, syncStatus: 'synced' });
  }

  const defaultUnits = [
    { unitName: 'Kilogram', abbreviation: 'kg', category: 'Weight', sortOrder: 1, status: 'active' as const },
    { unitName: 'Gram', abbreviation: 'g', category: 'Weight', sortOrder: 2, status: 'active' as const },
    { unitName: 'Piece', abbreviation: 'pcs', category: 'Count', sortOrder: 3, status: 'active' as const },
    { unitName: 'Crate', abbreviation: 'crate', category: 'Count', sortOrder: 4, status: 'active' as const },
    { unitName: 'Bag', abbreviation: 'bag', category: 'Volume', sortOrder: 5, status: 'active' as const },
    { unitName: 'Carton', abbreviation: 'ctn', category: 'Volume', sortOrder: 6, status: 'active' as const },
    { unitName: 'Sack', abbreviation: 'sack', category: 'Volume', sortOrder: 7, status: 'active' as const },
    { unitName: 'Litre', abbreviation: 'L', category: 'Volume', sortOrder: 8, status: 'active' as const },
    { unitName: 'Millilitre', abbreviation: 'mL', category: 'Volume', sortOrder: 9, status: 'active' as const },
    { unitName: 'Ton', abbreviation: 'ton', category: 'Weight', sortOrder: 10, status: 'active' as const },
    { unitName: 'Bottle', abbreviation: 'btl', category: 'Container', sortOrder: 11, status: 'active' as const },
    { unitName: 'Pack', abbreviation: 'pack', category: 'Container', sortOrder: 12, status: 'active' as const },
  ];
  for (const u of defaultUnits) {
    await db.units.add({ ...u, farmId: DEFAULT_FARM_ID, createdAt: now, updatedAt: now, syncStatus: 'synced' });
  }

  const year = new Date().getFullYear();
  await db.numberSequences.add({ farmId: DEFAULT_FARM_ID, transactionType: 'sale', prefix: 'INV', nextNumber: 1, format: `INV-${year}-{seq}`, updatedAt: now });
  await db.numberSequences.add({ farmId: DEFAULT_FARM_ID, transactionType: 'purchase', prefix: 'PUR', nextNumber: 1, format: `PUR-${year}-{seq}`, updatedAt: now });
  await db.numberSequences.add({ farmId: DEFAULT_FARM_ID, transactionType: 'receipt', prefix: 'RCP', nextNumber: 1, format: `RCP-${year}-{seq}`, updatedAt: now });
  await db.numberSequences.add({ farmId: DEFAULT_FARM_ID, transactionType: 'customer_receipt', prefix: 'CRCP', nextNumber: 1, format: `CRCP-${year}-{seq}`, updatedAt: now });
  await db.numberSequences.add({ farmId: DEFAULT_FARM_ID, transactionType: 'supplier_receipt', prefix: 'SRCP', nextNumber: 1, format: `SRCP-${year}-{seq}`, updatedAt: now });

  // Migrate existing sales to header/detail
  const existingSales = await db.sales.toArray();
  if (existingSales.length > 0) {
    const grouped = new Map<number, Sale[]>();
    for (const s of existingSales) {
      const key = s.customerId || 0;
      const groupKey = `${key}-${s.saleDate}-${s.invoiceNumber}`;
      const hash = parseInt(groupKey.replace(/\D/g, '').slice(0, 8) || '0', 10);
      if (!grouped.has(hash)) grouped.set(hash, []);
      grouped.get(hash)!.push(s);
    }
    let saleNum = 1;
    for (const [, group] of grouped) {
      const first = group[0];
      const headerId = await db.salesHeaders.add({
        farmId: DEFAULT_FARM_ID,
        invoiceNumber: first.invoiceNumber || `INV-MIG-${String(saleNum).padStart(4, '0')}`,
        customerId: first.customerId || 0,
        customerName: first.customer,
        invoiceDate: first.saleDate,
        dueDate: '',
        paymentMethod: first.paymentMethod,
        salesPerson: '',
        status: 'posted',
        subtotal: group.reduce((s, x) => s + x.totalAmount + x.discount, 0),
        discountAmount: group.reduce((s, x) => s + x.discount, 0),
        discountPercent: 0,
        taxAmount: 0,
        grandTotal: group.reduce((s, x) => s + x.totalAmount, 0),
        amountPaid: group.reduce((s, x) => s + x.totalAmount, 0),
        balanceDue: 0,
        notes: first.notes,
        createdBy: first.createdBy || 'system',
        createdAt: first.createdAt,
        modifiedBy: first.modifiedBy || 'system',
        updatedAt: first.updatedAt,
        syncDate: first.syncDate || '',
        syncStatus: 'synced',
      });
      for (const s of group) {
        await db.salesDetails.add({
          farmId: DEFAULT_FARM_ID, headerId,
          productId: s.productId, productName: s.productName, description: '',
          quantity: s.quantity, unit: s.unit, unitPrice: s.unitPrice,
          discount: s.discount, taxRate: 0, lineTotal: s.totalAmount,
          createdAt: s.createdAt, updatedAt: s.updatedAt, syncStatus: 'synced',
        });
      }
      saleNum++;
    }
  }

  // Migrate existing purchases to header/detail
  const existingPurchases = await db.purchases.toArray();
  if (existingPurchases.length > 0) {
    const grouped = new Map<number, Purchase[]>();
    for (const p of existingPurchases) {
      const key = p.supplierId || 0;
      const groupKey = `${key}-${p.purchaseDate}-${p.invoiceNumber}`;
      const hash = parseInt(groupKey.replace(/\D/g, '').slice(0, 8) || '0', 10);
      if (!grouped.has(hash)) grouped.set(hash, []);
      grouped.get(hash)!.push(p);
    }
    let purNum = 1;
    for (const [, group] of grouped) {
      const first = group[0];
      const headerId = await db.purchaseHeaders.add({
        farmId: DEFAULT_FARM_ID,
        purchaseNumber: first.invoiceNumber || `PUR-MIG-${String(purNum).padStart(4, '0')}`,
        supplierId: first.supplierId || 0,
        supplierName: first.supplier,
        purchaseDate: first.purchaseDate,
        dueDate: first.dueDate || '',
        paymentMethod: first.paymentMethod,
        status: 'posted',
        subtotal: group.reduce((s, x) => s + x.totalPrice, 0),
        discountAmount: 0, discountPercent: 0, taxAmount: 0,
        grandTotal: group.reduce((s, x) => s + x.totalPrice, 0),
        amountPaid: group.reduce((s, x) => s + x.amountPaid, 0),
        balanceDue: group.reduce((s, x) => s + x.outstandingAmount, 0),
        notes: first.notes,
        createdBy: first.createdBy || 'system',
        createdAt: first.createdAt,
        modifiedBy: first.modifiedBy || 'system',
        updatedAt: first.updatedAt,
        syncDate: first.syncDate || '',
        syncStatus: 'synced',
      });
      for (const p of group) {
        await db.purchaseDetails.add({
          farmId: DEFAULT_FARM_ID, headerId,
          productId: p.productId, productName: p.productName, description: '',
          quantity: p.quantity, unit: p.unit, unitPrice: p.unitPrice,
          discount: 0, taxRate: 0, lineTotal: p.totalPrice,
          createdAt: p.createdAt, updatedAt: p.updatedAt, syncStatus: 'synced',
        });
      }
      purNum++;
    }
  }

  await setSetting('_schema_migrated_v4', 'true', 'system', DEFAULT_FARM_ID);
}

async function runV5Migration(): Promise<void> {
  const now = nowISO();

  // Create default farm from existing settings
  const farmName = await getSetting('farm_name', 'My Poultry Farm', DEFAULT_FARM_ID);
  const businessName = await getSetting('business_name', 'PoultryLog NG', DEFAULT_FARM_ID);

  await db.farms.add({
    farmId: DEFAULT_FARM_ID,
    farmCode: 'FRM-0001',
    farmName,
    businessName,
    ownerName: '',
    contactPerson: '',
    phone: await getSetting('phone_numbers', '', DEFAULT_FARM_ID),
    email: await getSetting('email', '', DEFAULT_FARM_ID),
    address: await getSetting('address', '', DEFAULT_FARM_ID),
    state: await getSetting('state', '', DEFAULT_FARM_ID),
    lga: '',
    country: 'Nigeria',
    farmType: 'Poultry',
    logo: await getSetting('logo', '', DEFAULT_FARM_ID),
    subscriptionStatus: 'active',
    registrationDate: now,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    syncStatus: 'synced',
  });

  // Assign farmId to all existing records that don't have one
  const tables: Array<{ name: string; updateFn: (record: Record<string, unknown>) => Record<string, unknown> }> = [
    { name: 'batches', updateFn: r => ({ ...r, farmId: r.farmId || DEFAULT_FARM_ID }) },
    { name: 'dailyReports', updateFn: r => ({ ...r, farmId: r.farmId || DEFAULT_FARM_ID }) },
    { name: 'products', updateFn: r => ({ ...r, farmId: r.farmId || DEFAULT_FARM_ID }) },
    { name: 'purchases', updateFn: r => ({ ...r, farmId: r.farmId || DEFAULT_FARM_ID }) },
    { name: 'sales', updateFn: r => ({ ...r, farmId: r.farmId || DEFAULT_FARM_ID }) },
    { name: 'attachments', updateFn: r => ({ ...r, farmId: r.farmId || DEFAULT_FARM_ID }) },
    { name: 'syncQueue', updateFn: r => ({ ...r, farmId: r.farmId || DEFAULT_FARM_ID }) },
    { name: 'customers', updateFn: r => ({ ...r, farmId: r.farmId || DEFAULT_FARM_ID }) },
    { name: 'customerPayments', updateFn: r => ({ ...r, farmId: r.farmId || DEFAULT_FARM_ID }) },
    { name: 'suppliers', updateFn: r => ({ ...r, farmId: r.farmId || DEFAULT_FARM_ID }) },
    { name: 'supplierPayments', updateFn: r => ({ ...r, farmId: r.farmId || DEFAULT_FARM_ID }) },
    { name: 'supplierAdjustments', updateFn: r => ({ ...r, farmId: r.farmId || DEFAULT_FARM_ID }) },
    { name: 'settings', updateFn: r => ({ ...r, farmId: r.farmId || DEFAULT_FARM_ID }) },
    { name: 'banks', updateFn: r => ({ ...r, farmId: r.farmId || DEFAULT_FARM_ID }) },
    { name: 'paymentMethods', updateFn: r => ({ ...r, farmId: r.farmId || DEFAULT_FARM_ID }) },
    { name: 'productCategories', updateFn: r => ({ ...r, farmId: r.farmId || DEFAULT_FARM_ID }) },
    { name: 'units', updateFn: r => ({ ...r, farmId: r.farmId || DEFAULT_FARM_ID }) },
    { name: 'numberSequences', updateFn: r => ({ ...r, farmId: r.farmId || DEFAULT_FARM_ID }) },
    { name: 'salesHeaders', updateFn: r => ({ ...r, farmId: r.farmId || DEFAULT_FARM_ID }) },
    { name: 'salesDetails', updateFn: r => ({ ...r, farmId: r.farmId || DEFAULT_FARM_ID }) },
    { name: 'purchaseHeaders', updateFn: r => ({ ...r, farmId: r.farmId || DEFAULT_FARM_ID }) },
    { name: 'purchaseDetails', updateFn: r => ({ ...r, farmId: r.farmId || DEFAULT_FARM_ID }) },
  ];

  for (const table of tables) {
    const dexieTable = (db as unknown as Record<string, Table<Record<string, unknown>>>)[table.name];
    const all = await dexieTable.toArray();
    const missing = all.filter(r => !r.farmId);
    if (missing.length > 0) {
      const updates = missing.map(r => ({ key: r.id as number, changes: table.updateFn(r) }));
      await dexieTable.bulkUpdate(updates);
    }
  }

  // Set active farm
  localStorage.setItem('activeFarmId', DEFAULT_FARM_ID);
  await setSetting('_schema_migrated_v5', 'true', 'system', DEFAULT_FARM_ID);
}

// ==================== IMPORT LOG HELPERS ====================

export async function logImport(entry: Omit<ImportLog, 'id'>): Promise<number> {
  return db.importLogs.add(entry);
}

export async function getImportHistory(farmId?: string, limit = 50): Promise<ImportLog[]> {
  const fid = farmId || await getActiveFarmId();
  return db.importLogs.where({ farmId: fid }).reverse().sortBy('importedAt')
    .then(logs => logs.slice(0, limit));
}
