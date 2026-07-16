import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, generateId, nowISO, getNextNumber, getSetting, getActiveFarmId } from '@/db/database';
import { useLiveQuery } from 'dexie-react-hooks';
import { useToast } from '@/components/ToastProvider';
import { Modal, ConfirmDialog } from '@/components/UI';
import { useSettings } from '@/hooks/useSettings';
import { queueSync } from '@/db/sync';
import PurchaseLineItemRow, { type LineItem } from '@/components/purchases/PurchaseLineItemRow';
import PurchaseSummary from '@/components/purchases/PurchaseSummary';
import PrintablePurchaseInvoice from '@/components/purchases/PrintablePurchaseInvoice';
import type { PurchaseHeader, PurchaseDetail, Supplier } from '@/db/types';

export default function PurchaseInvoicePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { getCompanyInfo, paymentMethods } = useSettings();
  const companyInfo = getCompanyInfo();
  const paymentMethodNames = paymentMethods.map(m => m.methodName);
  const products = useLiveQuery(() => db.products.where('status').equals('active').toArray()) || [];
  const suppliers = useLiveQuery(() => db.suppliers.where('status').equals('active').toArray()) || [];

  const existingHeader = useLiveQuery(() => id ? db.purchaseHeaders.get(Number(id)) : undefined, [id]);
  const existingDetails = useLiveQuery(() => id ? db.purchaseDetails.where('headerId').equals(Number(id)).toArray() : [], [id]) || [];

  const isEditing = !!id && !!existingHeader;
  const isReadOnly = existingHeader?.status === 'posted' || existingHeader?.status === 'voided';

  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [supplierId, setSupplierId] = useState(0);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'credit' | 'partial'>('paid');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [amountPaid, setAmountPaid] = useState(0);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<LineItem[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'post' | 'cancel' | 'void'>('post');
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddForm, setQuickAddForm] = useState({ businessName: '', phone: '', category: 'General Supplier' });
  const [showPrint, setShowPrint] = useState(false);
  const [savedHeader, setSavedHeader] = useState<PurchaseHeader | null>(null);
  const [savedDetails, setSavedDetails] = useState<PurchaseDetail[]>([]);

  useMemo(() => {
    if (existingHeader) {
      setPurchaseDate(existingHeader.purchaseDate);
      setDueDate(existingHeader.dueDate);
      setSupplierId(existingHeader.supplierId);
      setSupplierSearch(existingHeader.supplierName);
      setPaymentMethod(existingHeader.paymentMethod);
      setDiscountPercent(existingHeader.discountPercent);
      setAmountPaid(existingHeader.amountPaid);
      setNotes(existingHeader.notes);
      setPaymentStatus(existingHeader.balanceDue <= 0 ? 'paid' : existingHeader.amountPaid > 0 ? 'partial' : 'credit');
    }
    if (existingDetails && existingDetails.length > 0) {
      setItems(existingDetails.map(d => ({
        tempId: d.id || Date.now() + Math.random(),
        productId: d.productId, productName: d.productName, description: d.description,
        quantity: d.quantity, unit: d.unit, unitPrice: d.unitPrice,
        discount: d.discount, taxRate: d.taxRate, lineTotal: d.lineTotal,
      })));
    }
  }, [existingHeader, existingDetails]);

  const filteredSuppliers = useMemo(() => {
    if (!supplierSearch) return suppliers;
    const q = supplierSearch.toLowerCase();
    return suppliers.filter(s => s.businessName.toLowerCase().includes(q) || s.supplierCode.toLowerCase().includes(q) || s.phone.includes(q));
  }, [suppliers, supplierSearch]);

  function selectSupplier(s: Supplier) {
    setSupplierId(s.id!);
    setSupplierSearch(s.businessName);
    setShowSupplierDropdown(false);
  }

  function addItem() {
    setItems(prev => [...prev, {
      tempId: Date.now(), productId: 0, productName: '', description: '',
      quantity: 1, unit: '', unitPrice: 0, discount: 0, taxRate: 0, lineTotal: 0,
    }]);
  }

  function removeItem(index: number) { setItems(prev => prev.filter((_, i) => i !== index)); }
  function updateItem(index: number, item: LineItem) { setItems(prev => prev.map((it, i) => i === index ? item : it)); }

  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
  const discountAmount = subtotal * (discountPercent / 100);
  const grandTotal = Math.max(0, subtotal - discountAmount);
  const balanceDue = Math.max(0, grandTotal - amountPaid);

  function validate(): boolean {
    if (!supplierId) { toast('Please select a supplier', 'error'); return false; }
    if (items.length === 0) { toast('Add at least one line item', 'error'); return false; }
    for (let i = 0; i < items.length; i++) {
      if (!items[i].productId) { toast(`Line ${i + 1}: Select a product`, 'error'); return false; }
      if (items[i].quantity <= 0) { toast(`Line ${i + 1}: Invalid quantity`, 'error'); return false; }
    }
    return true;
  }

  async function handleSave(status: 'draft' | 'posted') {
    if (!validate()) return;
    const now = nowISO();
    const supplierName = suppliers.find(s => s.id === supplierId)?.businessName || supplierSearch;
    const autoGenerate = await getSetting('auto_generate_purchase_number', 'true');

    let purchaseNumber = '';
    if (isEditing && existingHeader) {
      purchaseNumber = existingHeader.purchaseNumber;
    } else if (autoGenerate === 'true') {
      purchaseNumber = await getNextNumber('purchase');
    } else {
      purchaseNumber = `PUR-${Date.now().toString(36).slice(-6).toUpperCase()}`;
    }

    const farmId = await getActiveFarmId();
    const headerData: Omit<PurchaseHeader, 'id'> = {
      farmId,
      purchaseNumber, supplierId, supplierName, purchaseDate,
      dueDate: dueDate || (paymentStatus !== 'paid' ? getDefaultDueDate() : ''),
      paymentMethod, status,
      subtotal, discountAmount, discountPercent, taxAmount: 0,
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
      await db.purchaseHeaders.update(headerId, headerData);
      await queueSync('purchaseHeaders', headerId, 'update', headerData);
      await db.purchaseDetails.where('headerId').equals(headerId).delete();
    } else {
      headerId = await db.purchaseHeaders.add(headerData as PurchaseHeader);
      await queueSync('purchaseHeaders', headerId as number, 'create', { ...headerData, id: headerId });
    }

    for (const item of items) {
      const detailData: Omit<PurchaseDetail, 'id'> = {
        farmId,
        headerId, productId: item.productId, productName: item.productName,
        description: item.description, quantity: item.quantity, unit: item.unit,
        unitPrice: item.unitPrice, discount: item.discount, taxRate: item.taxRate,
        lineTotal: item.lineTotal, createdAt: now, updatedAt: now, syncStatus: 'pending',
      };
      const detId = await db.purchaseDetails.add(detailData as PurchaseDetail);
      await queueSync('purchaseDetails', detId as number, 'create', { ...detailData, id: detId });
    }

    if (status === 'posted') {
      for (const item of items) {
        const product = products.find(p => p.id === item.productId);
        if (product) {
          await db.products.update(product.id!, {
            currentStock: product.currentStock + item.quantity, updatedAt: now, syncStatus: 'pending',
          });
        }
      }
      if (supplierId) {
        await db.suppliers.update(supplierId, { lastPurchaseDate: purchaseDate, updatedAt: now, syncStatus: 'pending' });
      }
    }

    const finalHeader = { ...headerData, id: headerId } as PurchaseHeader;
    const finalDetails: PurchaseDetail[] = items.map((item, i) => ({
      id: i, farmId, headerId, productId: item.productId, productName: item.productName,
      description: item.description, quantity: item.quantity, unit: item.unit,
      unitPrice: item.unitPrice, discount: item.discount, taxRate: item.taxRate,
      lineTotal: item.lineTotal, createdAt: now, updatedAt: now, syncStatus: 'pending' as const,
    }));

    setSavedHeader(finalHeader);
    setSavedDetails(finalDetails);

    toast(status === 'posted' ? 'Purchase posted. Stock updated.' : 'Purchase saved as draft');
    if (status === 'posted') setShowPrint(true);
    else navigate('/purchases');
  }

  function getDefaultDueDate(): string {
    const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().split('T')[0];
  }

  async function handleQuickAdd() {
    if (!quickAddForm.businessName.trim()) { toast('Business name is required', 'error'); return; }
    const now = nowISO();
    const farmId = await getActiveFarmId();
    const code = 'SUP-' + Date.now().toString(36).slice(-6).toUpperCase();
    const record: Omit<Supplier, 'id'> = {
      farmId,
      supplierId: generateId(), supplierCode: code, businessName: quickAddForm.businessName.trim(),
      contactPerson: '', phone: quickAddForm.phone.trim(), alternativePhone: '', email: '',
      physicalAddress: '', state: '', lga: '', category: quickAddForm.category, creditLimit: 0,
      openingBalance: 0, totalPurchases: 0, totalPayments: 0, outstandingBalance: 0,
      lastPurchaseDate: '', lastPaymentDate: '', status: 'active', registrationDate: now,
      taxIdentificationNumber: '', bankName: '', bankAccountName: '', bankAccountNumber: '',
      notes: 'Quick-created from Purchase',
      createdBy: 'user', createdAt: now, modifiedBy: 'user', updatedAt: now, syncDate: '', syncStatus: 'pending',
    };
    const id = await db.suppliers.add(record as Supplier);
    await queueSync('suppliers', id as number, 'create', { ...record, id });
    setSupplierId(id as number);
    setSupplierSearch(record.businessName);
    setShowQuickAdd(false);
    setQuickAddForm({ businessName: '', phone: '', category: 'General Supplier' });
    toast('Supplier registered');
  }

  async function voidInvoice() {
    if (!existingHeader?.id) return;
    const now = nowISO();
    await db.purchaseHeaders.update(existingHeader.id, { status: 'voided', updatedAt: now, syncStatus: 'pending' });
    await queueSync('purchaseHeaders', existingHeader.id, 'update', { status: 'voided', updatedAt: now });
    for (const d of existingDetails) {
      const product = products.find(p => p.id === d.productId);
      if (product) {
        await db.products.update(product.id!, { currentStock: Math.max(0, product.currentStock - d.quantity), updatedAt: now, syncStatus: 'pending' });
      }
    }
    toast('Purchase voided. Stock restored.');
    navigate('/purchases');
  }

  if (isReadOnly && existingHeader) {
    return (
      <div>
        <div className="flex justify-between items-center mb-4" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div>
            <button className="btn btn-text btn-sm" onClick={() => navigate('/purchases')}>
              <span className="material-icons-outlined" style={{ fontSize: 18 }}>arrow_back</span>
              Back to Purchases
            </button>
            <h2 style={{ marginTop: 8 }}>Purchase {existingHeader.purchaseNumber}</h2>
          </div>
          <button className="btn btn-secondary" onClick={() => {
            setSavedHeader(existingHeader);
            setSavedDetails(existingDetails.map(d => ({ ...d })));
            setShowPrint(true);
          }}>
            <span className="material-icons-outlined" style={{ fontSize: 18 }}>print</span>
            Print
          </button>
        </div>
        {savedHeader ? (
          <PrintablePurchaseInvoice header={savedHeader} details={savedDetails} companyInfo={companyInfo} />
        ) : (
          <div className="card">
            <p>Purchase: {existingHeader.purchaseNumber}</p>
            <p>Supplier: {existingHeader.supplierName}</p>
            <p>Total: {companyInfo.currencySymbol}{existingHeader.grandTotal.toLocaleString()}</p>
            <div style={{ marginTop: 16 }}>
              <button className="btn btn-secondary" onClick={() => {
                setSavedHeader(existingHeader);
                setSavedDetails(existingDetails.map(d => ({ ...d })));
                setShowPrint(true);
              }}>
                <span className="material-icons-outlined" style={{ fontSize: 18 }}>print</span>
                View & Print
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
          <button className="btn btn-text btn-sm" onClick={() => navigate('/purchases')}>
            <span className="material-icons-outlined" style={{ fontSize: 18 }}>arrow_back</span>
            Back to Purchases
          </button>
          <h2 style={{ marginTop: 8 }}>{isEditing ? `Edit ${existingHeader?.purchaseNumber}` : 'New Purchase Invoice'}</h2>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={() => handleSave('draft')}>
            <span className="material-icons-outlined" style={{ fontSize: 18 }}>save</span>
            Save Draft
          </button>
          <button className="btn btn-primary" onClick={() => {
            if (validate()) { setConfirmAction('post'); setShowConfirm(true); }
          }}>
            <span className="material-icons-outlined" style={{ fontSize: 18 }}>check_circle</span>
            Post Purchase
          </button>
        </div>
      </div>

      <div className="card mb-4">
        <h3 className="card-title mb-4">Purchase Details</h3>
        <div className="settings-form-row">
          <div className="form-group">
            <label className="form-label">Purchase Date <span className="required">*</span></label>
            <input className="form-input" type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Due Date</label>
            <input className="form-input" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Supplier <span className="required">*</span></label>
          <div className="customer-select-wrapper">
            <input className="form-input" value={supplierSearch}
              onChange={e => { setSupplierSearch(e.target.value); setShowSupplierDropdown(true); if (!e.target.value) setSupplierId(0); }}
              onFocus={() => setShowSupplierDropdown(true)} placeholder="Search supplier..."
            />
            {showSupplierDropdown && (
              <div className="customer-dropdown">
                {filteredSuppliers.length === 0 ? (
                  <div className="customer-dropdown-empty">
                    <span>No suppliers found</span>
                    <button className="btn btn-sm btn-primary" onClick={(e) => { e.stopPropagation(); setShowQuickAdd(true); }}>+ New Supplier</button>
                  </div>
                ) : (
                  filteredSuppliers.slice(0, 10).map(s => (
                    <div key={s.id} className="customer-dropdown-item" onClick={() => selectSupplier(s)}>
                      <div><strong>{s.businessName}</strong></div>
                      <div className="text-sm text-muted">{s.supplierCode} | {s.phone}</div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
          <button type="button" className="btn btn-text btn-sm mt-4" onClick={() => setShowQuickAdd(true)}>
            <span className="material-icons-outlined" style={{ fontSize: 14 }}>add</span>
            Quick Add Supplier
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
            <p style={{ marginTop: 8 }}>Click "Add Item" to add products to this purchase</p>
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
              <PurchaseLineItemRow key={item.tempId} item={item} index={index} products={products}
                onChange={updateItem} onRemove={removeItem} canRemove={items.length > 1} currencySymbol={companyInfo.currencySymbol}
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
        <PurchaseSummary items={items} discountPercent={discountPercent} currencySymbol={companyInfo.currencySymbol}
          onDiscountChange={setDiscountPercent} amountPaid={amountPaid} onAmountPaidChange={setAmountPaid}
          paymentMethod={paymentMethod} onPaymentMethodChange={setPaymentMethod}
          paymentMethods={paymentMethodNames.length > 0 ? paymentMethodNames : ['Cash', 'Bank Transfer', 'POS', 'Mobile Money', 'Cheque', 'Credit', 'Other']}
          paymentStatus={paymentStatus} onPaymentStatusChange={setPaymentStatus}
        />
        <div className="form-group mt-4">
          <label className="form-label">Notes</label>
          <textarea className="form-textarea" value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Optional notes" />
        </div>
      </div>

      <Modal open={showQuickAdd} title="Quick Add Supplier" onClose={() => setShowQuickAdd(false)}
        footer={<><button className="btn btn-secondary" onClick={() => setShowQuickAdd(false)}>Cancel</button><button className="btn btn-primary" onClick={handleQuickAdd}>Register</button></>}
      >
        <div className="form-group">
          <label className="form-label">Business Name <span className="required">*</span></label>
          <input className="form-input" value={quickAddForm.businessName} onChange={e => setQuickAddForm(f => ({ ...f, businessName: e.target.value }))} placeholder="Supplier name" autoFocus />
        </div>
        <div className="settings-form-row">
          <div className="form-group">
            <label className="form-label">Phone Number</label>
            <input className="form-input" value={quickAddForm.phone} onChange={e => setQuickAddForm(f => ({ ...f, phone: e.target.value }))} placeholder="Phone" />
          </div>
          <div className="form-group">
            <label className="form-label">Category</label>
            <input className="form-input" value={quickAddForm.category} onChange={e => setQuickAddForm(f => ({ ...f, category: e.target.value }))} />
          </div>
        </div>
      </Modal>

      <Modal open={showPrint} title="Purchase Invoice Preview" onClose={() => { setShowPrint(false); navigate('/purchases'); }}
        footer={<button className="btn btn-primary" onClick={() => { setShowPrint(false); navigate('/purchases'); }}>Done</button>}
      >
        {savedHeader && <PrintablePurchaseInvoice header={savedHeader} details={savedDetails} companyInfo={companyInfo} />}
      </Modal>

      <ConfirmDialog open={showConfirm}
        title={confirmAction === 'post' ? 'Post Purchase' : 'Cancel'}
        message={confirmAction === 'post' ? 'Post this purchase? Stock will be updated.' : 'Discard changes?'}
        onConfirm={() => { if (confirmAction === 'post') handleSave('posted'); setShowConfirm(false); }}
        onCancel={() => setShowConfirm(false)}
        confirmLabel={confirmAction === 'post' ? 'Post Purchase' : 'Discard'}
        danger={confirmAction !== 'post'}
      />
    </div>
  );
}
