import { str } from "@/config/parse";

export const emailConfig = {
	resendApiKey: process.env.RESEND_API_KEY ?? "",
	devInbox: str(process.env.DEV_INBOX, ""),
};
