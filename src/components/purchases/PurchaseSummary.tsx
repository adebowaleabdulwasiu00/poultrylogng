import type { LineItem } from './PurchaseLineItemRow';

interface Props {
  items: LineItem[];
  discountPercent: number;
  currencySymbol: string;
  onDiscountChange: (v: number) => void;
  amountPaid: number;
  onAmountPaidChange: (v: number) => void;
  paymentMethod: string;
  onPaymentMethodChange: (v: string) => void;
  paymentMethods: string[];
  paymentStatus: string;
  onPaymentStatusChange: (v: 'paid' | 'credit' | 'partial') => void;
}

export default function PurchaseSummary({
  items, discountPercent, currencySymbol, onDiscountChange,
  amountPaid, onAmountPaidChange, paymentMethod, onPaymentMethodChange,
  paymentMethods, paymentStatus, onPaymentStatusChange,
}: Props) {
  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
  const discountAmount = subtotal * (discountPercent / 100);
  const grandTotal = Math.max(0, subtotal - discountAmount);
  const balanceDue = Math.max(0, grandTotal - amountPaid);

  return (
    <div className="invoice-summary">
      <div className="invoice-summary-grid">
        <div className="invoice-summary-left">
          <div className="form-group" style={{ marginBottom: 8 }}>
            <label className="form-label">Discount (%)</label>
            <input
              className="form-input" type="number" min="0" max="100" step="0.5"
              value={discountPercent || ''}
              onChange={e => onDiscountChange(Number(e.target.value))}
              style={{ width: 120 }}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 8 }}>
            <label className="form-label">Payment Method</label>
            <select className="form-select" value={paymentMethod} onChange={e => onPaymentMethodChange(e.target.value)} style={{ width: 200 }}>
              {paymentMethods.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 8 }}>
            <label className="form-label">Payment Status</label>
            <select className="form-select" value={paymentStatus} onChange={e => {
              const val = e.target.value as 'paid' | 'credit' | 'partial';
              onPaymentStatusChange(val);
              if (val === 'paid') onAmountPaidChange(grandTotal);
              else if (val === 'credit') onAmountPaidChange(0);
            }} style={{ width: 200 }}>
              <option value="paid">Paid</option>
              <option value="partial">Partial</option>
              <option value="credit">Credit</option>
            </select>
          </div>
          {paymentStatus !== 'paid' && (
            <div className="form-group">
              <label className="form-label">Amount Paid</label>
              <input
                className="form-input" type="number" min="0" max={grandTotal} step="0.01"
                value={amountPaid || ''}
                onChange={e => onAmountPaidChange(Math.min(Number(e.target.value), grandTotal))}
                style={{ width: 200 }}
              />
            </div>
          )}
        </div>
        <div className="invoice-summary-right">
          <div className="summary-line">
            <span>Subtotal</span>
            <span>{currencySymbol}{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          {discountPercent > 0 && (
            <div className="summary-line summary-discount">
              <span>Discount ({discountPercent}%)</span>
              <span>-{currencySymbol}{discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          <div className="summary-line summary-total">
            <span>Grand Total</span>
            <span>{currencySymbol}{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="summary-line">
            <span>Amount Paid</span>
            <span>{currencySymbol}{amountPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          {balanceDue > 0 && (
            <div className="summary-line summary-balance">
              <span>Balance Due</span>
              <span>{currencySymbol}{balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
