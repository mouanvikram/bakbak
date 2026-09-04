export const twoFactorCodeEmail = (
	userName: string,
	code: string,
	expiresInMinutes: number,
) => `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Your verification code</title>
</head>

<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
<tr>
<td align="center">

<table width="600" cellpadding="0" cellspacing="0"
style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,.08);">

<tr>
<td align="center" style="padding:40px;">

<h1 style="margin:0 0 10px;color:#111827;font-size:22px;">
Your verification code
</h1>

<p style="color:#6b7280;font-size:16px;margin:0 0 4px;">
Hi ${userName},
</p>

<p style="font-size:16px;color:#374151;line-height:1.7;">
Use this code to continue. Do not share it with anyone.
</p>

<div style="margin:32px 0;">
<span style="display:inline-block;background:#f3f4f6;border-radius:10px;padding:16px 28px;
font-size:32px;font-weight:bold;letter-spacing:10px;color:#111827;">
${code}
</span>
</div>

<p style="font-size:14px;color:#6b7280;">
This code expires in <strong>${expiresInMinutes} minutes</strong>.
</p>

<hr style="margin:32px 0;border:none;border-top:1px solid #e5e7eb;">

<p style="font-size:14px;color:#374151;">
If you didn't try to sign in or change your security settings, you can ignore
this email — but consider changing your password.
</p>

<p style="margin-top:40px;color:#9ca3af;font-size:13px;">
© 2026 BakBak
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
