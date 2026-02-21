import { BrowserRouter, Routes, Route } from 'react-router-dom';
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

import TenantDashboard from './pages/TenantDashboard';
import DepartmentDashboard from './pages/DepartmentDashboard';
import DepartmentBilling from './pages/DepartmentBilling';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="properties" element={<Properties />} />
          <Route path="properties/:id" element={<PropertyDetail />} />
          <Route path="departments" element={<Departments />} />
          <Route path="departments/:id" element={<DepartmentDashboard />} />
          <Route path="departments/:id/billing" element={<DepartmentBilling />} />
          <Route path="tenants" element={<Tenants />} />
          <Route path="tenants/:id" element={<TenantDashboard />} />
          <Route path="contracts" element={<Contracts />} />
          <Route path="meters" element={<Meters />} />
          <Route path="readings" element={<MeterReadings />} />
          <Route path="payments" element={<Payments />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
