import { useState } from 'react';
import { useToast } from '@/components/ToastProvider';
import CompanyInfoSettings from './CompanyInfoSettings';
import BankManagement from './BankManagement';
import PaymentMethodSettings from './PaymentMethodSettings';
import CategorySettings from './CategorySettings';
import UnitSettings from './UnitSettings';
import NumberingSettings from './NumberingSettings';
import SalesSettings from './SalesSettings';
import PurchaseSettings from './PurchaseSettings';

const SETTINGS_TABS = [
  { key: 'company', icon: 'business', label: 'Company Information' },
  { key: 'banks', icon: 'account_balance', label: 'Bank Management' },
  { key: 'payment-methods', icon: 'payments', label: 'Payment Methods' },
  { key: 'categories', icon: 'category', label: 'Product Categories' },
  { key: 'units', icon: 'straighten', label: 'Units of Measurement' },
  { key: 'numbering', icon: 'tag', label: 'Numbering Sequences' },
  { key: 'sales', icon: 'point_of_sale', label: 'Sales Settings' },
  { key: 'purchase', icon: 'shopping_cart', label: 'Purchase Settings' },
];

export default function SettingsLayout() {
  const [activeTab, setActiveTab] = useState('company');
  const { toast } = useToast();

  function renderContent() {
    switch (activeTab) {
      case 'company': return <CompanyInfoSettings />;
      case 'banks': return <BankManagement />;
      case 'payment-methods': return <PaymentMethodSettings />;
      case 'categories': return <CategorySettings />;
      case 'units': return <UnitSettings />;
      case 'numbering': return <NumberingSettings />;
      case 'sales': return <SalesSettings />;
      case 'purchase': return <PurchaseSettings />;
      default: return <CompanyInfoSettings />;
    }
  }

  return (
    <div className="settings-layout">
      <div className="settings-sidebar">
        <div className="settings-sidebar-header">
          <span className="material-icons-outlined">settings</span>
          <h3>System Settings</h3>
        </div>
        <nav className="settings-nav">
          {SETTINGS_TABS.map(tab => (
            <button
              key={tab.key}
              className={`settings-nav-item ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <span className="material-icons-outlined">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="settings-content">
        {renderContent()}
      </div>
    </div>
  );
}
