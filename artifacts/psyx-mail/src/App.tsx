import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { setAuthTokenGetter } from "@workspace/api-client-react";

import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Register from "@/pages/register";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import DashboardLayout from "@/components/layout/dashboard-layout";
import DashboardInbox from "@/pages/dashboard/index";
import ComposeEmail from "@/pages/dashboard/compose";
import EmailView from "@/pages/dashboard/email-view";
import AdminPanel from "@/pages/admin/index";
import OwnerPanel from "@/pages/owner/index";
import Profile from "@/pages/profile";

import { ProtectedRoute } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import { PwaInstallBanner } from "@/components/pwa-install-banner";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

setAuthTokenGetter(() => localStorage.getItem("psyx_token"));

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />

      <Route path="/dashboard">
        <ProtectedRoute>
          <DashboardLayout>
            <DashboardInbox />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/dashboard/compose">
        <ProtectedRoute>
          <DashboardLayout>
            <ComposeEmail />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/dashboard/email/:id">
        <ProtectedRoute>
          <DashboardLayout>
            <EmailView />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin">
        <ProtectedRoute>
          <DashboardLayout>
            <AdminPanel />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/owner">
        <ProtectedRoute>
          <DashboardLayout>
            <OwnerPanel />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/profile">
        <ProtectedRoute>
          <DashboardLayout>
            <Profile />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster richColors position="top-right" />
          <PwaInstallBanner />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
