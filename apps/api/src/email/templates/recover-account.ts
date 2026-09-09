export const recoverAccountEmail = (
  userName: string,
  recoveryLink: string,
  daysToRecover = 30,
) => `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Recover Your Account</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f7;padding:40px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:10px;padding:40px;">
<tr><td>
<h1 style="margin:0;color:#111827;">Recover Your Account</h1>
<p style="font-size:16px;color:#374151;line-height:1.6;">Hi ${userName},</p>
<p style="font-size:16px;color:#374151;line-height:1.6;">Your BakBak account has been scheduled for deletion. If you didn't mean to delete it, you can recover it by clicking the button below.</p>
<div style="text-align:center;margin:35px 0;">
<a href="${recoveryLink}" style="background:#2563eb;color:white;padding:14px 30px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:bold;font-size:16px;">Recover Account</a>
</div>
<p style="font-size:14px;color:#6b7280;">If the button doesn't work, use this link:</p>
<p style="word-break:break-all;font-size:14px;"><a href="${recoveryLink}">${recoveryLink}</a></p>
<hr style="margin:35px 0;border:none;border-top:1px solid #e5e7eb;">
<p style="font-size:13px;color:#6b7280;line-height:1.6;">This recovery link expires in <strong>${daysToRecover} days</strong>. After that your account can no longer be recovered.</p>
<p style="font-size:13px;color:#6b7280;line-height:1.6;">If you did not delete your account, someone may have accessed it. Please contact support.</p>
<p style="font-size:13px;color:#9ca3af;margin-top:30px;">© 2026 BakBak</p>
</td></tr></table>
</td></tr></table>
</body></html>
`;