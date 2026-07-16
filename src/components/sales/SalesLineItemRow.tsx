import { useState, useRef, useEffect } from 'react';
import type { Product } from '@/db/types';

interface LineItem {
  tempId: number;
  productId: number;
  productName: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discount: number;
  taxRate: number;
  lineTotal: number;
}

interface Props {
  item: LineItem;
  index: number;
  products: Product[];
  onChange: (index: number, item: LineItem) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
  currencySymbol: string;
}

export default function SalesLineItemRow({ item, index, products, onChange, onRemove, canRemove, currencySymbol }: Props) {
  const [productSearch, setProductSearch] = useState(item.productName);
  const [showDropdown, setShowDropdown] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function update(field: keyof LineItem, value: string | number) {
    const updated = { ...item, [field]: value };
    if (field === 'quantity' || field === 'unitPrice' || field === 'discount' || field === 'taxRate') {
      const sub = (updated.quantity * updated.unitPrice) - updated.discount;
      const tax = sub * (updated.taxRate / 100);
      updated.lineTotal = Math.max(0, sub + tax);
    }
    onChange(index, updated);
  }

  function selectProduct(p: Product) {
    const updated = {
      ...item,
      productId: p.id!,
      productName: p.productName,
      description: p.productName,
      unit: p.unit,
      unitPrice: p.sellingPrice,
    };
    const sub = (updated.quantity * updated.unitPrice) - updated.discount;
    const tax = sub * (updated.taxRate / 100);
    updated.lineTotal = Math.max(0, sub + tax);
    setProductSearch(p.productName);
    setShowDropdown(false);
    onChange(index, updated);
  }

  const filtered = products.filter(p => {
    if (!productSearch) return true;
    const q = productSearch.toLowerCase();
    return p.productName.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
  });

  const selectedProduct = products.find(p => p.id === item.productId);

  return (
    <div className="invoice-line-item">
      <div className="line-item-row">
        <div className="line-item-product" ref={wrapperRef}>
          {selectedProduct?.image && (
            <div className="line-item-product-img" onClick={() => { setLightboxSrc(selectedProduct.image || ''); }} title="View product image">
              <img src={selectedProduct.image} alt="" />
              <span className="material-icons-outlined line-item-product-lens">zoom_in</span>
            </div>
          )}
          <div className="customer-select-wrapper">
            <input
              className="form-input"
              value={productSearch}
              onChange={e => {
                setProductSearch(e.target.value);
                setShowDropdown(true);
                if (!e.target.value) update('productId', 0);
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Search product..."
            />
            {showDropdown && (
              <div className="customer-dropdown" style={{ maxHeight: 200 }}>
                {filtered.length === 0 ? (
                  <div className="customer-dropdown-empty"><span>No products found</span></div>
                ) : (
                  filtered.slice(0, 10).map(p => (
                    <div key={p.id} className="customer-dropdown-item" onClick={() => selectProduct(p)}>
                      <div><strong>{p.productName}</strong></div>
                      <div className="text-sm text-muted">Stock: {p.currentStock} {p.unit} | {currencySymbol}{p.sellingPrice.toLocaleString()}</div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <div className="line-item-qty">
          <input className="form-input" type="number" min="1" value={item.quantity || ''} onChange={e => update('quantity', Number(e.target.value))} placeholder="Qty" />
        </div>

        <div className="line-item-unit">
          <input className="form-input" value={item.unit} onChange={e => update('unit', e.target.value)} placeholder="Unit" readOnly style={{ background: '#f5f5f5' }} />
        </div>

        <div className="line-item-price">
          <input className="form-input" type="number" min="0" step="0.01" value={item.unitPrice || ''} onChange={e => update('unitPrice', Number(e.target.value))} placeholder="Price" />
        </div>

        <div className="line-item-discount">
          <input className="form-input" type="number" min="0" step="0.01" value={item.discount || ''} onChange={e => update('discount', Number(e.target.value))} placeholder="Disc" />
        </div>

        <div className="line-item-total">
          <span className="line-total-value">{currencySymbol}{item.lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>

        <button
          className="btn btn-icon btn-text btn-sm line-item-remove"
          onClick={() => onRemove(index)}
          disabled={!canRemove}
          style={{ color: canRemove ? 'var(--md-error)' : undefined }}
        >
          <span className="material-icons-outlined" style={{ fontSize: 18 }}>close</span>
        </button>
      </div>
      {selectedProduct && selectedProduct.currentStock < (item.quantity || 0) && (
        <div className="stock-warning">
          <span className="material-icons-outlined" style={{ fontSize: 14 }}>warning</span>
          Insufficient stock. Available: {selectedProduct.currentStock} {selectedProduct.unit}
        </div>
      )}
      {lightboxSrc && (
        <div className="modal-overlay" onClick={() => setLightboxSrc(null)} style={{ cursor: 'zoom-out', zIndex: 9999 }}>
          <button className="btn btn-icon" onClick={() => setLightboxSrc(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(0,0,0,0.6)', color: '#fff', zIndex: 10, borderRadius: '50%' }}>
            <span className="material-icons-outlined">close</span>
          </button>
          <img src={lightboxSrc} alt="Product" onClick={e => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8, boxShadow: '0 8px 40px rgba(0,0,0,0.4)' }} />
        </div>
      )}
    </div>
  );
}

export type { LineItem };
