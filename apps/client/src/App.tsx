import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Properties from './pages/Properties';
import PropertyDetail from './pages/PropertyDetail';
import Departments from './pages/Departments';
import Tenants from './pages/Tenants';
import Contracts from './pages/Contracts';
import Meters from './pages/Meters';
import MeterReadings from './pages/MeterReadings';
import Payments from './pages/Payments';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminUsers from './pages/admin/AdminUsers';

import TenantDashboard from './pages/TenantDashboard';
import DepartmentDashboard from './pages/DepartmentDashboard';
import DepartmentBilling from './pages/DepartmentBilling';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            duration: 3500,
            className: 'font-sans',
          }}
        />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="properties" element={<Properties />} />
              <Route path="properties/:id" element={<PropertyDetail />} />
              <Route path="departments" element={<Departments />} />
              <Route path="departments/:id" element={<DepartmentDashboard />} />
              <Route
                path="departments/:id/billing"
                element={<DepartmentBilling />}
              />
              <Route path="tenants" element={<Tenants />} />
              <Route path="tenants/:id" element={<TenantDashboard />} />
              <Route path="contracts" element={<Contracts />} />
              <Route path="meters" element={<Meters />} />
              <Route path="readings" element={<MeterReadings />} />
              <Route path="payments" element={<Payments />} />
              <Route element={<AdminRoute />}>
                <Route path="admin/users" element={<AdminUsers />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
