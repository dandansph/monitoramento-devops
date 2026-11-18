import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { getToken } from './api';
import { StoreProvider } from './store';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import MapPage from './pages/MapPage';
import AlertsPage from './pages/AlertsPage';
import RulesPage from './pages/RulesPage';
import SecurityPage from './pages/SecurityPage';
import SimulatorPage from './pages/SimulatorPage';
import './styles.css';

function Private() {
  if (!getToken()) return <Navigate to="/login" replace />;
  return (
    <StoreProvider>
      <Layout />
    </StoreProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<Private />}>
          <Route index element={<MapPage />} />
          <Route path="alertas" element={<AlertsPage />} />
          <Route path="regras" element={<RulesPage />} />
          <Route path="seguranca" element={<SecurityPage />} />
          <Route path="simulador" element={<SimulatorPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
