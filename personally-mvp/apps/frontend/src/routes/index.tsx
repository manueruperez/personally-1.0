import { createBrowserRouter, Navigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/templates/DashboardLayout';
import { AuthLayout } from '@/components/templates/AuthLayout';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ClientsPage } from '@/pages/ClientsPage';
import { ClientDetailPage } from '@/pages/ClientDetailPage';
import { PlanEditorPage } from '@/pages/PlanEditorPage';
import { ExercisesPage } from '@/pages/ExercisesPage';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { AgentPage } from '@/pages/AgentPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { PrivacyPage } from '@/pages/PrivacyPage';

// Anotacion explicita: sin ella, la emision de declaraciones falla con TS2742
// (tipo inferido no portable entre node_modules de pnpm).
export const router: ReturnType<typeof createBrowserRouter> = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [{ path: '/login', element: <LoginPage /> }],
  },
  {
    element: <DashboardLayout />,
    children: [
      { path: '/', element: <DashboardPage /> },
      { path: '/clients', element: <ClientsPage /> },
      { path: '/clients/:id', element: <ClientDetailPage /> },
      { path: '/clients/:clientId/plans/:planId', element: <PlanEditorPage /> },
      { path: '/exercises', element: <ExercisesPage /> },
      { path: '/notifications', element: <NotificationsPage /> },
      { path: '/agent', element: <AgentPage /> },
      { path: '/settings', element: <SettingsPage /> },
    ],
  },
  // Publica y fuera de todo layout con auth: Meta la exige para publicar la
  // app, y la revisa un bot sin sesion iniciada.
  { path: '/privacy', element: <PrivacyPage /> },
  { path: '*', element: <NotFoundPage /> },
  { path: '/404', element: <NotFoundPage /> },
  { path: '/home', element: <Navigate to="/" replace /> },
]);
