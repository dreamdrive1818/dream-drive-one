const LOGO =
  "https://res.cloudinary.com/dcf3mojai/image/upload/v1745574199/dream_drive-removebg-preview_x7duqr.png";

export const MAIL_REV = "dd-mail v2";

function shell(kicker: string, title: string, inner: string) {
  return `<!-- ${MAIL_REV} -->
<div style="margin:0;padding:0;background:#eef3f3;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef3f3;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e3ecec;">
          <tr>
            <td style="padding:26px 32px 18px;text-align:center;background:#ffffff;">
              <img src="${LOGO}" alt="Dream Drive" width="148" style="height:auto;width:148px;border:0;display:inline-block;" />
              <p style="margin:14px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:2.4px;text-transform:uppercase;color:#007c82;font-weight:700;">${kicker}</p>
            </td>
          </tr>
          <tr>
            <td style="height:4px;background:#007c82;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:28px 32px 8px;font-family:Georgia,'Times New Roman',serif;color:#142425;">
              <h1 style="margin:0 0 14px;font-size:26px;line-height:1.25;font-weight:700;text-align:center;color:#142425;">${title}</h1>
              ${inner}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 28px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#6b7f80;">
              Dream Drive · Self-drive · Ranchi<br/>
              Keys when you need them.<br/>
              <span style="color:#98a8a8;">If you did not expect this email, you can ignore it.</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>`;
}

function codeBlock(token: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:8px auto 6px;">
    <tr>
      <td style="background:#f4fafa;border:1px solid #cfe3e3;border-radius:14px;padding:16px 28px;font-family:Consolas,Menlo,monospace;font-size:34px;font-weight:700;letter-spacing:8px;color:#007c82;text-align:center;">${token}</td>
    </tr>
  </table>`;
}

function button(href: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:22px auto 8px;">
    <tr>
      <td style="border-radius:10px;background:#007c82;">
        <a href="${href}" style="display:inline-block;padding:13px 22px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">${label}</a>
      </td>
    </tr>
  </table>`;
}

function note(text: string) {
  return `<p style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#3d5152;text-align:center;">${text}</p>`;
}

function facts(rows: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0 8px;border:1px solid #e4eeee;border-radius:12px;overflow:hidden;">${rows}</table>`;
}

function fact(label: string, value: string, alt = false) {
  const bg = alt ? "background:#f7fbfb;" : "background:#ffffff;";
  return `<tr>
    <td style="${bg}padding:11px 14px;width:132px;font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:0.4px;text-transform:uppercase;color:#6b7f80;">${label}</td>
    <td style="${bg}padding:11px 14px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#142425;font-weight:700;">${value}</td>
  </tr>`;
}

export const NOTIFICATION_TEMPLATES: {
  key: string;
  channel: string;
  subject: string;
  body: string;
}[] = [
  {
    key: "otp",
    channel: "email",
    subject: "Your Dream Drive verification code",
    body: shell(
      "Self-drive · Ranchi",
      "Your sign-in code",
      `${note("Enter this code to continue. It is valid for <strong>5 minutes</strong>.")}
      ${codeBlock("{{code}}")}
      ${note("Never share this code. Dream Drive will not ask for it by phone or chat.")}`
    ),
  },
  {
    key: "booking_confirmed",
    channel: "email",
    subject: "Booking {{publicId}} is confirmed",
    body: shell(
      "Booking confirmed",
      "You're set for the road",
      `${note("Booking <strong>{{publicId}}</strong> is confirmed. We've saved the details below.")}
      ${facts(
        fact("Car", "{{carName}}") +
          fact("Spec", "{{carType}} · {{seats}} seats · {{fuel}} · {{transmission}}", true) +
          fact("Rental", "{{rentalType}}") +
          fact("From", "{{startsAt}}", true) +
          fact("To", "{{endsAt}}") +
          fact("Pickup", "{{branch}}, {{city}}", true) +
          fact("Customer", "{{customerName}}") +
          fact("Hire", "{{amount}}", true)
      )}
      ${button("{{trackUrl}}", "Track your ride")}`
    ),
  },
  {
    key: "payment_receipt",
    channel: "email",
    subject: "Payment receipt {{invoiceNumber}} — {{publicId}}",
    body: shell(
      "Payment received",
      "We've received your payment",
      `${note("Thank you. This receipt is for booking <strong>{{publicId}}</strong>.")}
      ${facts(
        fact("Amount", "{{amount}}") +
          fact("Type", "{{kind}}", true) +
          fact("Invoice", "{{invoiceNumber}}")
      )}
      ${button("{{invoiceUrl}}", "View invoices")}`
    ),
  },
  {
    key: "kyc_decision",
    channel: "email",
    subject: "KYC {{status}} — Dream Drive",
    body: shell(
      "Documents",
      "KYC {{status}}",
      `${note("Your Dream Drive KYC is <strong>{{status}}</strong>.")}
      ${note("{{notes}}")}`
    ),
  },
  {
    key: "leegality_invite",
    channel: "email",
    subject: "Sign your rental agreement — {{publicId}}",
    body: shell(
      "Agreement",
      "Your agreement is ready",
      `${note("Please sign the rental agreement for booking <strong>{{publicId}}</strong>. Self-drive trips are confirmed only after the signature is complete.")}
      ${button("{{signUrl}}", "Sign agreement")}`
    ),
  },
  {
    key: "trip_reminder",
    channel: "email",
    subject: "Trip tomorrow — {{publicId}}",
    body: shell(
      "Trip reminder",
      "Your keys are almost ready",
      `${note("Booking <strong>{{publicId}}</strong> starts <strong>{{startsAt}}</strong>.")}
      ${facts(
        fact("Car", "{{carName}}") +
          fact("Rental", "{{rentalType}}", true) +
          fact("Pickup", "{{branch}}, {{city}}")
      )}
      ${button("{{trackUrl}}", "Track your ride")}`
    ),
  },
  {
    key: "lead_reminder",
    channel: "email",
    subject: "Lead follow-up: {{name}}",
    body: shell(
      "Sales",
      "Time to follow up",
      `${note("Follow up with <strong>{{name}}</strong>.")}
      ${facts(
        fact("Status", "{{status}} · {{source}}") +
          fact("Phone", "{{phone}}", true) +
          fact("Email", "{{email}}") +
          fact("City", "{{city}}", true)
      )}`
    ),
  },
  {
    key: "booking_cancelled",
    channel: "email",
    subject: "Booking {{publicId}} cancelled",
    body: shell(
      "Booking update",
      "This booking is cancelled",
      `${note("Booking <strong>{{publicId}}</strong> was cancelled.")}
      ${facts(
        fact("Refund", "{{refundPct}}%") +
          fact("Amount", "{{refundAmount}}", true)
      )}
      ${note("{{reason}}")}`
    ),
  },
  {
    key: "vehicle_doc_expiry",
    channel: "email",
    subject: "Fleet document expiring: {{registration}} {{kind}}",
    body: shell(
      "Fleet",
      "A document is expiring",
      `${note("<strong>{{kind}}</strong> for {{registration}} needs attention before it lapses.")}
      ${facts(
        fact("Vehicle", "{{registration}}") +
          fact("Model", "{{model}}", true) +
          fact("Base", "{{city}} / {{branch}}") +
          fact("Expires", "{{expires}}", true)
      )}`
    ),
  },
];
