import { str } from "@/config/parse";
import { requiredAlways } from "@/config/required";

export const emailConfig = {
  // Mandatory everywhere: without it the Resend client fails on first send
  // rather than at boot.
  resendApiKey: requiredAlways(process.env.RESEND_API_KEY, "RESEND_API_KEY"),
  devInbox: str(process.env.DEV_INBOX, ""),
};
