import crypto from "crypto";

export  const hashVerificaitonToken = (token:string) =>{
    return crypto.createHash("sha256").update(token).digest("hex");
}


export const verificationEmail = (verificationLink: string, userName: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Verify Your Email</title>
</head>

<body style="margin:0;padding:0;background:#f4f4f7;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f7;padding:40px 0;">
<tr>
<td align="center">

<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:10px;padding:40px;">
<tr>
<td>

<h1 style="margin:0;color:#111827;">
Verify Your Email
</h1>

<p style="font-size:16px;color:#374151;line-height:1.6;">
Hi ${userName},
</p>

<p style="font-size:16px;color:#374151;line-height:1.6;">
Thanks for signing up! Please verify your email address by clicking the button below.
</p>

<div style="text-align:center;margin:35px 0;">
<a href="${verificationLink}"
style="
background:#16a34a;
color:white;
padding:14px 30px;
text-decoration:none;
border-radius:8px;
display:inline-block;
font-weight:bold;
font-size:16px;">
Verify Email
</a>
</div>

<p style="font-size:14px;color:#6b7280;">
If the button doesn't work, use this link:
</p>

<p style="word-break:break-all;font-size:14px;">
<a href="${verificationLink}">${verificationLink}</a>
</p>

<hr style="margin:35px 0;border:none;border-top:1px solid #e5e7eb;">

<p style="font-size:13px;color:#6b7280;">
This verification link expires in <strong>24 hours</strong>.
</p>

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