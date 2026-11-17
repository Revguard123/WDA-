// Ported from wda-crm/src/server/email/templates.ts (shared email components and base layout).
// TypeScript types and the CRM-only server marker are removed; HTML, assets, and styles are unchanged.
/* -------------------------------------------------------------------------- */ /* WDA email design system — OTP and Staff Invitation are the visual reference */ /* -------------------------------------------------------------------------- */ export const BRAND = {
    canvas: "#f4f1f3",
    surface: "#ffffff",
    surfaceSoft: "#faf9f9",
    ink: "#1b181a",
    text: "#514b4e",
    muted: "#8b8588",
    faint: "#aaa4a7",
    border: "#e7e3e5",
    borderSoft: "#efedef",
    pink: "#f426a7",
    pinkDark: "#d81782"
};
export const WDA_LOGO = "https://res.cloudinary.com/glkogyco/image/upload/v1791329706/logo.png";
export const WDA_BACKGROUND = "https://res.cloudinary.com/glkogyco/image/upload/v1791330052/login-bg.png";
export const CRM_URL = "https://crm.wardogsacademy.com";
// Clients that support remote fonts use Inter; others fall back to sans-serif.
export const EMAIL_FONT = "'Inter', sans-serif";
/* -------------------------------------------------------------------------- */ /* Safe, reusable email components                                            */ /* -------------------------------------------------------------------------- */ const HTML_ESCAPE_MAP = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
};
export const escapeHtml = (value)=>String(value ?? "").replace(/[&<>"']/g, (character)=>HTML_ESCAPE_MAP[character] ?? character);
export const escapeMultiline = (value)=>escapeHtml(value).replace(/\r\n?|\n/g, "<br>");
export const safeExternalUrl = (value)=>{
    try {
        const url = new URL(value);
        return url.protocol === "https:" || url.protocol === "http:" ? escapeHtml(url.toString()) : "#";
    } catch  {
        return "#";
    }
};
export const safeMailto = (email)=>{
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return "#";
    return escapeHtml(`mailto:${encodeURIComponent(trimmed)}`);
};
export const renderButton = ({ href, label })=>`
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
    style="width:100%;border-spacing:0;border-collapse:collapse;">
    <tr>
      <td align="center" bgcolor="${BRAND.pink}"
        style="background:${BRAND.pink};border-radius:7px;">
        <a href="${safeExternalUrl(href)}" target="_blank"
          style="display:block;padding:15px 22px;font-family:${EMAIL_FONT};font-size:13px;line-height:18px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:7px;">
          ${escapeHtml(label)}
        </a>
      </td>
    </tr>
  </table>`;
export const renderMetaRow = ({ label, value, valueHtml, last = false })=>`
  <tr>
    <td width="135" valign="top"
      style="width:135px;padding:9px 18px 9px 0;${last ? "" : `border-bottom:1px solid ${BRAND.borderSoft};`}font-family:${EMAIL_FONT};font-size:10px;line-height:16px;font-weight:500;letter-spacing:0.35px;text-transform:uppercase;color:${BRAND.muted};">
      ${escapeHtml(label)}
    </td>
    <td valign="top"
      style="padding:9px 0;${last ? "" : `border-bottom:1px solid ${BRAND.borderSoft};`}font-family:${EMAIL_FONT};font-size:11px;line-height:17px;font-weight:400;color:${BRAND.ink};word-break:break-word;">
      ${valueHtml ?? escapeHtml(value)}
    </td>
  </tr>`;
export const renderMetaPanel = (rows)=>{
    if (rows.length === 0) return "";
    return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="width:100%;margin:0 0 22px;border-spacing:0;border-collapse:separate;background:${BRAND.surfaceSoft};border:1px solid ${BRAND.borderSoft};border-radius:8px;font-family:${EMAIL_FONT};">
      <tr><td style="padding:8px 18px;font-family:${EMAIL_FONT};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
          style="width:100%;border-spacing:0;border-collapse:collapse;font-family:${EMAIL_FONT};">
          ${rows.map((row, index)=>renderMetaRow({
            ...row,
            last: index === rows.length - 1
        })).join("")}
        </table>
      </td></tr>
    </table>`;
};
export const renderDetailPanel = (heading, content, spacing = 18)=>`
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
    style="width:100%;margin:0 0 ${spacing}px;border-spacing:0;border-collapse:separate;background:${BRAND.surfaceSoft};border:1px solid ${BRAND.borderSoft};border-radius:8px;font-family:${EMAIL_FONT};">
    <tr><td style="padding:15px 18px;font-family:${EMAIL_FONT};">
      <div style="margin:0 0 7px;font-family:${EMAIL_FONT};font-size:10px;line-height:15px;font-weight:500;letter-spacing:0.35px;text-transform:uppercase;color:${BRAND.muted};">
        ${escapeHtml(heading)}
      </div>
      <div style="font-family:${EMAIL_FONT};font-size:12px;line-height:20px;font-weight:400;color:${BRAND.ink};word-break:break-word;">
        ${escapeMultiline(content)}
      </div>
    </td></tr>
  </table>`;
export function baseEmailLayout({ eyebrow, title, bodyHtml, footerNote, previewText, audience = "staff" }) {
    const safeEyebrow = escapeHtml(eyebrow || "");
    const safeTitle = escapeHtml(title);
    const preview = escapeHtml(previewText || title);
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="x-apple-disable-message-reformatting" content="">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
  <title>${safeTitle}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style type="text/css">
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
    html,body { margin:0 !important;padding:0 !important;width:100% !important;background-color:${BRAND.canvas} !important;font-family:${EMAIL_FONT} !important; }
    body,table,td,div,p,a,h1,h2,h3,span { font-family:${EMAIL_FONT}; }
    table { border-spacing:0 !important;mso-table-lspace:0 !important;mso-table-rspace:0 !important; }
    img { border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic; }
    a { color:${BRAND.pinkDark}; }
    .email-card { border-collapse:separate !important;border-spacing:0 !important; }
    @media only screen and (max-width:640px) {
      .email-wrapper { padding:18px 10px !important; }
      .email-card { width:100% !important; }
      .email-logo-row { padding:24px 22px !important; }
      .email-logo { width:140px !important;max-width:140px !important; }
      .email-content { padding:27px 22px 29px !important; }
      .email-footer { padding:18px 22px 20px !important; }
      .email-title { font-size:25px !important;line-height:31px !important; }
      .otp-code { font-size:29px !important;letter-spacing:7px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;width:100%;background-color:${BRAND.canvas};background-image:url('${WDA_BACKGROUND}');background-repeat:no-repeat;background-position:center top;background-size:cover;font-family:${EMAIL_FONT};">
  <div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;color:transparent;font-family:${EMAIL_FONT};font-size:1px;line-height:1px;mso-hide:all;">
    ${preview}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>
  <!--[if gte mso 9]>
  <v:background xmlns:v="urn:schemas-microsoft-com:vml" fill="t">
    <v:fill type="frame" src="${WDA_BACKGROUND}" color="${BRAND.canvas}" />
  </v:background>
  <![endif]-->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
    background="${WDA_BACKGROUND}"
    style="width:100%;border-spacing:0;background-color:${BRAND.canvas};background-image:url('${WDA_BACKGROUND}');background-repeat:no-repeat;background-position:center top;background-size:cover;font-family:${EMAIL_FONT};">
    <tr>
      <td align="center" class="email-wrapper" style="padding:42px 18px;font-family:${EMAIL_FONT};">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="email-card"
          style="width:600px;max-width:600px;border-collapse:separate !important;border-spacing:0 !important;font-family:${EMAIL_FONT};">
          <tr>
            <td bgcolor="${BRAND.surface}"
              style="padding:0;background:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:12px;font-family:${EMAIL_FONT};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                style="width:100%;border-spacing:0;border-collapse:separate;font-family:${EMAIL_FONT};">
                <tr>
                  <td align="center" class="email-logo-row" bgcolor="${BRAND.surface}"
                    style="padding:29px 34px 27px;background:${BRAND.surface};border-bottom:1px solid ${BRAND.borderSoft};border-radius:11px 11px 0 0;font-family:${EMAIL_FONT};">
                    <a href="${audience === "student" ? "https://www.wardogsacademy.com" : CRM_URL}" target="_blank" style="display:inline-block;text-decoration:none;font-family:${EMAIL_FONT};">
                      <img src="${WDA_LOGO}" width="165" alt="War Dogs Academy" class="email-logo"
                        style="display:block;width:165px;max-width:165px;height:auto;margin:0 auto;">
                    </a>
                  </td>
                </tr>
                <tr>
                  <td class="email-content" bgcolor="${BRAND.surface}"
                    style="padding:34px 38px 36px;background:${BRAND.surface};font-family:${EMAIL_FONT};">
                    ${safeEyebrow ? `
                      <div style="margin:0 0 7px;font-family:${EMAIL_FONT};font-size:10px;line-height:14px;font-weight:500;letter-spacing:0.7px;text-transform:uppercase;color:${BRAND.muted};">${safeEyebrow}</div>` : ""}
                    <h1 class="email-title" style="margin:0 0 14px;padding:0;font-family:${EMAIL_FONT};font-size:29px;line-height:35px;font-weight:500;letter-spacing:-0.4px;color:${BRAND.ink};">
                      ${safeTitle}
                    </h1>
                    <div style="font-family:${EMAIL_FONT};font-size:13px;line-height:21px;font-weight:400;color:${BRAND.text};">
                      ${bodyHtml}
                    </div>
                    ${footerNote ? `
                      <div style="margin-top:26px;padding-top:18px;border-top:1px solid ${BRAND.borderSoft};font-family:${EMAIL_FONT};font-size:10px;line-height:17px;font-weight:400;color:${BRAND.muted};">
                        ${footerNote}
                      </div>` : ""}
                  </td>
                </tr>
                <tr>
                  <td class="email-footer" bgcolor="${BRAND.surface}"
                    style="padding:19px 38px 22px;background:${BRAND.surface};border-top:1px solid ${BRAND.borderSoft};border-radius:0 0 11px 11px;text-align:center;font-family:${EMAIL_FONT};">
                    <div style="font-family:${EMAIL_FONT};font-size:10px;line-height:16px;font-weight:400;color:${BRAND.faint};">
                      War Dogs Academy · ${audience === "student" ? "Student update" : "Private staff communication"}
                    </div>
                    <div style="margin-top:3px;font-family:${EMAIL_FONT};font-size:10px;line-height:16px;font-weight:400;">
                      <a href="${audience === "student" ? "https://www.wardogsacademy.com" : CRM_URL}" target="_blank"
                        style="color:${BRAND.muted};text-decoration:underline;font-family:${EMAIL_FONT};font-weight:400;">
                        ${audience === "student" ? "wardogsacademy.com" : "crm.wardogsacademy.com"}
                      </a>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
} /* -------------------------------------------------------------------------- */  /* OTP — existing master email design                                         */  /* -------------------------------------------------------------------------- */
