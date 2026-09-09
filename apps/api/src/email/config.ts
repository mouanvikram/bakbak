import { str } from "@/config/parse";

const resendApiKey = process.env.RESEND_API_KEY;

if (!resendApiKey) {
  throw new Error(
    "RESEND_API_KEY is missing. Set it in the repo-root .env file (see .env.example).",
  );
}

export const emailConfig = {
  resendApiKey,
  devInbox: str(process.env.DEV_INBOX, ""),
};
