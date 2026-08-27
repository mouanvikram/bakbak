import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { useAuth } from "./context/AuthContext";

import { LoginPage } from "./routes/auth/components/LoginPage";
import { SignupPage } from "./routes/auth/components/SingupPage";
import { VerifyEmailPage } from "./routes/auth/components/VerifyEmailPage";
import { ResendVerificationPage } from "./routes/auth/components/ResendVerificationPage";
import { ForgotPasswordPage } from "./routes/auth/components/ForgotPasswordPage";
import { ResetPasswordPage } from "./routes/auth/components/ResetPasswordPage";

import AppLayout from "./components/layout/AppLayout";
import { AccountPage } from "./routes/settings/AccountPage";
import { SecurityPrivacyPage } from "./routes/settings/SecurityPrivacyPage";
import { NotificationsPage } from "./routes/settings/NotificationsPage";
import { AppearancePage } from "./routes/settings/AppearancePage";
import { ChatSettingsPage } from "./routes/settings/ChatSettingsPage";
import { DevicesPage } from "./routes/settings/DevicesPage";
import { HelpSupportPage } from "./routes/settings/HelpSupportPage";
import { AboutBakbakPage } from "./routes/settings/AboutBakbakPage";
import { FriendsPage, PendingRequestsPage, SearchFriendsPage, SentRequestsPage, SuggestionsPage } from "./routes/friends";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-sm text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null;
  if (isAuthenticated) return <Navigate to="/chats" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public auth routes */}
        <Route
          path="/login"
          element={
            <GuestRoute>
              <LoginPage />
            </GuestRoute>
          }
        />
        <Route
          path="/signup"
          element={
            <GuestRoute>
              <SignupPage />
            </GuestRoute>
          }
        />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/resend-verification" element={<ResendVerificationPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Protected application routes */}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Navigate to="/chats" replace />} />

          {/* Me */}
          <Route path="/me">
            <Route index element={<p>Me Page</p>} />
            <Route path="profile" element={<p>Profile Page</p>} />
          </Route>

          {/* Settings */}
          <Route path="/settings">
            <Route index element={<AccountPage />} />
            <Route path="security_privacy" element={<SecurityPrivacyPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="appearance" element={<AppearancePage />} />
            <Route path="chat_settings" element={<ChatSettingsPage />} />
            <Route path="devices" element={<DevicesPage />} />
            <Route path="help_support" element={<HelpSupportPage />} />
            <Route path="about_bakbak" element={<AboutBakbakPage />} />
          </Route>

          {/* Chat */}
          <Route path="/chats">
            <Route index element={<p>Chat Page</p>} />
            <Route path=":id" element={<p>Chat Page</p>} />
          </Route>

          {/* Calls */}
          <Route path="/calls">
            <Route index element={<p>Calls Page</p>} />
          </Route>

          {/* Friends */}
          <Route path="/friends">
            <Route index element={<FriendsPage />} />
            <Route path="search" element={<SearchFriendsPage />} />
            <Route path="pending" element={<PendingRequestsPage />} />
            <Route path="sent" element={<SentRequestsPage />} />
            <Route path="suggestions" element={<SuggestionsPage />} />
          </Route>

          {/* Notifications */}
          <Route path="/notifications">
            <Route index element={<p>Notifications Page</p>} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
