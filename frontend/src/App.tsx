import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import ClientLayout from './layouts/ClientLayout'
import PortalLayout from './layouts/PortalLayout'
import type { PortalNavItem } from './layouts/PortalLayout'
import { Toasts } from './components/ui'
import { Otp, Register, Welcome } from './pages/auth'
import { ClientDashboard, MeterPage } from './pages/client/dashboard'
import { ConsumptionPage } from './pages/client/consumption'
import {
  PaymentConfirmed, RechargeAmount, RechargeMethod, RechargeStatus,
  TokenDetailPage, TokenFallback, WavePayment,
} from './pages/client/recharge'
import { PaymentProgressPage } from './pages/client/payment-progress'
import { PaymentErrorPage } from './pages/client/payment-error'
import { TokensPage, TransactionDetail, TransactionsPage } from './pages/client/finance'
import { AlertsPage, AutoRechargePage, DemoPage, ProfilePage, SettingsPage } from './pages/client/settings'
import {
  CieDashboard, CieFraude, CieIncidents, CieMeterDetail, CieMeters,
  CieParametres, CieQualite, CieRapports, CieRecharges, CieTelecom,
} from './pages/cie'
import { AdminAudit, AdminDevices, AdminRechargeLookup, AdminServices, AdminTokens, AdminUsers } from './pages/admin'
import { IconDashboard, IconMeter, IconCreditCard, IconAlertTriangle, IconWifi, IconShield, IconTestTube, IconFileText, IconSettings, IconUsers, IconPlug, IconTicket, IconClipboard, IconServer } from './components/icons'

const cieNav: PortalNavItem[] = [
  { to: '/cie', label: 'Tableau de bord', icon: <IconDashboard />, end: true },
  { to: '/cie/compteurs', label: 'Compteurs', icon: <IconMeter /> },
  { to: '/cie/recharges', label: 'Recharges', icon: <IconCreditCard /> },
  { to: '/cie/incidents', label: 'Incidents', icon: <IconAlertTriangle /> },
  { to: '/cie/telecom', label: 'Télécom', icon: <IconWifi /> },
  { to: '/cie/fraude', label: 'Fraude / anomalies', icon: <IconShield /> },
  { to: '/cie/qualite', label: 'Qualité des données', icon: <IconTestTube /> },
  { to: '/cie/rapports', label: 'Rapports', icon: <IconFileText /> },
  { to: '/cie/parametres', label: 'Paramètres', icon: <IconSettings /> },
]

const adminNav: PortalNavItem[] = [
  { to: '/admin', label: 'Utilisateurs & rôles', icon: <IconUsers />, end: true },
  { to: '/admin/devices', label: 'Devices & credentials', icon: <IconPlug /> },
  { to: '/admin/tokens', label: 'Tokens', icon: <IconTicket /> },
  { to: '/admin/audit', label: 'Audit', icon: <IconClipboard /> },
  { to: '/admin/services', label: 'Monitoring services', icon: <IconServer /> },
]

function AppRoutes() {
  const nav = useNavigate()
  return (
    <Routes>
      {/* Espace public / auth */}
      <Route path="/" element={<Welcome />} />
      <Route path="/inscription" element={<Register onBack={() => nav(-1)} />} />
      <Route path="/verification" element={<Otp />} />

        {/* Espace Client (mobile-first) */}
        <Route path="/app" element={<ClientLayout />}>
          <Route index element={<ClientDashboard />} />
          <Route path="compteur" element={<MeterPage />} />
          <Route path="consommation" element={<ConsumptionPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="transactions/:transactionId" element={<TransactionDetail />} />
          <Route path="tokens" element={<TokensPage />} />
          <Route path="tokens/:tokenId" element={<TokenDetailPage />} />
          <Route path="profil" element={<ProfilePage />} />
          <Route path="parametres" element={<SettingsPage />} />
          <Route path="alertes" element={<AlertsPage />} />
          <Route path="auto-recharge" element={<AutoRechargePage />} />
          <Route path="demo" element={<DemoPage />} />
          <Route path="recharge" element={<RechargeAmount />} />
          <Route path="recharge/moyen" element={<RechargeMethod />} />
          <Route path="recharge/paiement" element={<WavePayment />} />
          <Route path="recharge/confirmation" element={<PaymentConfirmed />} />
          <Route path="recharge/statut" element={<RechargeStatus />} />
          <Route path="recharge/fallback" element={<TokenFallback />} />
          <Route path="recharge/progress" element={<PaymentProgressPage />} />
          <Route path="recharge/error" element={<PaymentErrorPage />} />
        </Route>

        {/* Espace CIE (supervision) */}
        <Route path="/cie" element={<PortalLayout title="Supervision du parc" items={cieNav} accent="CIE Supervision" />}>
          <Route index element={<CieDashboard />} />
          <Route path="compteurs" element={<CieMeters />} />
          <Route path="compteurs/:meterId" element={<CieMeterDetail />} />
          <Route path="recharges" element={<CieRecharges />} />
          <Route path="incidents" element={<CieIncidents />} />
          <Route path="telecom" element={<CieTelecom />} />
          <Route path="fraude" element={<CieFraude />} />
          <Route path="qualite" element={<CieQualite />} />
          <Route path="rapports" element={<CieRapports />} />
          <Route path="parametres" element={<CieParametres />} />
        </Route>

        {/* Espace Admin (technique) */}
        <Route path="/admin" element={<PortalLayout title="Administration" items={adminNav} accent="CIE Admin" />}>
          <Route index element={<AdminUsers />} />
          <Route path="devices" element={<AdminDevices />} />
          <Route path="tokens" element={<AdminTokens />} />
          <Route path="audit" element={<div className="space-y-4"><AdminRechargeLookup /><AdminAudit /></div>} />
          <Route path="services" element={<AdminServices />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      {/* Global (pas dans ClientLayout/PortalLayout) : les pages d'auth (Welcome/Register/
          Otp) sont hors de ces deux layouts et n'affichaient donc jamais leurs notify()
          (erreur de connexion/inscription/OTP) -- l'utilisateur ne voyait rien se passer
          au clic. Retiré des deux layouts pour ne pas dupliquer l'affichage. */}
      <Toasts />
      <AppRoutes />
    </BrowserRouter>
  )
}
