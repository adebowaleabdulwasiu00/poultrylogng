import { useState, useMemo } from 'react';
import { db } from '@/db/database';
import { useLiveQuery } from 'dexie-react-hooks';
import { SearchBar, Badge, EmptyState } from '@/components/UI';

export default function InventoryReports() {
  const products = useLiveQuery(() => db.products.toArray()) || [];
  const purchases = useLiveQuery(() => db.purchases.toArray()) || [];
  const sales = useLiveQuery(() => db.sales.toArray()) || [];
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all');

  const productMap = useMemo(() => {
    const map: Record<number, { purchased: number; sold: number; stock: number }> = {};
    for (const p of products) {
      map[p.id!] = { purchased: 0, sold: 0, stock: p.currentStock };
    }
    for (const p of purchases) {
      if (map[p.productId]) map[p.productId].purchased += p.quantity;
    }
    for (const s of sales) {
      if (map[s.productId]) map[s.productId].sold += s.quantity;
    }
    return map;
  }, [products, purchases, sales]);

  const enriched = useMemo(() => products.map(p => ({
    ...p,
    totalPurchased: productMap[p.id!]?.purchased || 0,
    totalSold: productMap[p.id!]?.sold || 0,
    isLow: p.currentStock <= p.minimumStock && p.currentStock > 0,
    isOut: p.currentStock === 0,
  })), [products, productMap]);

  const filtered = useMemo(() => {
    let list = enriched;
    if (filter === 'low') list = list.filter(p => p.isLow);
    if (filter === 'out') list = list.filter(p => p.isOut);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p => p.productName.toLowerCase().includes(q));
    }
    return list;
  }, [enriched, search, filter]);

  return (
    <div>
      <div className="flex justify-between items-center mb-4" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div className="flex gap-2">
          {(['all', 'low', 'out'] as const).map(f => (
            <button key={f} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f === 'low' ? 'Low Stock' : 'Out of Stock'}
            </button>
          ))}
        </div>
        <SearchBar value={search} onChange={setSearch} placeholder="Search..." />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="inventory" title="No Data" description="Add products and record purchases/sales" />
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Total Purchased</th>
                  <th>Total Sold</th>
                  <th>Current Stock</th>
                  <th>Min Stock</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id}>
                    <td><strong>{p.productName}</strong></td>
                    <td><Badge variant="neutral">{p.category}</Badge></td>
                    <td>{p.totalPurchased} {p.unit}</td>
                    <td>{p.totalSold} {p.unit}</td>
                    <td style={{ fontWeight: 700, color: p.isOut ? 'var(--md-error)' : p.isLow ? '#E65100' : 'var(--md-success)' }}>
                      {p.currentStock} {p.unit}
                    </td>
                    <td>{p.minimumStock}</td>
                    <td>
                      <Badge variant={p.isOut ? 'error' : p.isLow ? 'warning' : 'success'}>
                        {p.isOut ? 'Out of Stock' : p.isLow ? 'Low Stock' : 'OK'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
