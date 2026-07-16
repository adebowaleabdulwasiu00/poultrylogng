import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, generateId, nowISO, getNextNumber, getSetting, getActiveFarmId } from '@/db/database';
import { useLiveQuery } from 'dexie-react-hooks';
import { useToast } from '@/components/ToastProvider';
import { Modal, ConfirmDialog } from '@/components/UI';
import { useSettings } from '@/hooks/useSettings';
import { queueSync } from '@/db/sync';
import SalesLineItemRow, { type LineItem } from '@/components/sales/SalesLineItemRow';
import InvoiceSummary from '@/components/sales/InvoiceSummary';
import PrintableInvoice from '@/components/sales/PrintableInvoice';
import type { SalesHeader, SalesDetail, Customer } from '@/db/types';
import type { SalesHeader as SH } from '@/db/types';

export default function SalesInvoicePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { getCompanyInfo, paymentMethods } = useSettings();
  const companyInfo = getCompanyInfo();
  const paymentMethodNames = paymentMethods.map(m => m.methodName);
  const products = useLiveQuery(() => db.products.where('status').equals('active').toArray()) || [];
  const customers = useLiveQuery(() => db.customers.where('status').equals('active').toArray()) || [];

  const existingHeader = useLiveQuery(
    () => id ? db.salesHeaders.get(Number(id)) : undefined,
    [id]
  );
  const existingDetails = useLiveQuery(
    () => id ? db.salesDetails.where('headerId').equals(Number(id)).toArray() : [],
    [id]
  ) || [];

  const isEditing = !!id && !!existingHeader;
  const isReadOnly = existingHeader?.status === 'posted' || existingHeader?.status === 'voided';

  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [customerId, setCustomerId] = useState(0);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [salesPerson, setSalesPerson] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [amountPaid, setAmountPaid] = useState(0);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<LineItem[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'post' | 'cancel' | 'void'>('post');
  const [showQuickCustomer, setShowQuickCustomer] = useState(false);
  const [quickCustomer, setQuickCustomer] = useState({ fullName: '', phone: '' });
  const [showPrint, setShowPrint] = useState(false);
  const [savedHeader, setSavedHeader] = useState<SalesHeader | null>(null);
  const [savedDetails, setSavedDetails] = useState<SalesDetail[]>([]);
  const [showCustomerReceipt, setShowCustomerReceipt] = useState(false);

  // Initialize from existing data
  useMemo(() => {
    if (existingHeader) {
      setInvoiceDate(existingHeader.invoiceDate);
      setDueDate(existingHeader.dueDate);
      setCustomerId(existingHeader.customerId);
      setCustomerSearch(existingHeader.customerName);
      setPaymentMethod(existingHeader.paymentMethod);
      setSalesPerson(existingHeader.salesPerson);
      setDiscountPercent(existingHeader.discountPercent);
      setAmountPaid(existingHeader.amountPaid);
      setNotes(existingHeader.notes);
    }
    if (existingDetails && existingDetails.length > 0) {
      setItems(existingDetails.map(d => ({
        tempId: d.id || Date.now() + Math.random(),
        productId: d.productId,
        productName: d.productName,
        description: d.description,
        quantity: d.quantity,
        unit: d.unit,
        unitPrice: d.unitPrice,
        discount: d.discount,
        taxRate: d.taxRate,
        lineTotal: d.lineTotal,
      })));
    }
  }, [existingHeader, existingDetails]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return customers;
    const q = customerSearch.toLowerCase();
    return customers.filter(c =>
      c.fullName.toLowerCase().includes(q) ||
      c.customerCode.toLowerCase().includes(q) ||
      c.phone.includes(q)
    );
  }, [customers, customerSearch]);

  function selectCustomer(c: Customer) {
    setCustomerId(c.id!);
    setCustomerSearch(c.fullName);
    setShowCustomerDropdown(false);
  }

  function addItem() {
    setItems(prev => [...prev, {
      tempId: Date.now(),
      productId: 0, productName: '', description: '',
      quantity: 1, unit: '', unitPrice: 0, discount: 0, taxRate: 0, lineTotal: 0,
    }]);
  }

  function removeItem(index: number) {
    setItems(prev => prev.filter((_, i) => i !== index));
  }

  function updateItem(index: number, item: LineItem) {
    setItems(prev => prev.map((it, i) => i === index ? item : it));
  }

  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
  const discountAmount = subtotal * (discountPercent / 100);
  const grandTotal = Math.max(0, subtotal - discountAmount);
  const balanceDue = Math.max(0, grandTotal - amountPaid);

  function validate(): boolean {
    if (!customerId) { toast('Please select a customer', 'error'); return false; }
    if (items.length === 0) { toast('Add at least one line item', 'error'); return false; }
    for (let i = 0; i < items.length; i++) {
      if (!items[i].productId) { toast(`Line ${i + 1}: Select a product`, 'error'); return false; }
      if (items[i].quantity <= 0) { toast(`Line ${i + 1}: Invalid quantity`, 'error'); return false; }
      if (items[i].unitPrice < 0) { toast(`Line ${i + 1}: Invalid price`, 'error'); return false; }
    }
    return true;
  }

  async function handleSave(status: 'draft' | 'posted') {
    if (!validate()) return;
    if (status === 'posted') {
      // Check stock for all items
      for (const item of items) {
        const product = products.find(p => p.id === item.productId);
        if (product && product.currentStock < item.quantity) {
          toast(`Insufficient stock for ${item.productName}. Available: ${product.currentStock}`, 'error');
          return;
        }
      }
    }

    const now = nowISO();
    const customerName = customers.find(c => c.id === customerId)?.fullName || customerSearch;
    const autoGenerate = await getSetting('auto_generate_invoice', 'true');

    let invoiceNumber = '';
    if (isEditing && existingHeader) {
      invoiceNumber = existingHeader.invoiceNumber;
    } else if (autoGenerate === 'true') {
      invoiceNumber = await getNextNumber('sale');
    } else {
      invoiceNumber = `INV-${Date.now().toString(36).slice(-6).toUpperCase()}`;
    }

    const farmId = await getActiveFarmId();
    const headerData: Omit<SalesHeader, 'id'> = {
      farmId,
      invoiceNumber,
      customerId,
      customerName,
      invoiceDate,
      dueDate: dueDate || (paymentMethod === 'Credit' ? getDefaultDueDate() : ''),
      paymentMethod,
      salesPerson,
      status,
      subtotal,
      discountAmount,
      discountPercent,
      taxAmount: 0,
      grandTotal,
      amountPaid: status === 'posted' ? amountPaid : 0,
      balanceDue: status === 'posted' ? balanceDue : grandTotal,
      notes,
      createdBy: isEditing && existingHeader ? existingHeader.createdBy : 'user',
      createdAt: isEditing && existingHeader ? existingHeader.createdAt : now,
      modifiedBy: 'user',
      updatedAt: now,
      syncDate: '',
      syncStatus: 'pending',
    };

    let headerId: number;
    if (isEditing && existingHeader?.id) {
      headerId = existingHeader.id;
      await db.salesHeaders.update(headerId, headerData);
      await queueSync('salesHeaders', headerId, 'update', headerData);
      // Remove old details and re-add
      await db.salesDetails.where('headerId').equals(headerId).delete();
    } else {
      headerId = await db.salesHeaders.add(headerData as SalesHeader);
      await queueSync('salesHeaders', headerId as number, 'create', { ...headerData, id: headerId });
    }

    // Add detail lines
    for (const item of items) {
      const detailData: Omit<SalesDetail, 'id'> = {
        farmId,
        headerId,
        productId: item.productId,
        productName: item.productName,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        discount: item.discount,
        taxRate: item.taxRate,
        lineTotal: item.lineTotal,
        createdAt: now,
        updatedAt: now,
        syncStatus: 'pending',
      };
      const detId = await db.salesDetails.add(detailData as SalesDetail);
      await queueSync('salesDetails', detId as number, 'create', { ...detailData, id: detId });
    }

    // If posted, update stock and customer
    if (status === 'posted') {
      for (const item of items) {
        const product = products.find(p => p.id === item.productId);
        if (product) {
          await db.products.update(product.id!, {
            currentStock: product.currentStock - item.quantity,
            updatedAt: now, syncStatus: 'pending',
          });
        }
      }
      await db.customers.update(customerId, {
        lastPurchaseDate: invoiceDate,
        updatedAt: now, syncStatus: 'pending',
      });
    }

    // Save for print
    const finalHeader = { ...headerData, id: headerId } as SalesHeader;
    const finalDetails: SalesDetail[] = items.map((item, i) => ({
      id: i, farmId, headerId, productId: item.productId, productName: item.productName,
      description: item.description, quantity: item.quantity, unit: item.unit,
      unitPrice: item.unitPrice, discount: item.discount, taxRate: item.taxRate,
      lineTotal: item.lineTotal, createdAt: now, updatedAt: now, syncStatus: 'pending' as const,
    }));

    setSavedHeader(finalHeader);
    setSavedDetails(finalDetails);

    toast(status === 'posted' ? 'Invoice posted. Stock updated.' : 'Invoice saved as draft');
    if (status === 'posted') {
      setShowPrint(true);
    } else {
      navigate('/sales');
    }
  }

  function getDefaultDueDate(): string {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  }

  async function handleQuickCustomer() {
    if (!quickCustomer.fullName.trim()) { toast('Name is required', 'error'); return; }
    const now = nowISO();
    const farmId = await getActiveFarmId();
    const code = 'CUST-' + Date.now().toString(36).slice(-6).toUpperCase();
    const record: Omit<Customer, 'id'> = {
      farmId,
      customerId: generateId(), customerCode: code, fullName: quickCustomer.fullName.trim(),
      contactPerson: '', phone: quickCustomer.phone.trim(), alternativePhone: '', email: '',
      physicalAddress: '', state: '', lga: '', category: 'Retail', creditLimit: 0, openingBalance: 0,
      lastPurchaseDate: '', lastPaymentDate: '', status: 'active', registrationDate: now,
      notes: 'Quick-created from Sales Invoice',
      createdBy: 'user', createdAt: now, modifiedBy: 'user', updatedAt: now, syncDate: '', syncStatus: 'pending',
    };
    const id = await db.customers.add(record as Customer);
    await queueSync('customers', id as number, 'create', { ...record, id });
    setCustomerId(id as number);
    setCustomerSearch(record.fullName);
    setQuickCustomer({ fullName: '', phone: '' });
    setShowQuickCustomer(false);
    toast('Customer created');
  }

  function handleConfirmAction() {
    if (confirmAction === 'post') handleSave('posted');
    else if (confirmAction === 'cancel') navigate('/sales');
    else if (confirmAction === 'void') voidInvoice();
    setShowConfirm(false);
  }

  async function voidInvoice() {
    if (!existingHeader?.id) return;
    const now = nowISO();
    await db.salesHeaders.update(existingHeader.id, { status: 'voided', updatedAt: now, syncStatus: 'pending' });
    await queueSync('salesHeaders', existingHeader.id, 'update', { status: 'voided', updatedAt: now });
    // Restore stock
    for (const d of existingDetails) {
      const product = products.find(p => p.id === d.productId);
      if (product) {
        await db.products.update(product.id!, { currentStock: product.currentStock + d.quantity, updatedAt: now, syncStatus: 'pending' });
      }
    }
    toast('Invoice voided. Stock restored.');
    navigate('/sales');
  }

  if (isReadOnly && existingHeader) {
    return (
      <div>
        <div className="flex justify-between items-center mb-4" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div>
            <button className="btn btn-text btn-sm" onClick={() => navigate('/sales')}>
              <span className="material-icons-outlined" style={{ fontSize: 18 }}>arrow_back</span>
              Back to Sales
            </button>
            <h2 style={{ marginTop: 8 }}>Invoice {existingHeader.invoiceNumber}</h2>
          </div>
          <div className="flex gap-2">
            {existingHeader.status === 'posted' && (
              <button className="btn btn-secondary" onClick={() => {
                setSavedHeader(existingHeader);
                setSavedDetails(existingDetails.map(d => ({ ...d })));
                setShowPrint(true);
              }}>
                <span className="material-icons-outlined" style={{ fontSize: 18 }}>print</span>
                Print
              </button>
            )}
          </div>
        </div>
        {savedHeader ? (
          <PrintableInvoice header={savedHeader} details={savedDetails} companyInfo={companyInfo} />
        ) : (
          <div className="card">
            <p>Invoice: {existingHeader.invoiceNumber}</p>
            <p>Customer: {existingHeader.customerName}</p>
            <p>Total: {companyInfo.currencySymbol}{existingHeader.grandTotal.toLocaleString()}</p>
            <p>Status: {existingHeader.status}</p>
            <div style={{ marginTop: 16 }}>
              <button className="btn btn-secondary" onClick={() => {
                setSavedHeader(existingHeader);
                setSavedDetails(existingDetails.map(d => ({ ...d })));
                setShowPrint(true);
              }}>
                <span className="material-icons-outlined" style={{ fontSize: 18 }}>print</span>
                View & Print Invoice
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div>
          <button className="btn btn-text btn-sm" onClick={() => navigate('/sales')}>
            <span className="material-icons-outlined" style={{ fontSize: 18 }}>arrow_back</span>
            Back to Sales
          </button>
          <h2 style={{ marginTop: 8 }}>{isEditing ? `Edit ${existingHeader?.invoiceNumber}` : 'New Sales Invoice'}</h2>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={() => handleSave('draft')}>
            <span className="material-icons-outlined" style={{ fontSize: 18 }}>save</span>
            Save Draft
          </button>
          <button className="btn btn-primary" onClick={() => {
            if (validate()) {
              setConfirmAction('post');
              setShowConfirm(true);
            }
          }}>
            <span className="material-icons-outlined" style={{ fontSize: 18 }}>check_circle</span>
            Post Invoice
          </button>
        </div>
      </div>

      <div className="card mb-4">
        <h3 className="card-title mb-4">Invoice Details</h3>
        <div className="settings-form-row">
          <div className="form-group">
            <label className="form-label">Invoice Date <span className="required">*</span></label>
            <input className="form-input" type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Due Date</label>
            <input className="form-input" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Sales Person</label>
            <input className="form-input" value={salesPerson} onChange={e => setSalesPerson(e.target.value)} placeholder="Optional" />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Customer <span className="required">*</span></label>
          <div className="customer-select-wrapper">
            <input
              className="form-input" value={customerSearch}
              onChange={e => {
                setCustomerSearch(e.target.value);
                setShowCustomerDropdown(true);
                if (!e.target.value) { setCustomerId(0); }
              }}
              onFocus={() => setShowCustomerDropdown(true)}
              placeholder="Search customer..."
            />
            {showCustomerDropdown && (
              <div className="customer-dropdown">
                {filteredCustomers.length === 0 ? (
                  <div className="customer-dropdown-empty">
                    <span>No customers found</span>
                    <button className="btn btn-sm btn-primary" onClick={(e) => { e.stopPropagation(); setShowQuickCustomer(true); }}>+ New Customer</button>
                  </div>
                ) : (
                  filteredCustomers.slice(0, 10).map(c => (
                    <div key={c.id} className="customer-dropdown-item" onClick={() => selectCustomer(c)}>
                      <div><strong>{c.fullName}</strong></div>
                      <div className="text-sm text-muted">{c.customerCode} | {c.phone}</div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
          <button type="button" className="btn btn-text btn-sm mt-4" onClick={() => setShowQuickCustomer(true)}>
            <span className="material-icons-outlined" style={{ fontSize: 14 }}>add</span>
            Quick Add Customer
          </button>
        </div>
      </div>

      <div className="card mb-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="card-title">Line Items</h3>
          <button className="btn btn-primary btn-sm" onClick={addItem}>
            <span className="material-icons-outlined" style={{ fontSize: 16 }}>add</span>
            Add Item
          </button>
        </div>

        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--md-on-surface-variant)' }}>
            <span className="material-icons-outlined" style={{ fontSize: 48, color: 'var(--md-outline-variant)' }}>playlist_add</span>
            <p style={{ marginTop: 8 }}>Click "Add Item" to add products to this invoice</p>
          </div>
        ) : (
          <div className="invoice-line-items">
            <div className="line-item-header">
              <span className="line-item-product">Product</span>
              <span className="line-item-qty">Qty</span>
              <span className="line-item-unit">Unit</span>
              <span className="line-item-price">Price</span>
              <span className="line-item-discount">Disc.</span>
              <span className="line-item-total">Total</span>
              <span className="line-item-remove" />
            </div>
            {items.map((item, index) => (
              <SalesLineItemRow
                key={item.tempId}
                item={item}
                index={index}
                products={products}
                onChange={updateItem}
                onRemove={removeItem}
                canRemove={items.length > 1}
                currencySymbol={companyInfo.currencySymbol}
              />
            ))}
          </div>
        )}

        {items.length > 0 && (
          <button className="btn btn-text btn-sm mt-4" onClick={addItem}>
            <span className="material-icons-outlined" style={{ fontSize: 16 }}>add</span>
            Add Another Item
          </button>
        )}
      </div>

      <div className="card mb-4">
        <h3 className="card-title mb-4">Payment & Summary</h3>
        <InvoiceSummary
          items={items}
          discountPercent={discountPercent}
          currencySymbol={companyInfo.currencySymbol}
          onDiscountChange={setDiscountPercent}
          amountPaid={amountPaid}
          onAmountPaidChange={setAmountPaid}
          paymentMethod={paymentMethod}
          onPaymentMethodChange={setPaymentMethod}
          paymentMethods={paymentMethodNames.length > 0 ? paymentMethodNames : ['Cash', 'Bank Transfer', 'POS', 'Mobile Money', 'Cheque', 'Credit', 'Other']}
        />
        <div className="form-group mt-4">
          <label className="form-label">Notes</label>
          <textarea className="form-textarea" value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Optional notes for this invoice" />
        </div>
      </div>

      <Modal
        open={showQuickCustomer}
        title="Quick Add Customer"
        onClose={() => setShowQuickCustomer(false)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowQuickCustomer(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleQuickCustomer}>Create</button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Full Name / Business Name <span className="required">*</span></label>
          <input className="form-input" value={quickCustomer.fullName} onChange={e => setQuickCustomer(f => ({ ...f, fullName: e.target.value }))} placeholder="Customer name" autoFocus />
        </div>
        <div className="form-group">
          <label className="form-label">Phone Number</label>
          <input className="form-input" value={quickCustomer.phone} onChange={e => setQuickCustomer(f => ({ ...f, phone: e.target.value }))} placeholder="08012345678" />
        </div>
      </Modal>

      <Modal
        open={showPrint}
        title="Invoice Preview"
        onClose={() => { setShowPrint(false); navigate('/sales'); }}
        footer={
          <button className="btn btn-primary" onClick={() => { setShowPrint(false); navigate('/sales'); }}>
            Done
          </button>
        }
      >
        {savedHeader && <PrintableInvoice header={savedHeader} details={savedDetails} companyInfo={companyInfo} />}
      </Modal>

      <ConfirmDialog
        open={showConfirm}
        title={confirmAction === 'post' ? 'Post Invoice' : confirmAction === 'void' ? 'Void Invoice' : 'Cancel'}
        message={confirmAction === 'post'
          ? 'Post this invoice? Stock will be updated and the invoice cannot be edited.'
          : confirmAction === 'void'
          ? 'Void this invoice? Stock will be restored.'
          : 'Discard changes and go back?'}
        onConfirm={handleConfirmAction}
        onCancel={() => setShowConfirm(false)}
        confirmLabel={confirmAction === 'post' ? 'Post Invoice' : confirmAction === 'void' ? 'Void' : 'Discard'}
        danger={confirmAction !== 'post'}
      />
    </div>
  );
}
