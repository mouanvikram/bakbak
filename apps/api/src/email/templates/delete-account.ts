
export const accountDeletionEmail = (
  userName: string,
  deletionTime: string
) => `
<!DOCTYPE html>

<html lang="en">

<head>

<meta charset="UTF-8">

<meta name="viewport" content="width=device-width,initial-scale=1.0">

<title>Account Deletion Scheduled</title>

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

<!-- Account Deletion SVG -->

<svg width="80" height="80" viewBox="0 0 64 64" fill="none">

<circle cx="32" cy="32" r="24" fill="#fee2e2"/>

<path
d="M24 24L40 40M40 24L24 40"
stroke="#dc2626"
stroke-width="4"
stroke-linecap="round"/>

</svg>

<h1 style="margin:20px 0 10px;color:#111827;">

Account Deletion Scheduled

</h1>

<p style="color:#6b7280;font-size:16px;">

Hi ${userName},

</p>

<p style="font-size:16px;color:#374151;line-height:1.7;">

Your BakBak account has been scheduled for deletion.

Your account and associated data will be permanently deleted at the following time:

</p>

<div style="
margin:30px 0;
padding:20px;
background:#fef2f2;
border-radius:8px;
border:1px solid #fecaca;
">

<p style="margin:0 0 8px;font-size:14px;color:#6b7280;">

Scheduled deletion time

</p>

<p style="margin:0;font-size:18px;color:#991b1b;font-weight:bold;">

${deletionTime}

</p>

</div>

<p style="font-size:16px;color:#374151;line-height:1.7;">

After this time, your account will no longer be available and the deletion process cannot be reversed.

</p>

<p style="font-size:16px;color:#374151;line-height:1.7;">

If this was a mistake, you can recover your account and keep your data for the next <strong>30 days</strong> — check the separate recovery email we sent alongside this one.

</p>

<hr style="margin:35px 0;border:none;border-top:1px solid #e5e7eb;">

<p style="font-size:14px;color:#374151;line-height:1.7;">

If you requested this account deletion, no further action is required.

</p>

<p style="font-size:14px;color:#374151;line-height:1.7;">

If you did <strong>not</strong> request this deletion, please sign in to your account and secure it immediately.

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