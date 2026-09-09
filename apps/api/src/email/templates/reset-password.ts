export const resetPasswordEmail = (userName: string, resetLink: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Reset Your Password</title>
</head>

<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
<tr>
<td align="center">

<table width="600" cellpadding="0" cellspacing="0"
style="
background:#fff;
border-radius:12px;
overflow:hidden;
box-shadow:0 8px 30px rgba(0,0,0,.08);
">

<tr>
<td align="center" style="padding:40px 40px 20px;">

<!-- Lock SVG -->
<svg width="80" height="80" viewBox="0 0 64 64" fill="none">
<rect x="16" y="28" width="32" height="24" rx="4" fill="#2563eb"/>
<path d="M22 28V20C22 14.5 26.5 10 32 10C37.5 10 42 14.5 42 20V28"
stroke="#2563eb" stroke-width="4"/>
<circle cx="32" cy="40" r="3" fill="white"/>
</svg>

<h1 style="margin:20px 0 10px;color:#111827;">
Reset Your Password
</h1>

<p style="color:#6b7280;font-size:16px;">
Hi ${userName},
</p>

<p style="font-size:16px;color:#374151;line-height:1.7;">
We received a request to reset the password for your account.
Click the button below to choose a new password.
</p>

<div style="margin:35px 0;">
<a href="${resetLink}"
style="
background:#2563eb;
padding:14px 34px;
border-radius:8px;
color:white;
font-weight:bold;
text-decoration:none;
display:inline-block;">
Reset Password
</a>
</div>

<p style="font-size:14px;color:#6b7280;">
This link expires in <strong>30 minutes</strong>.
</p>

<hr style="margin:35px 0;border:none;border-top:1px solid #e5e7eb;">

<p style="font-size:14px;color:#374151;">
Didn't request a password reset?
You can safely ignore this email. Your password will remain unchanged.
</p>

<p style="margin-top:25px;font-size:13px;color:#9ca3af;">
If the button doesn't work, copy and paste this link:
</p>

<p style="word-break:break-all;">
<a href="${resetLink}">
${resetLink}
</a>
</p>

<p style="margin-top:40px;color:#9ca3af;font-size:13px;">
© 2026 SealChat
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
