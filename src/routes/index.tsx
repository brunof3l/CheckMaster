import { Routes, Route, Navigate } from 'react-router-dom';
import { Login } from '../pages/Login';
import { Home } from '../pages/Home';
import { ChecklistsList } from '../pages/Checklists/List';
import { ChecklistWizard } from '../pages/Checklists/Wizard';
import { VehiclesPage } from '../pages/Vehicles';
import { SuppliersPage } from '../pages/Suppliers';
import { SettingsPage } from '../pages/Settings';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { DevSeeds } from '../pages/DevSeeds';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
      <Route path="/checklists" element={<ProtectedRoute><ChecklistsList /></ProtectedRoute>} />
      <Route path="/checklists/new" element={<ProtectedRoute><ChecklistWizard mode="new" /></ProtectedRoute>} />
      <Route path="/checklists/:id" element={<ProtectedRoute><ChecklistWizard mode="edit" /></ProtectedRoute>} />
      <Route path="/vehicles" element={<ProtectedRoute><VehiclesPage /></ProtectedRoute>} />
      <Route path="/suppliers" element={<ProtectedRoute><SuppliersPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="/dev/seeds" element={<DevSeeds />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}