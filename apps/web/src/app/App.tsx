import { BrowserRouter, Route, Navigate, Routes } from "react-router";
import { useAuth } from "@/features/auth/auth-context";
import { SocketProvider } from "@/features/chat/socket-context";
import { PresenceProvider } from "@/features/chat/presence-context";
import {
  ForgotPasswordPage,
  LoginPage,
  ResendVerificationPage,
  ResetPasswordPage,
  SignupPage,
  VerifyEmailPage,
} from "@/features/auth/pages";
import {
  AboutBakbakPage,
  AccountPage,
  AppearancePage,
  ChatSettingsPage,
  DevicesPage,
  HelpSupportPage,
  NotificationsPage,
  SecurityPrivacyPage,
} from "@/features/settings/pages";
import {
  FriendsPage,
  PendingRequestsPage,
  SearchFriendsPage,
  SentRequestsPage,
  SuggestionsPage,
} from "@/features/friends/pages";
import { ChatSidebar } from "@/features/chat/components/ChatSidebar";
import { ChatPage } from "@/features/chat/pages/ChatPage";
import { FriendsSidebar } from "@/features/friends/components/FriendsSidebar";
import { SettingsSidebar } from "@/features/settings/components/SettingsSidebar";
import { CallsSidebar } from "@/features/calls/components/CallsSidebar";
import { ResponsivePage } from "@/components/layout/ResponsivePage";
import { MobilePage } from "@/components/layout/MobilePage";
import { EmptyState } from "@/components/ui/States";
import AppLayout from "@/components/layout/AppLayout";
import { useIsDesktop } from "@/lib/use-media-query";

/**
 * Section landing routes: on desktop the sidebar lives in its own column, so
 * jump straight to the default detail page. On mobile the landing *is* the
 * list of options and tapping one navigates to its page.
 */
function ResponsiveIndex({
  mobile,
  redirectTo,
}: {
  mobile: React.ReactNode;
  redirectTo: string;
}) {
  const isDesktop = useIsDesktop();
  if (isDesktop) return <Navigate to={redirectTo} replace />;
  return <>{mobile}</>;
}

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
              <SocketProvider>
                <PresenceProvider>
                  <AppLayout />
                </PresenceProvider>
              </SocketProvider>
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
            <Route
              index
              element={
                <ResponsiveIndex
                  mobile={<SettingsSidebar />}
                  redirectTo="/settings/account"
                />
              }
            />
            <Route
              path="account"
              element={
                <MobilePage title="Account">
                  <AccountPage />
                </MobilePage>
              }
            />
            <Route
              path="security_privacy"
              element={
                <MobilePage title="Security & Privacy">
                  <SecurityPrivacyPage />
                </MobilePage>
              }
            />
            <Route
              path="notifications"
              element={
                <MobilePage title="Notifications">
                  <NotificationsPage />
                </MobilePage>
              }
            />
            <Route
              path="appearance"
              element={
                <MobilePage title="Appearance">
                  <AppearancePage />
                </MobilePage>
              }
            />
            <Route
              path="chat_settings"
              element={
                <MobilePage title="Chat Settings">
                  <ChatSettingsPage />
                </MobilePage>
              }
            />
            <Route
              path="devices"
              element={
                <MobilePage title="Devices">
                  <DevicesPage />
                </MobilePage>
              }
            />
            <Route
              path="help_support"
              element={
                <MobilePage title="Help & Support">
                  <HelpSupportPage />
                </MobilePage>
              }
            />
            <Route
              path="about_bakbak"
              element={
                <MobilePage title="About BakBak">
                  <AboutBakbakPage />
                </MobilePage>
              }
            />
          </Route>

          {/* Chat */}
          <Route path="/chats">
            <Route
              index
              element={
                <ResponsivePage
                  mobile={<ChatSidebar />}
                  desktop={
                    <div className="flex h-full items-center justify-center">
                      <EmptyState text="Select a chat to start messaging" />
                    </div>
                  }
                />
              }
            />
            <Route path=":id" element={<ChatPage />} />
          </Route>

          {/* Calls */}
          <Route path="/calls">
            <Route
              index
              element={
                <ResponsivePage
                  mobile={<CallsSidebar />}
                  desktop={
                    <div className="flex h-full items-center justify-center">
                      <EmptyState text="Select a call to view details" />
                    </div>
                  }
                />
              }
            />
          </Route>

          {/* Friends */}
          <Route path="/friends">
            <Route
              index
              element={
                <ResponsiveIndex
                  mobile={<FriendsSidebar />}
                  redirectTo="/friends/list"
                />
              }
            />
            <Route
              path="list"
              element={
                <MobilePage title="Friends">
                  <FriendsPage />
                </MobilePage>
              }
            />
            <Route
              path="search"
              element={
                <MobilePage title="Search People">
                  <SearchFriendsPage />
                </MobilePage>
              }
            />
            <Route
              path="pending"
              element={
                <MobilePage title="Pending Requests">
                  <PendingRequestsPage />
                </MobilePage>
              }
            />
            <Route
              path="sent"
              element={
                <MobilePage title="Sent Requests">
                  <SentRequestsPage />
                </MobilePage>
              }
            />
            <Route
              path="suggestions"
              element={
                <MobilePage title="Suggestions">
                  <SuggestionsPage />
                </MobilePage>
              }
            />
          </Route>

          {/* Notifications */}
          <Route path="/notifications">
            <Route index element={<p>Notifications Page</p>} />
          </Route>
        </Route>

        {/* Fallback: redirect to a sensible page depending on auth state */}
        <Route
          path="*"
          element={
            <ProtectedRoute>
              <Navigate to="/chats" replace />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;