import { BrowserRouter, Routes, Route } from "react-router";

import { LoginPage } from "./routes/auth/components/LoginPage";
import { SignupPage } from "./routes/auth/components/SingupPage";
import { VerifyEmailPage } from "./routes/auth/components/VerifyEmailPage";
import { ResendVerificationPage } from "./routes/auth/components/ResendVerificationPage";
import { ForgotPasswordPage } from "./routes/auth/components/ForgotPasswordPage";
import { ResetPasswordPage } from "./routes/auth/components/ResetPasswordPage";

import AppLayout from "./components/layout/AppLayout";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Authentication Routes */}
        <Route path="/" element={<p>This is home Page</p>} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />

        <Route
          path="/resend-verification"
          element={<ResendVerificationPage />}
        />

        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Application Layout */}
        <Route element={<AppLayout />}>
          {/* Me */}
          <Route path="/me">
            <Route index element={<p>Me Page</p>} />

            <Route path="profile" element={<p>Profile Page</p>} />
          </Route>

          {/* Settings */}
          <Route path="/settings">
            {/* <Route index element={<p>Settings Page</p>} /> */}
            <Route index element={<p>Account Page</p>} />
            <Route
              path="security_privacy"
              element={<p>Security & Privacy Page</p>}
            />
            <Route path="notifications" element={<p>Notifications Page</p>} />
            <Route path="appearance" element={<p>Appearance Page</p>} />
            <Route path="chat_settings" element={<p>Chat Settings Page</p>} />
            {/* <Route path="data_storage" element={<p>Data & Storage Page</p>} /> */}
            <Route path="devices" element={<p>Devices Page</p>} />
            <Route path="help_support" element={<p>Help & Support Page</p>} />
            <Route path="about_bakbak" element={<p>About BakBak Page</p>} />
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
            <Route index element={<p>Friends Page</p>} />
            <Route path="search" element={<p>Search Friends</p>} />
            <Route path="pending" element={<p>PendingRequests Page</p>} />
            <Route path="sent" element={<p>SentRequests Page</p>} />
            <Route path="suggestions" element={<p>Suggestions Page</p>} />
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
