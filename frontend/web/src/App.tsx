import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { OverviewPage } from '@/pages/OverviewPage'
import { SubscriptionsPage } from '@/pages/SubscriptionsPage'
import { SubscriptionDetailPage } from '@/pages/SubscriptionDetailPage'
import { SubscriptionFormPage } from '@/pages/SubscriptionFormPage'
import { CalendarPage } from '@/pages/CalendarPage'
import { BackupPage, ChannelsPage, ConnectPage, SettingsPage } from '@/pages/SettingsPages'

export default function App() {
  return (
    <Routes>
      <Route path="/connect" element={<ConnectPage />} />
      <Route element={<AppShell />}>
        <Route index element={<OverviewPage />} />
        <Route path="subscriptions" element={<SubscriptionsPage />} />
        <Route path="subscriptions/new" element={<SubscriptionFormPage />} />
        <Route path="subscriptions/:id" element={<SubscriptionDetailPage />} />
        <Route path="subscriptions/:id/edit" element={<SubscriptionFormPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="settings/channels" element={<ChannelsPage />} />
        <Route path="settings/backup" element={<BackupPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
