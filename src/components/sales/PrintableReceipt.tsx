import { useRef } from 'react';

interface ReceiptData {
  receiptNumber: string;
  customerName: string;
  paymentDate: string;
  amountPaid: number;
  paymentMethod: string;
  invoiceNumber: string;
  grandTotal: number;
  balanceRemaining: number;
  staff: string;
}

interface Props {
  data: ReceiptData;
  companyInfo: {
    farmName: string;
    businessName: string;
    address: string;
    phoneNumbers: string;
    email: string;
    logo: string;
    currencySymbol: string;
  };
}

export default function PrintableReceipt({ data, companyInfo }: Props) {
  const printRef = useRef<HTMLDivElement>(null);

  function handlePrint() {
    const content = printRef.current;
    if (!content) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>Receipt ${data.receiptNumber}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', Arial, sans-serif; font-size: 12px; color: #1C1B1F; padding: 20px; max-width: 400px; margin: 0 auto; }
        .receipt-header { text-align: center; margin-bottom: 16px; border-bottom: 2px solid #2E7D32; padding-bottom: 12px; }
        .receipt-header h2 { font-size: 16px; color: #2E7D32; }
        .receipt-header p { font-size: 11px; color: #666; line-height: 1.5; }
        .logo-img { max-height: 50px; max-width: 120px; object-fit: contain; margin-bottom: 8px; }
        .receipt-title { font-size: 20px; font-weight: 700; color: #2E7D32; margin: 12px 0; letter-spacing: 2px; }
        .receipt-meta { margin-bottom: 16px; }
        .receipt-line { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; border-bottom: 1px dotted #ddd; }
        .receipt-line:last-child { border-bottom: none; }
        .receipt-line .label { color: #666; }
        .receipt-line .value { font-weight: 600; }
        .receipt-amount { text-align: center; margin: 16px 0; padding: 12px; background: #E8F5E9; border-radius: 8px; }
        .receipt-amount .amount { font-size: 24px; font-weight: 700; color: #2E7D32; }
        .receipt-amount .label { font-size: 11px; color: #666; }
        .receipt-footer { text-align: center; margin-top: 24px; border-top: 1px solid #ddd; padding-top: 12px; font-size: 11px; color: #999; }
        .signature-area { width: 150px; border-top: 1px solid #333; margin: 24px auto 8px; text-align: center; font-size: 10px; }
      </style></head><body>${content.innerHTML}</body></html>
    `);
    win.document.close();
    win.print();
  }

  return (
    <>
      <button className="btn btn-secondary btn-sm" onClick={handlePrint} style={{ marginBottom: 16 }}>
        <span className="material-icons-outlined" style={{ fontSize: 16 }}>print</span>
        Print Receipt
      </button>
      <div ref={printRef} className="printable-receipt">
        <div className="receipt-header">
          {companyInfo.logo && <img src={companyInfo.logo} alt="Logo" className="logo-img" />}
          <h2>{companyInfo.businessName || companyInfo.farmName}</h2>
          {companyInfo.address && <p>{companyInfo.address}</p>}
          {companyInfo.phoneNumbers && <p>{companyInfo.phoneNumbers}</p>}
          {companyInfo.email && <p>{companyInfo.email}</p>}
        </div>
        <div className="receipt-title">PAYMENT RECEIPT</div>
        <div className="receipt-meta">
          <div className="receipt-line">
            <span className="label">Receipt No:</span>
            <span className="value">{data.receiptNumber}</span>
          </div>
          <div className="receipt-line">
            <span className="label">Date:</span>
            <span className="value">{data.paymentDate}</span>
          </div>
          <div className="receipt-line">
            <span className="label">Customer:</span>
            <span className="value">{data.customerName}</span>
          </div>
          <div className="receipt-line">
            <span className="label">Invoice:</span>
            <span className="value">{data.invoiceNumber}</span>
          </div>
          <div className="receipt-line">
            <span className="label">Payment Method:</span>
            <span className="value">{data.paymentMethod}</span>
          </div>
          <div className="receipt-line">
            <span className="label">Staff:</span>
            <span className="value">{data.staff || '-'}</span>
          </div>
        </div>
        <div className="receipt-amount">
          <div className="label">AMOUNT PAID</div>
          <div className="amount">{companyInfo.currencySymbol}{data.amountPaid.toLocaleString()}</div>
        </div>
        <div className="receipt-meta">
          <div className="receipt-line">
            <span className="label">Total Invoice:</span>
            <span className="value">{companyInfo.currencySymbol}{data.grandTotal.toLocaleString()}</span>
          </div>
          <div className="receipt-line">
            <span className="label">Balance Remaining:</span>
            <span className="value" style={{ color: data.balanceRemaining > 0 ? '#D32F2F' : '#2E7D32' }}>
              {companyInfo.currencySymbol}{data.balanceRemaining.toLocaleString()}
            </span>
          </div>
        </div>
        <div className="receipt-footer">
          <p>Thank you for your payment!</p>
          <div className="signature-area">Authorized Signature</div>
        </div>
      </div>
    </>
  );
}
