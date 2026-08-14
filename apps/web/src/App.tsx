import { BrowserRouter, Routes, Route } from "react-router";
import { LoginPage } from "./routes/auth/components/LoginPage";
import { SignupPage } from "./routes/auth/components/SingupPage";
import { VerifyEmailPage } from "./routes/auth/components/VerifyEmailPage";
import { ResendVerificationPage } from "./routes/auth/components/ResendVerificationPage";
import { ForgotPasswordPage } from "./routes/auth/components/ForgotPasswordPage";
import { ResetPasswordPage } from "./routes/auth/components/ResetPasswordPage";

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
        {/* change-password is a protected route user must be logged in to change the password */}
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Protected Routes */}
        <Route></Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
