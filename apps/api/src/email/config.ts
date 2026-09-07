// Email module config — provider credentials and the non-production
// redirect inbox (non-prod mail never reaches real recipients).
export const emailConfig = {
	resendApiKey: process.env.RESEND_API_KEY ?? "",
	devInbox: "mouanvikram@gmail.com",
};
