import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { ToastProvider } from '@/components/ToastProvider';
import { useAuth } from '@/contexts/AuthContext';
import LoginPage from '@/pages/auth/LoginPage';
import FarmSelectionPage from '@/pages/auth/FarmSelectionPage';
import NoFarmPage from '@/pages/auth/NoFarmPage';
import Dashboard from '@/pages/Dashboard';
import BatchManagement from '@/pages/poultry/BatchManagement';
import DailyRecording from '@/pages/poultry/DailyRecording';
import DailyReportHistory from '@/pages/poultry/DailyReportHistory';
import ProductManagement from '@/pages/products/ProductManagement';
import PurchaseManagement from '@/pages/purchases/PurchaseManagement';
import PurchaseInvoicePage from '@/pages/purchases/PurchaseInvoicePage';
import SalesManagement from '@/pages/sales/SalesManagement';
import SalesInvoicePage from '@/pages/sales/SalesInvoicePage';
import InventoryDashboard from '@/pages/inventory/InventoryDashboard';
import CustomerManagement from '@/pages/customers/CustomerManagement';
import CustomerProfile from '@/pages/customers/CustomerProfile';
import CustomerPayments from '@/pages/customers/CustomerPayments';
import CustomerReports from '@/pages/customers/CustomerReports';
import SupplierManagement from '@/pages/suppliers/SupplierManagement';
import SupplierProfile from '@/pages/suppliers/SupplierProfile';
import SupplierPayments from '@/pages/suppliers/SupplierPayments';
import SupplierReports from '@/pages/suppliers/SupplierReports';
import PoultryReports from '@/pages/reports/PoultryReports';
import SalesReports from '@/pages/reports/SalesReports';
import PurchaseReports from '@/pages/reports/PurchaseReports';
import InventoryReports from '@/pages/reports/InventoryReports';
import SettingsLayout from '@/pages/settings/SettingsLayout';
import FarmManagement from '@/pages/settings/FarmManagement';
import MembershipManagement from '@/pages/settings/MembershipManagement';
import DataImportExport from '@/pages/settings/DataImportExport';
import ProtectedRoute from '@/components/ProtectedRoute';
import CropsModule from '@/pages/crops/CropsModule';

function AppLoader() {
  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="spinner" />
        <p className="text-secondary mt-3">Loading...</p>
      </div>
    </div>
  );
}

function AuthenticatedApp() {
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/poultry/batches" element={<BatchManagement />} />
          <Route path="/poultry/daily" element={<DailyRecording />} />
          <Route path="/poultry/daily/history" element={<DailyReportHistory />} />
          <Route path="/products" element={<ProductManagement />} />
          <Route path="/purchases" element={<PurchaseManagement />} />
          <Route path="/purchases/new" element={<PurchaseInvoicePage />} />
          <Route path="/purchases/:id" element={<PurchaseInvoicePage />} />
          <Route path="/purchases/:id/edit" element={<PurchaseInvoicePage />} />
          <Route path="/sales" element={<SalesManagement />} />
          <Route path="/sales/new" element={<SalesInvoicePage />} />
          <Route path="/sales/:id" element={<SalesInvoicePage />} />
          <Route path="/sales/:id/edit" element={<SalesInvoicePage />} />
          <Route path="/inventory" element={<InventoryDashboard />} />
          <Route path="/customers" element={<CustomerManagement />} />
          <Route path="/customers/:id" element={<CustomerProfile />} />
          <Route path="/customer-payments" element={<CustomerPayments />} />
          <Route path="/customer-reports" element={<CustomerReports />} />
          <Route path="/suppliers" element={<SupplierManagement />} />
          <Route path="/suppliers/:id" element={<SupplierProfile />} />
          <Route path="/supplier-payments" element={<SupplierPayments />} />
          <Route path="/supplier-reports" element={<SupplierReports />} />
          <Route path="/reports/poultry" element={<PoultryReports />} />
          <Route path="/reports/sales" element={<SalesReports />} />
          <Route path="/reports/purchases" element={<PurchaseReports />} />
          <Route path="/reports/inventory" element={<InventoryReports />} />
          <Route path="/settings" element={<SettingsLayout />} />
          <Route path="/settings/farms" element={<ProtectedRoute permission="farm_management:view"><FarmManagement /></ProtectedRoute>} />
          <Route path="/settings/members" element={<ProtectedRoute permission="members:view"><MembershipManagement /></ProtectedRoute>} />
          <Route path="/settings/import-export" element={<ProtectedRoute permission="import_export:view"><DataImportExport /></ProtectedRoute>} />
          <Route path="/crops" element={<CropsModule />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}

export default function App() {
  const { phase, loading } = useAuth();

  if (loading) return <AppLoader />;

  switch (phase) {
    case 'unauthenticated':
      return (
        <ToastProvider>
          <LoginPage />
        </ToastProvider>
      );
    case 'no_farm':
      return (
        <ToastProvider>
          <NoFarmPage />
        </ToastProvider>
      );
    case 'loading':
      return <AppLoader />;
    default:
      return (
        <ToastProvider>
          <AuthenticatedApp />
        </ToastProvider>
      );
  }
}
