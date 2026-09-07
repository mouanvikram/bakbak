const alertLayout = (title: string, body: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
</head>

<body style="margin:0;padding:0;background:#f4f4f7;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f7;padding:40px 0;">
<tr>
<td align="center">

<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:10px;padding:40px;">
<tr>
<td>

<h1 style="margin:0;color:#111827;">
${title}
</h1>

${body}

<hr style="margin:35px 0;border:none;border-top:1px solid #e5e7eb;">

<p style="font-size:13px;color:#9ca3af;margin-top:30px;">
© 2026 Your Company
</p>

</td>
</tr>
</table>

</td>
</tr>
</table>
</body>
</html>
`;

export const passwordChangedEmail = (userName: string, occurred: string) =>
	alertLayout(
		"Your password was changed",
		`
<p style="font-size:16px;color:#374151;line-height:1.6;">
Hi ${userName},
</p>

<p style="font-size:16px;color:#374151;line-height:1.6;">
The password for your account was just changed (${occurred}). If this
wasn't you, reset it immediately and revoke your sessions.
</p>
`,
	);

export const newDeviceLoginEmail = (userName: string, userAgent: string) =>
	alertLayout(
		"New sign-in to your account",
		`
<p style="font-size:16px;color:#374151;line-height:1.6;">
Hi ${userName},
</p>

<p style="font-size:16px;color:#374151;line-height:1.6;">
Your account was just signed in to from a new session.
</p>

<p style="font-size:14px;color:#6b7280;line-height:1.6;background:#f9fafb;padding:14px;border-radius:8px;">
Browser / device: <strong>${userAgent}</strong>
</p>

<p style="font-size:16px;color:#374151;line-height:1.6;">
If this wasn't you, change your password and sign out on all devices.
</p>
`,
	);