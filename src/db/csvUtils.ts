import type { ImportModule, ImportTemplate, ImportTemplateColumn, ValidationError } from './types';
import { db, getActiveFarmId } from './database';

// ==================== TEMPLATE DEFINITIONS ====================

const TEMPLATES: Record<ImportModule, ImportTemplate> = {
  customers: {
    module: 'customers', label: 'Customers', icon: 'people',
    headers: [
      { field: 'fullName', label: 'Full Name', required: true, type: 'string', sampleValue: 'John Doe', notes: 'Customer or business name' },
      { field: 'phone', label: 'Phone', required: true, type: 'phone', sampleValue: '+2348012345678', notes: 'Valid phone number' },
      { field: 'email', label: 'Email', required: false, type: 'email', sampleValue: 'john@example.com' },
      { field: 'physicalAddress', label: 'Address', required: false, type: 'string', sampleValue: '123 Lagos Street' },
      { field: 'state', label: 'State', required: false, type: 'string', sampleValue: 'Lagos' },
      { field: 'lga', label: 'LGA', required: false, type: 'string', sampleValue: 'Ikeja' },
      { field: 'category', label: 'Category', required: false, type: 'select', options: ['Retail', 'Wholesale', 'Distributor', 'Farm', 'Hotel', 'Restaurant', 'Supermarket', 'Market Trader', 'School', 'Hospital', 'Other'], sampleValue: 'Retail' },
      { field: 'creditLimit', label: 'Credit Limit', required: false, type: 'number', sampleValue: '500000' },
      { field: 'openingBalance', label: 'Opening Balance', required: false, type: 'number', sampleValue: '0' },
      { field: 'notes', label: 'Notes', required: false, type: 'string', sampleValue: '' },
    ],
  },
  suppliers: {
    module: 'suppliers', label: 'Suppliers', icon: 'local_shipping',
    headers: [
      { field: 'businessName', label: 'Business Name', required: true, type: 'string', sampleValue: 'ABC Feeds Ltd', notes: 'Supplier business name' },
      { field: 'contactPerson', label: 'Contact Person', required: false, type: 'string', sampleValue: 'Jane Smith' },
      { field: 'phone', label: 'Phone', required: true, type: 'phone', sampleValue: '+2348098765432' },
      { field: 'email', label: 'Email', required: false, type: 'email', sampleValue: 'info@abcfeeds.com' },
      { field: 'physicalAddress', label: 'Address', required: false, type: 'string', sampleValue: '45 Ogun State' },
      { field: 'state', label: 'State', required: false, type: 'string', sampleValue: 'Ogun' },
      { field: 'lga', label: 'LGA', required: false, type: 'string', sampleValue: 'Abeokuta South' },
      { field: 'category', label: 'Category', required: false, type: 'select', options: ['Feed Supplier', 'Chick Supplier', 'Veterinary Supplier', 'Equipment Supplier', 'Drug Supplier', 'Packaging Supplier', 'Crop Input Supplier', 'Fuel Supplier', 'Transport Supplier', 'General Supplier', 'Other'], sampleValue: 'Feed Supplier' },
      { field: 'creditLimit', label: 'Credit Limit', required: false, type: 'number', sampleValue: '1000000' },
      { field: 'openingBalance', label: 'Opening Balance', required: false, type: 'number', sampleValue: '0' },
      { field: 'taxIdentificationNumber', label: 'TIN', required: false, type: 'string', sampleValue: '12345678-0001' },
      { field: 'bankName', label: 'Bank Name', required: false, type: 'string', sampleValue: 'GTBank' },
      { field: 'bankAccountName', label: 'Account Name', required: false, type: 'string', sampleValue: 'ABC Feeds Ltd' },
      { field: 'bankAccountNumber', label: 'Account Number', required: false, type: 'string', sampleValue: '0123456789' },
      { field: 'notes', label: 'Notes', required: false, type: 'string', sampleValue: '' },
    ],
  },
  products: {
    module: 'products', label: 'Products', icon: 'category',
    headers: [
      { field: 'productName', label: 'Product Name', required: true, type: 'string', sampleValue: 'Table Eggs (Crate)', notes: 'Descriptive product name' },
      { field: 'category', label: 'Category', required: true, type: 'string', sampleValue: 'Eggs' },
      { field: 'unit', label: 'Unit', required: true, type: 'string', sampleValue: 'crates' },
      { field: 'currentStock', label: 'Opening Stock', required: false, type: 'number', sampleValue: '100' },
      { field: 'minimumStock', label: 'Minimum Stock', required: false, type: 'number', sampleValue: '20' },
      { field: 'sellingPrice', label: 'Selling Price (NGN)', required: false, type: 'number', sampleValue: '2500' },
      { field: 'purchasePrice', label: 'Purchase Price (NGN)', required: false, type: 'number', sampleValue: '2000' },
      { field: 'status', label: 'Status', required: false, type: 'select', options: ['active', 'inactive'], sampleValue: 'active' },
    ],
  },
  batches: {
    module: 'batches', label: 'Batches', icon: 'inventory_2',
    headers: [
      { field: 'batchName', label: 'Batch Name', required: true, type: 'string', sampleValue: 'Batch A - June 2026', notes: 'Descriptive batch name' },
      { field: 'house', label: 'House/Shed', required: false, type: 'string', sampleValue: 'House 1' },
      { field: 'birdType', label: 'Bird Type', required: true, type: 'select', options: ['Broiler', 'Layer', 'Turkey', 'Duck', 'Guinea Fowl', 'Quail'], sampleValue: 'Layer' },
      { field: 'breed', label: 'Breed', required: false, type: 'string', sampleValue: 'ISA Brown' },
      { field: 'source', label: 'Source', required: false, type: 'string', sampleValue: 'CHI Farms' },
      { field: 'supplier', label: 'Supplier', required: false, type: 'string', sampleValue: 'CHI Farms Ltd' },
      { field: 'dateReceived', label: 'Date Received', required: true, type: 'date', sampleValue: '2026-06-01' },
      { field: 'quantityReceived', label: 'Quantity Received', required: true, type: 'number', sampleValue: '5000' },
      { field: 'initialAverageWeight', label: 'Initial Avg Weight (g)', required: false, type: 'number', sampleValue: '42' },
      { field: 'productionStage', label: 'Production Stage', required: false, type: 'select', options: ['Chick', 'Grower', 'Finisher', 'Point of Lay', 'Laying', 'Depleted'], sampleValue: 'Chick' },
      { field: 'notes', label: 'Notes', required: false, type: 'string', sampleValue: '' },
    ],
  },
  product_categories: {
    module: 'product_categories', label: 'Product Categories', icon: 'category',
    headers: [
      { field: 'categoryName', label: 'Category Name', required: true, type: 'string', sampleValue: 'Eggs', notes: 'Must be unique' },
      { field: 'description', label: 'Description', required: false, type: 'string', sampleValue: 'All egg products' },
      { field: 'sortOrder', label: 'Sort Order', required: false, type: 'number', sampleValue: '1' },
    ],
  },
  banks: {
    module: 'banks', label: 'Banks', icon: 'account_balance',
    headers: [
      { field: 'bankName', label: 'Bank Name', required: true, type: 'string', sampleValue: 'Guaranty Trust Bank', notes: 'Full bank name' },
      { field: 'shortName', label: 'Short Name', required: true, type: 'string', sampleValue: 'GTBank' },
      { field: 'bankCode', label: 'Bank Code', required: false, type: 'string', sampleValue: '058' },
      { field: 'notes', label: 'Notes', required: false, type: 'string', sampleValue: '' },
    ],
  },
  units: {
    module: 'units', label: 'Units of Measurement', icon: 'straighten',
    headers: [
      { field: 'unitName', label: 'Unit Name', required: true, type: 'string', sampleValue: 'Kilogram', notes: 'Full unit name' },
      { field: 'abbreviation', label: 'Abbreviation', required: true, type: 'string', sampleValue: 'kg' },
      { field: 'category', label: 'Category', required: false, type: 'select', options: ['Weight', 'Volume', 'Count', 'Container', 'Other'], sampleValue: 'Weight' },
    ],
  },
  payment_methods: {
    module: 'payment_methods', label: 'Payment Methods', icon: 'payments',
    headers: [
      { field: 'methodName', label: 'Method Name', required: true, type: 'string', sampleValue: 'Bank Transfer', notes: 'Must be unique' },
      { field: 'description', label: 'Description', required: false, type: 'string', sampleValue: 'Direct bank transfer' },
    ],
  },
  daily_reports: {
    module: 'daily_reports', label: 'Daily Reports', icon: 'edit_note',
    headers: [
      { field: 'reportDate', label: 'Report Date', required: true, type: 'date', sampleValue: '2026-06-15' },
      { field: 'batchName', label: 'Batch Name', required: true, type: 'string', sampleValue: 'Batch A - June 2026', notes: 'Must match an existing batch' },
      { field: 'totalPieces', label: 'Total Eggs (pieces)', required: false, type: 'number', sampleValue: '4500' },
      { field: 'cracked', label: 'Cracked Eggs', required: false, type: 'number', sampleValue: '50' },
      { field: 'damaged', label: 'Damaged Eggs', required: false, type: 'number', sampleValue: '20' },
      { field: 'mortalityCount', label: 'Mortality Count', required: false, type: 'number', sampleValue: '5' },
      { field: 'mortalityReason', label: 'Mortality Reason', required: false, type: 'string', sampleValue: 'Heat Stress' },
      { field: 'feedType', label: 'Feed Type', required: false, type: 'string', sampleValue: 'Layer Mash' },
      { field: 'feedBrand', label: 'Feed Brand', required: false, type: 'string', sampleValue: 'Top Feeds' },
      { field: 'feedQuantityGrams', label: 'Feed Qty (grams)', required: false, type: 'number', sampleValue: '120000' },
      { field: 'feedSession', label: 'Feed Session', required: false, type: 'select', options: ['Morning', 'Afternoon', 'Evening', 'Ad Libitum'], sampleValue: 'Morning' },
      { field: 'averageEggWeight', label: 'Avg Egg Weight (g)', required: false, type: 'number', sampleValue: '58' },
      { field: 'averageBodyWeight', label: 'Avg Body Weight (g)', required: false, type: 'number', sampleValue: '1650' },
      { field: 'temperature', label: 'Temperature (°C)', required: false, type: 'number', sampleValue: '28' },
      { field: 'humidity', label: 'Humidity (%)', required: false, type: 'number', sampleValue: '72' },
      { field: 'notes', label: 'Notes', required: false, type: 'string', sampleValue: '' },
    ],
  },
  opening_stock: {
    module: 'opening_stock', label: 'Opening Stock', icon: 'inventory',
    headers: [
      { field: 'productName', label: 'Product Name', required: true, type: 'string', sampleValue: 'Table Eggs (Crate)', notes: 'Must match existing product' },
      { field: 'quantity', label: 'Quantity', required: true, type: 'number', sampleValue: '100' },
      { field: 'unit', label: 'Unit', required: false, type: 'string', sampleValue: 'crates' },
      { field: 'unitCost', label: 'Unit Cost (NGN)', required: false, type: 'number', sampleValue: '2000' },
      { field: 'date', label: 'Effective Date', required: false, type: 'date', sampleValue: '2026-06-01' },
      { field: 'notes', label: 'Notes', required: false, type: 'string', sampleValue: '' },
    ],
  },
  stock_adjustments: {
    module: 'stock_adjustments', label: 'Stock Adjustments', icon: 'swap_vert',
    headers: [
      { field: 'productName', label: 'Product Name', required: true, type: 'string', sampleValue: 'Table Eggs (Crate)', notes: 'Must match existing product' },
      { field: 'adjustmentType', label: 'Type', required: true, type: 'select', options: ['add', 'subtract', 'set'], sampleValue: 'add' },
      { field: 'quantity', label: 'Quantity', required: true, type: 'number', sampleValue: '10' },
      { field: 'reason', label: 'Reason', required: false, type: 'string', sampleValue: 'Stock count correction' },
      { field: 'date', label: 'Date', required: false, type: 'date', sampleValue: '2026-06-15' },
    ],
  },
  sales: {
    module: 'sales', label: 'Sales', icon: 'point_of_sale',
    headers: [
      { field: 'invoiceNumber', label: 'Invoice Number', required: false, type: 'string', sampleValue: 'INV-2026-000001', notes: 'Leave blank to auto-generate' },
      { field: 'customerName', label: 'Customer Name', required: true, type: 'string', sampleValue: 'John Doe', notes: 'Must match existing customer or leave blank' },
      { field: 'invoiceDate', label: 'Date', required: true, type: 'date', sampleValue: '2026-06-15' },
      { field: 'productName', label: 'Product Name', required: true, type: 'string', sampleValue: 'Table Eggs (Crate)', notes: 'Must match existing product' },
      { field: 'quantity', label: 'Quantity', required: true, type: 'number', sampleValue: '10' },
      { field: 'unitPrice', label: 'Unit Price (NGN)', required: true, type: 'number', sampleValue: '2500' },
      { field: 'discount', label: 'Discount (NGN)', required: false, type: 'number', sampleValue: '0' },
      { field: 'paymentMethod', label: 'Payment Method', required: false, type: 'string', sampleValue: 'Cash' },
      { field: 'amountPaid', label: 'Amount Paid (NGN)', required: false, type: 'number', sampleValue: '25000' },
      { field: 'notes', label: 'Notes', required: false, type: 'string', sampleValue: '' },
    ],
  },
  purchases: {
    module: 'purchases', label: 'Purchases', icon: 'shopping_cart',
    headers: [
      { field: 'purchaseNumber', label: 'Purchase Number', required: false, type: 'string', sampleValue: 'PUR-2026-000001', notes: 'Leave blank to auto-generate' },
      { field: 'supplierName', label: 'Supplier Name', required: true, type: 'string', sampleValue: 'ABC Feeds Ltd', notes: 'Must match existing supplier or leave blank' },
      { field: 'purchaseDate', label: 'Date', required: true, type: 'date', sampleValue: '2026-06-15' },
      { field: 'productName', label: 'Product Name', required: true, type: 'string', sampleValue: 'Layer Mash (50kg bag)', notes: 'Must match existing product' },
      { field: 'quantity', label: 'Quantity', required: true, type: 'number', sampleValue: '50' },
      { field: 'unitPrice', label: 'Unit Price (NGN)', required: true, type: 'number', sampleValue: '18000' },
      { field: 'discount', label: 'Discount (NGN)', required: false, type: 'number', sampleValue: '0' },
      { field: 'paymentMethod', label: 'Payment Method', required: false, type: 'string', sampleValue: 'Bank Transfer' },
      { field: 'amountPaid', label: 'Amount Paid (NGN)', required: false, type: 'number', sampleValue: '900000' },
      { field: 'dueDate', label: 'Due Date', required: false, type: 'date', sampleValue: '' },
      { field: 'notes', label: 'Notes', required: false, type: 'string', sampleValue: '' },
    ],
  },
  customer_payments: {
    module: 'customer_payments', label: 'Customer Payments', icon: 'payments',
    headers: [
      { field: 'customerName', label: 'Customer Name', required: true, type: 'string', sampleValue: 'John Doe', notes: 'Must match existing customer' },
      { field: 'paymentDate', label: 'Payment Date', required: true, type: 'date', sampleValue: '2026-06-15' },
      { field: 'amountPaid', label: 'Amount Paid (NGN)', required: true, type: 'number', sampleValue: '50000' },
      { field: 'paymentMethod', label: 'Payment Method', required: false, type: 'string', sampleValue: 'Cash' },
      { field: 'bank', label: 'Bank', required: false, type: 'string', sampleValue: 'GTBank' },
      { field: 'cashier', label: 'Cashier/Staff', required: false, type: 'string', sampleValue: 'Amina' },
      { field: 'invoiceNumber', label: 'Invoice Number', required: false, type: 'string', sampleValue: '' },
      { field: 'receiptNumber', label: 'Receipt Number', required: false, type: 'string', sampleValue: '', notes: 'Leave blank to auto-generate' },
      { field: 'notes', label: 'Notes', required: false, type: 'string', sampleValue: '' },
    ],
  },
  supplier_payments: {
    module: 'supplier_payments', label: 'Supplier Payments', icon: 'account_balance',
    headers: [
      { field: 'supplierName', label: 'Supplier Name', required: true, type: 'string', sampleValue: 'ABC Feeds Ltd', notes: 'Must match existing supplier' },
      { field: 'paymentDate', label: 'Payment Date', required: true, type: 'date', sampleValue: '2026-06-15' },
      { field: 'amountPaid', label: 'Amount Paid (NGN)', required: true, type: 'number', sampleValue: '500000' },
      { field: 'paymentMethod', label: 'Payment Method', required: false, type: 'string', sampleValue: 'Bank Transfer' },
      { field: 'bank', label: 'Bank', required: false, type: 'string', sampleValue: 'Access Bank' },
      { field: 'staff', label: 'Staff', required: false, type: 'string', sampleValue: 'Ibrahim' },
      { field: 'receiptNumber', label: 'Receipt Number', required: false, type: 'string', sampleValue: '', notes: 'Leave blank to auto-generate' },
      { field: 'notes', label: 'Notes', required: false, type: 'string', sampleValue: '' },
    ],
  },
};

// ==================== CSV GENERATION ====================

export function getTemplate(module: ImportModule): ImportTemplate {
  return TEMPLATES[module];
}

export function getAllTemplates(): ImportTemplate[] {
  return Object.values(TEMPLATES);
}

export function generateTemplateCSV(module: ImportModule): string {
  const template = TEMPLATES[module];
  if (!template) return '';
  const headers = template.headers.map(h => h.label);
  const sampleRow = template.headers.map(h => h.sampleValue);
  const notesRow = template.headers.map(h => h.notes || '');
  return [headers.join(','), sampleRow.join(','), notesRow.join(',')].join('\n');
}

export function downloadTemplate(module: ImportModule): void {
  const template = TEMPLATES[module];
  const csv = generateTemplateCSV(module);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${template.label.replace(/\s+/g, '_')}_Template.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ==================== CSV PARSING ====================

export function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = parseCSVLine(lines[0]);
  const rows: string[][] = [];
  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);
    if (row.some(cell => cell.trim())) rows.push(row);
  }
  return { headers, rows };
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}

export function rowsToObjects(headers: string[], rows: string[][], template: ImportTemplate): Record<string, string>[] {
  const fieldMap = template.headers.map(h => h.field);
  const labelToField: Record<string, string> = {};
  template.headers.forEach(h => { labelToField[h.label.toLowerCase()] = h.field; });

  return rows.map(row => {
    const obj: Record<string, string> = {};
    headers.forEach((header, i) => {
      const field = labelToField[header.toLowerCase()] || fieldMap[i] || header;
      obj[field] = row[i] || '';
    });
    return obj;
  });
}

// ==================== VALIDATION ENGINE ====================

export async function validateImportData(
  module: ImportModule,
  data: Record<string, string>[]
): Promise<ValidationError[]> {
  const template = TEMPLATES[module];
  const errors: ValidationError[] = [];

  const farmId = await getActiveFarmId();

  // Lookups for cross-referencing
  const existingCustomers = await db.customers.where({ farmId }).toArray();
  const existingSuppliers = await db.suppliers.where({ farmId }).toArray();
  const existingProducts = await db.products.where({ farmId }).toArray();
  const existingBatches = await db.batches.where({ farmId }).toArray();
  const existingCategories = await db.productCategories.where({ farmId }).toArray();
  const existingUnits = await db.units.where({ farmId }).toArray();
  const existingBanks = await db.banks.where({ farmId }).toArray();
  const existingMethods = await db.paymentMethods.where({ farmId }).toArray();

  data.forEach((row, index) => {
    const rowNum = index + 2; // +2 for header + 0-index

    for (const col of template.headers) {
      const value = row[col.field] || '';
      const trimmed = value.trim();

      // Required check
      if (col.required && !trimmed) {
        errors.push({ row: rowNum, column: col.label, value: '', error: 'Required field is empty', suggestion: `Provide a value for "${col.label}"` });
        continue;
      }
      if (!trimmed) continue;

      // Type validation
      switch (col.type) {
        case 'number':
          if (isNaN(Number(trimmed))) {
            errors.push({ row: rowNum, column: col.label, value: trimmed, error: 'Not a valid number', suggestion: `Enter a numeric value (e.g. ${col.sampleValue})` });
          } else if (Number(trimmed) < 0) {
            errors.push({ row: rowNum, column: col.label, value: trimmed, error: 'Value cannot be negative', suggestion: 'Enter a positive number' });
          }
          break;
        case 'email':
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
            errors.push({ row: rowNum, column: col.label, value: trimmed, error: 'Invalid email format', suggestion: 'Enter a valid email (e.g. user@example.com)' });
          }
          break;
        case 'phone':
          if (!/^[\d\s+\-()]{7,}$/.test(trimmed)) {
            errors.push({ row: rowNum, column: col.label, value: trimmed, error: 'Invalid phone number', suggestion: 'Enter a valid phone number (e.g. +2348012345678)' });
          }
          break;
        case 'date':
          if (isNaN(Date.parse(trimmed))) {
            errors.push({ row: rowNum, column: col.label, value: trimmed, error: 'Invalid date format', suggestion: 'Use YYYY-MM-DD format (e.g. 2026-06-15)' });
          }
          break;
        case 'select':
          if (col.options && !col.options.map(o => o.toLowerCase()).includes(trimmed.toLowerCase())) {
            errors.push({ row: rowNum, column: col.label, value: trimmed, error: `Invalid option`, suggestion: `Use one of: ${col.options.join(', ')}` });
          }
          break;
      }
    }

    // Cross-reference validations per module
    if (module === 'customers') {
      if (row.phone && existingCustomers.some(c => c.phone === row.phone.trim() && (!row.fullName || c.fullName !== row.fullName.trim()))) {
        // Just a warning-like error, not blocking
      }
    }
    if (module === 'suppliers') {
      if (row.businessName && existingSuppliers.some(s => s.businessName.toLowerCase() === row.businessName.trim().toLowerCase())) {
        errors.push({ row: rowNum, column: 'Business Name', value: row.businessName, error: 'Supplier already exists', suggestion: 'This supplier will be skipped on import (duplicate)' });
      }
    }
    if (module === 'products') {
      if (row.productName && existingProducts.some(p => p.productName.toLowerCase() === row.productName.trim().toLowerCase())) {
        errors.push({ row: rowNum, column: 'Product Name', value: row.productName, error: 'Product already exists', suggestion: 'This product will be skipped on import (duplicate)' });
      }
    }
    if (module === 'daily_reports') {
      if (row.batchName && !existingBatches.some(b => b.batchName.toLowerCase() === row.batchName.trim().toLowerCase())) {
        errors.push({ row: rowNum, column: 'Batch Name', value: row.batchName, error: 'Batch not found', suggestion: 'Create this batch first, or check the spelling' });
      }
    }
    if (module === 'opening_stock' || module === 'stock_adjustments') {
      if (row.productName && !existingProducts.some(p => p.productName.toLowerCase() === row.productName.trim().toLowerCase())) {
        errors.push({ row: rowNum, column: 'Product Name', value: row.productName, error: 'Product not found', suggestion: 'Create this product first' });
      }
    }
    if (module === 'sales') {
      if (row.customerName && !existingCustomers.some(c => c.fullName.toLowerCase() === row.customerName.trim().toLowerCase())) {
        errors.push({ row: rowNum, column: 'Customer Name', value: row.customerName, error: 'Customer not found', suggestion: 'Create this customer first' });
      }
      if (row.productName && !existingProducts.some(p => p.productName.toLowerCase() === row.productName.trim().toLowerCase())) {
        errors.push({ row: rowNum, column: 'Product Name', value: row.productName, error: 'Product not found', suggestion: 'Create this product first' });
      }
    }
    if (module === 'purchases') {
      if (row.supplierName && !existingSuppliers.some(s => s.businessName.toLowerCase() === row.supplierName.trim().toLowerCase())) {
        errors.push({ row: rowNum, column: 'Supplier Name', value: row.supplierName, error: 'Supplier not found', suggestion: 'Create this supplier first' });
      }
      if (row.productName && !existingProducts.some(p => p.productName.toLowerCase() === row.productName.trim().toLowerCase())) {
        errors.push({ row: rowNum, column: 'Product Name', value: row.productName, error: 'Product not found', suggestion: 'Create this product first' });
      }
    }
    if (module === 'customer_payments') {
      if (row.customerName && !existingCustomers.some(c => c.fullName.toLowerCase() === row.customerName.trim().toLowerCase())) {
        errors.push({ row: rowNum, column: 'Customer Name', value: row.customerName, error: 'Customer not found', suggestion: 'Create this customer first' });
      }
    }
    if (module === 'supplier_payments') {
      if (row.supplierName && !existingSuppliers.some(s => s.businessName.toLowerCase() === row.supplierName.trim().toLowerCase())) {
        errors.push({ row: rowNum, column: 'Supplier Name', value: row.supplierName, error: 'Supplier not found', suggestion: 'Create this supplier first' });
      }
    }
  });

  return errors;
}

// ==================== EXPORT ENGINE ====================

export async function exportModuleToCSV(module: ImportModule, farmId?: string): Promise<void> {
  const fid = farmId || await getActiveFarmId();
  const template = TEMPLATES[module];
  if (!template) return;

  const data = await fetchModuleData(module, fid);
  const headers = template.headers.map(h => h.label);
  const fieldToLabel: Record<string, string> = {};
  template.headers.forEach(h => { fieldToLabel[h.field] = h.label; });

  const csvLines = [headers.join(',')];
  for (const row of data) {
    const csvRow = template.headers.map(h => {
      const val = String(row[h.field] ?? '');
      return val.includes(',') || val.includes('"') || val.includes('\n')
        ? `"${val.replace(/"/g, '""')}"` : val;
    });
    csvLines.push(csvRow.join(','));
  }

  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${template.label.replace(/\s+/g, '_')}_Export_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

async function fetchModuleData(module: ImportModule, farmId: string): Promise<Record<string, string>[]> {
  switch (module) {
    case 'customers': {
      const rows = await db.customers.where({ farmId }).toArray();
      return rows.map(r => ({
        fullName: r.fullName, phone: r.phone, email: r.email,
        physicalAddress: r.physicalAddress, state: r.state, lga: r.lga,
        category: r.category, creditLimit: String(r.creditLimit),
        openingBalance: String(r.openingBalance), notes: r.notes,
      }));
    }
    case 'suppliers': {
      const rows = await db.suppliers.where({ farmId }).toArray();
      return rows.map(r => ({
        businessName: r.businessName, contactPerson: r.contactPerson,
        phone: r.phone, email: r.email, physicalAddress: r.physicalAddress,
        state: r.state, lga: r.lga, category: r.category,
        creditLimit: String(r.creditLimit), openingBalance: String(r.openingBalance),
        taxIdentificationNumber: r.taxIdentificationNumber,
        bankName: r.bankName, bankAccountName: r.bankAccountName,
        bankAccountNumber: r.bankAccountNumber, notes: r.notes,
      }));
    }
    case 'products': {
      const rows = await db.products.where({ farmId }).toArray();
      return rows.map(r => ({
        productName: r.productName, category: r.category, unit: r.unit,
        currentStock: String(r.currentStock), minimumStock: String(r.minimumStock),
        sellingPrice: String(r.sellingPrice), purchasePrice: String(r.purchasePrice),
        status: r.status,
      }));
    }
    case 'batches': {
      const rows = await db.batches.where({ farmId }).toArray();
      return rows.map(r => ({
        batchName: r.batchName, house: r.house, birdType: r.birdType,
        breed: r.breed, source: r.source, supplier: r.supplier,
        dateReceived: r.dateReceived, quantityReceived: String(r.quantityReceived),
        initialAverageWeight: String(r.initialAverageWeight),
        productionStage: r.productionStage, notes: r.notes,
      }));
    }
    case 'sales': {
      const rows = await db.salesHeaders.where({ farmId }).toArray();
      return rows.map(r => ({
        invoiceNumber: r.invoiceNumber, customerName: r.customerName,
        invoiceDate: r.invoiceDate, paymentMethod: r.paymentMethod,
        grandTotal: String(r.grandTotal), amountPaid: String(r.amountPaid),
        status: r.status, notes: r.notes,
      }));
    }
    case 'purchases': {
      const rows = await db.purchaseHeaders.where({ farmId }).toArray();
      return rows.map(r => ({
        purchaseNumber: r.purchaseNumber, supplierName: r.supplierName,
        purchaseDate: r.purchaseDate, paymentMethod: r.paymentMethod,
        grandTotal: String(r.grandTotal), amountPaid: String(r.amountPaid),
        status: r.status, notes: r.notes,
      }));
    }
    default:
      return [];
  }
}
