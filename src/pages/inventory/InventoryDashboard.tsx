import { useState, useMemo } from 'react';
import { db } from '@/db/database';
import { useLiveQuery } from 'dexie-react-hooks';
import { SearchBar, Badge, EmptyState } from '@/components/UI';

export default function InventoryDashboard() {
  const products = useLiveQuery(() => db.products.toArray()) || [];
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all');

  const enriched = useMemo(() => {
    return products.map(p => ({
      ...p,
      isLow: p.currentStock <= p.minimumStock && p.currentStock > 0,
      isOut: p.currentStock === 0,
    }));
  }, [products]);

  const filtered = useMemo(() => {
    let list = enriched;
    if (filter === 'low') list = list.filter(p => p.isLow);
    if (filter === 'out') list = list.filter(p => p.isOut);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p => p.productName.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
    }
    return list;
  }, [enriched, search, filter]);

  const lowCount = enriched.filter(p => p.isLow).length;
  const outCount = enriched.filter(p => p.isOut).length;

  return (
    <div>
      <div className="grid grid-3 mb-6">
        <div className="stat-card">
          <div className="stat-icon green"><span className="material-icons-outlined">inventory</span></div>
          <div className="stat-info">
            <h3>{products.length}</h3>
            <p>Total Products</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange"><span className="material-icons-outlined">warning</span></div>
          <div className="stat-info">
            <h3>{lowCount}</h3>
            <p>Low Stock</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red"><span className="material-icons-outlined">remove_shopping_cart</span></div>
          <div className="stat-info">
            <h3>{outCount}</h3>
            <p>Out of Stock</p>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center mb-4" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div className="flex gap-2">
          {(['all', 'low', 'out'] as const).map(f => (
            <button key={f} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f === 'low' ? 'Low Stock' : 'Out of Stock'}
            </button>
          ))}
        </div>
        <SearchBar value={search} onChange={setSearch} placeholder="Search products..." />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="inventory" title="No Products" description="Add products to track inventory" />
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Current Stock</th>
                  <th>Min Stock</th>
                  <th>Unit</th>
                  <th>Purchase ₦</th>
                  <th>Selling ₦</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id}>
                    <td><strong>{p.productName}</strong></td>
                    <td><Badge variant="neutral">{p.category}</Badge></td>
                    <td style={{ fontWeight: 700, color: p.isOut ? 'var(--md-error)' : p.isLow ? '#E65100' : 'var(--md-success)' }}>
                      {p.currentStock} {p.unit}
                    </td>
                    <td>{p.minimumStock}</td>
                    <td>{p.unit}</td>
                    <td>₦{p.purchasePrice.toLocaleString()}</td>
                    <td>₦{p.sellingPrice.toLocaleString()}</td>
                    <td>
                      <Badge variant={p.isOut ? 'error' : p.isLow ? 'warning' : 'success'}>
                        {p.isOut ? 'Out of Stock' : p.isLow ? 'Low Stock' : 'In Stock'}
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
