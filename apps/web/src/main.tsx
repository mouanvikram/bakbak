import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ThemeProvider } from "@/features/settings/ThemeProvider";
import { ChatPreferencesProvider } from "@/features/settings/ChatPreferencesProvider";
import { NotificationsProvider } from "@/features/settings/NotificationsProvider";
import { ToastProvider } from "@/components/ui/Toast";
import App from "./app/App";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <ThemeProvider>
        <ChatPreferencesProvider>
          <NotificationsProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </NotificationsProvider>
        </ChatPreferencesProvider>
      </ThemeProvider>
    </AuthProvider>
  </StrictMode>,
);
