const LOGO =
  "https://res.cloudinary.com/dcf3mojai/image/upload/v1745574199/dream_drive-removebg-preview_x7duqr.png";

function shell(inner: string) {
  return `<div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;border:1px solid #ddd;border-radius:10px;padding:24px;background:#fff;">
  <div style="text-align:center;margin-bottom:20px;">
    <img src="${LOGO}" alt="Dream Drive" style="height:60px;" />
  </div>
  ${inner}
  <p style="margin-top:28px;font-size:12px;color:#999;text-align:center;">Dream Drive · Ranchi. If you did not expect this email, you can ignore it.</p>
</div>`;
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
    subject: "Verify your email — Dream Drive OTP",
    body: shell(`
    <h2 style="color:#111;text-align:center;margin:0;">Email verification</h2>
    <p style="text-align:center;color:#333;">Use the OTP below. It is valid for <strong>5 minutes</strong>. Do not share it.</p>
    <div style="text-align:center;margin:24px 0;">
      <div style="display:inline-block;padding:18px 30px;background:#f4f6fb;border-radius:10px;font-size:30px;font-weight:bold;color:#2d63c8;letter-spacing:4px;">{{code}}</div>
    </div>`),
  },
  {
    key: "booking_confirmed",
    channel: "email",
    subject: "Booking {{publicId}} confirmed",
    body: shell(`
    <h2 style="color:#f4b400;text-align:center;">Booking confirmed</h2>
    <p style="text-align:center;">Your Dream Drive booking <strong>{{publicId}}</strong> is confirmed.</p>
    <h3>Car</h3>
    <p><strong>Name:</strong> {{carName}}<br/><strong>Type:</strong> {{carType}} · {{seats}} seats · {{fuel}} · {{transmission}}</p>
    <h3>Trip</h3>
    <p><strong>Rental:</strong> {{rentalType}}<br/><strong>From:</strong> {{startsAt}}<br/><strong>To:</strong> {{endsAt}}<br/><strong>Pickup:</strong> {{branch}}, {{city}}</p>
    <h3>Customer</h3>
    <p>{{customerName}} · hire {{amount}}</p>
    <div style="text-align:center;margin-top:20px;">
      <a href="{{trackUrl}}" style="padding:10px 20px;background:#28a745;color:#fff;border-radius:6px;text-decoration:none;">Track your ride</a>
    </div>`),
  },
  {
    key: "payment_receipt",
    channel: "email",
    subject: "Payment receipt {{invoiceNumber}} — {{publicId}}",
    body: shell(`
    <h2 style="text-align:center;">Payment received</h2>
    <p>We received <strong>{{amount}}</strong> ({{kind}}) for booking <strong>{{publicId}}</strong>.</p>
    <p>Invoice <strong>{{invoiceNumber}}</strong>. Download it from your account invoices page.</p>
    <div style="text-align:center;margin-top:20px;">
      <a href="{{invoiceUrl}}" style="padding:10px 20px;background:#007bff;color:#fff;border-radius:6px;text-decoration:none;">View invoices</a>
    </div>`),
  },
  {
    key: "kyc_decision",
    channel: "email",
    subject: "KYC {{status}}",
    body: shell(`
    <h2 style="text-align:center;">KYC {{status}}</h2>
    <p>Your Dream Drive KYC is <strong>{{status}}</strong>.</p>
    <p>{{notes}}</p>`),
  },
  {
    key: "leegality_invite",
    channel: "email",
    subject: "Sign your rental agreement — {{publicId}}",
    body: shell(`
    <h2 style="text-align:center;">Agreement ready to sign</h2>
    <p>Please sign the rental agreement for booking <strong>{{publicId}}</strong>. Self-drive trips are confirmed only after signature.</p>
    <div style="text-align:center;margin-top:20px;">
      <a href="{{signUrl}}" style="padding:10px 20px;background:#007bff;color:#fff;border-radius:6px;text-decoration:none;">Sign agreement</a>
    </div>`),
  },
  {
    key: "trip_reminder",
    channel: "email",
    subject: "Trip tomorrow — {{publicId}}",
    body: shell(`
    <h2 style="text-align:center;">Your trip is coming up</h2>
    <p>Booking <strong>{{publicId}}</strong> starts <strong>{{startsAt}}</strong> at {{branch}}, {{city}}.</p>
    <p>{{carName}} · {{rentalType}}</p>
    <div style="text-align:center;margin-top:20px;">
      <a href="{{trackUrl}}" style="padding:10px 20px;background:#28a745;color:#fff;border-radius:6px;text-decoration:none;">Track your ride</a>
    </div>`),
  },
  {
    key: "lead_reminder",
    channel: "email",
    subject: "Lead follow-up: {{name}}",
    body: shell(`
    <h2 style="text-align:center;">Lead reminder</h2>
    <p>Follow up with <strong>{{name}}</strong> ({{status}} · {{source}}).</p>
    <p>{{phone}} · {{email}} · {{city}}</p>`),
  },
  {
    key: "booking_cancelled",
    channel: "email",
    subject: "Booking {{publicId}} cancelled",
    body: shell(`
    <h2 style="text-align:center;">Booking cancelled</h2>
    <p>Booking <strong>{{publicId}}</strong> was cancelled. Refund {{refundPct}}% ({{refundAmount}}).</p>
    <p>{{reason}}</p>`),
  },
  {
    key: "vehicle_doc_expiry",
    channel: "email",
    subject: "Fleet document expiring: {{registration}} {{kind}}",
    body: shell(`
    <h2>Fleet document expiring</h2>
    <p><strong>{{kind}}</strong> for {{registration}} ({{model}}) at {{city}} / {{branch}} expires on {{expires}}.</p>`),
  },
];
