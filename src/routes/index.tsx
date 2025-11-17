import { Routes, Route, Navigate } from 'react-router-dom';
import { Login } from '../pages/Login';
import { Home } from '../pages/Home';
import { ChecklistsList } from '../pages/Checklists/List';
import { ChecklistWizard } from '../pages/Checklists/Wizard';
import { ChecklistDetail } from '../pages/Checklists/Detail';
import { InProgressPage } from '../pages/Checklists/InProgress';
import { FinishedPage } from '../pages/Checklists/Finished';
import { ReportsPage } from '../pages/Reports/Reports';
import { VehiclesPage } from '../pages/Vehicles';
import { SuppliersPage } from '../pages/Suppliers';
import { SettingsPage } from '../pages/Settings';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { AdminPage } from '../pages/Admin';
import { DevSeeds } from '../pages/DevSeeds';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/home" element={<ProtectedRoute requireVerifiedEmail={false}><Home /></ProtectedRoute>} />
      <Route path="/checklists" element={<ProtectedRoute requireVerifiedEmail={false}><ChecklistsList /></ProtectedRoute>} />
      <Route path="/checklists/new" element={<ProtectedRoute requireVerifiedEmail={false}><ChecklistWizard mode="new" /></ProtectedRoute>} />
      <Route path="/checklists/:id" element={<ProtectedRoute requireVerifiedEmail={false}><ChecklistDetail /></ProtectedRoute>} />
      <Route path="/checklists/in-progress" element={<ProtectedRoute requireVerifiedEmail={false}><InProgressPage /></ProtectedRoute>} />
      <Route path="/checklists/finished" element={<ProtectedRoute requireVerifiedEmail={false}><FinishedPage /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute requireVerifiedEmail={false}><ReportsPage /></ProtectedRoute>} />
      <Route path="/vehicles" element={<ProtectedRoute requireVerifiedEmail={false}><VehiclesPage /></ProtectedRoute>} />
      <Route path="/suppliers" element={<ProtectedRoute requireVerifiedEmail={false}><SuppliersPage /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute requireAdmin requireVerifiedEmail={false}><AdminPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute requireVerifiedEmail={false}><SettingsPage /></ProtectedRoute>} />
      <Route path="/dev/seeds" element={<DevSeeds />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}