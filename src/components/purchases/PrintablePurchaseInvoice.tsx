import { useRef } from 'react';
import type { PurchaseHeader, PurchaseDetail } from '@/db/types';

interface Props {
  header: PurchaseHeader;
  details: PurchaseDetail[];
  companyInfo: {
    farmName: string;
    businessName: string;
    address: string;
    phoneNumbers: string;
    email: string;
    website: string;
    taxId: string;
    logo: string;
    currencySymbol: string;
  };
}

export default function PrintablePurchaseInvoice({ header, details, companyInfo }: Props) {
  const printRef = useRef<HTMLDivElement>(null);

  function handlePrint() {
    const content = printRef.current;
    if (!content) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>Purchase ${header.purchaseNumber}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', Arial, sans-serif; font-size: 12px; color: #1C1B1F; padding: 20px; }
        .invoice-header { display: flex; justify-content: space-between; margin-bottom: 24px; border-bottom: 2px solid #5D4037; padding-bottom: 16px; }
        .company-info h2 { font-size: 18px; color: #5D4037; margin-bottom: 4px; }
        .company-info p { font-size: 11px; color: #666; line-height: 1.6; }
        .invoice-title { text-align: right; }
        .invoice-title h1 { font-size: 28px; color: #5D4037; letter-spacing: 2px; }
        .invoice-title p { font-size: 11px; color: #666; }
        .invoice-meta { display: flex; justify-content: space-between; margin-bottom: 20px; }
        .meta-box { flex: 1; }
        .meta-box h4 { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #999; margin-bottom: 4px; }
        .meta-box p { font-size: 12px; font-weight: 500; }
        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .items-table th { background: #5D4037; color: #fff; padding: 8px 12px; text-align: left; font-size: 11px; font-weight: 600; }
        .items-table td { padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 12px; }
        .items-table tr:nth-child(even) td { background: #f9f9f9; }
        .items-table .text-right { text-align: right; }
        .totals { display: flex; justify-content: flex-end; margin-bottom: 24px; }
        .totals-box { width: 280px; }
        .totals-line { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; }
        .totals-line.total { border-top: 2px solid #5D4037; padding-top: 8px; margin-top: 4px; font-weight: 700; font-size: 14px; color: #5D4037; }
        .totals-line.balance { color: #D32F2F; font-weight: 600; }
        .totals-line.paid { color: #2E7D32; }
        .footer { margin-top: 40px; border-top: 1px solid #ddd; padding-top: 16px; display: flex; justify-content: space-between; }
        .signature-area { width: 200px; border-top: 1px solid #333; padding-top: 8px; text-align: center; font-size: 11px; }
        .notes { font-size: 11px; color: #666; max-width: 300px; }
        .notes strong { display: block; margin-bottom: 4px; }
        .logo-img { max-height: 60px; max-width: 150px; object-fit: contain; }
      </style></head><body>${content.innerHTML}</body></html>
    `);
    win.document.close();
    win.print();
  }

  return (
    <>
      <button className="btn btn-secondary btn-sm" onClick={handlePrint} style={{ marginBottom: 16 }}>
        <span className="material-icons-outlined" style={{ fontSize: 16 }}>print</span>
        Print Purchase Invoice
      </button>
      <div ref={printRef} className="printable-invoice">
        <div className="invoice-header">
          <div className="company-info">
            {companyInfo.logo && <img src={companyInfo.logo} alt="Logo" className="logo-img" />}
            <h2>{companyInfo.businessName || companyInfo.farmName}</h2>
            {companyInfo.address && <p>{companyInfo.address}</p>}
            {companyInfo.phoneNumbers && <p>Phone: {companyInfo.phoneNumbers}</p>}
            {companyInfo.email && <p>Email: {companyInfo.email}</p>}
          </div>
          <div className="invoice-title">
            <h1>PURCHASE ORDER</h1>
            <p><strong>{header.purchaseNumber}</strong></p>
            <p>Date: {header.purchaseDate}</p>
            {header.dueDate && <p>Due: {header.dueDate}</p>}
          </div>
        </div>

        <div className="invoice-meta">
          <div className="meta-box">
            <h4>Supplier</h4>
            <p>{header.supplierName}</p>
          </div>
          <div className="meta-box">
            <h4>Payment Method</h4>
            <p>{header.paymentMethod}</p>
          </div>
          <div className="meta-box">
            <h4>Status</h4>
            <p style={{ textTransform: 'uppercase', fontWeight: 700, color: header.status === 'posted' ? '#2E7D32' : '#F57F17' }}>{header.status}</p>
          </div>
        </div>

        <table className="items-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Item</th>
              <th>Qty</th>
              <th>Unit</th>
              <th className="text-right">Price</th>
              <th className="text-right">Discount</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {details.map((d, i) => (
              <tr key={d.id}>
                <td>{i + 1}</td>
                <td><strong>{d.productName}</strong></td>
                <td>{d.quantity}</td>
                <td>{d.unit}</td>
                <td className="text-right">{companyInfo.currencySymbol}{d.unitPrice.toLocaleString()}</td>
                <td className="text-right">{d.discount > 0 ? `${companyInfo.currencySymbol}${d.discount.toLocaleString()}` : '-'}</td>
                <td className="text-right"><strong>{companyInfo.currencySymbol}{d.lineTotal.toLocaleString()}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="totals">
          <div className="totals-box">
            <div className="totals-line">
              <span>Subtotal</span>
              <span>{companyInfo.currencySymbol}{header.subtotal.toLocaleString()}</span>
            </div>
            {header.discountAmount > 0 && (
              <div className="totals-line">
                <span>Discount</span>
                <span>-{companyInfo.currencySymbol}{header.discountAmount.toLocaleString()}</span>
              </div>
            )}
            <div className="totals-line total">
              <span>Grand Total</span>
              <span>{companyInfo.currencySymbol}{header.grandTotal.toLocaleString()}</span>
            </div>
            <div className="totals-line paid">
              <span>Amount Paid</span>
              <span>{companyInfo.currencySymbol}{header.amountPaid.toLocaleString()}</span>
            </div>
            {header.balanceDue > 0 && (
              <div className="totals-line balance">
                <span>Balance Due</span>
                <span>{companyInfo.currencySymbol}{header.balanceDue.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>

        {header.notes && (
          <div className="notes" style={{ marginBottom: 24 }}>
            <strong>Notes</strong>
            {header.notes}
          </div>
        )}

        <div className="footer">
          <div className="notes">
            <strong>Received By</strong>
          </div>
          <div className="signature-area">
            Authorized Signature
          </div>
        </div>
      </div>
    </>
  );
}
