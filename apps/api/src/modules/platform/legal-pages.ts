/**
 * Canonical legal CMS pages for Dream Drive.
 * Bump LEGAL_CONTENT_VERSION when bodies change so API bootstrap re-upserts them.
 */
export const LEGAL_CONTENT_VERSION = "2026-11-19";

export type LegalPageSeed = {
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  metaTitle: string;
  metaDescription: string;
  sortOrder: number;
};

const CONTACT_BLOCK = `<p><strong>Dream Drive</strong><br/>
105 Jagriti Bhawan, near Adarsh Nagar, Bariatu, Ranchi - 834009, Jharkhand<br/>
Phone: <a href="tel:+919942027772">+91-994-202-7772</a><br/>
Email: <a href="mailto:Dreamdrive1818@gmail.com">Dreamdrive1818@gmail.com</a></p>`;

export const LEGAL_PAGES: LegalPageSeed[] = [
  {
    slug: "terms",
    title: "Terms and Conditions",
    excerpt:
      "Please read these hire terms carefully before booking or paying a token with Dream Drive.",
    metaTitle: "Terms and Conditions | Dream Drive",
    metaDescription:
      "Full hire terms for Dream Drive self-drive and chauffeur car rentals in Ranchi, Jharkhand.",
    sortOrder: 1,
    body: `<p><em>Last updated: 19 November 2026</em></p>
<p>These Terms and Conditions (“Terms”) form a binding agreement between <strong>Dream Drive</strong> (operated by its partners, including Subham Keshri and Pooja Kumari of Dream Drive Pvt. Ltd., “Company”, “we”, “us”) and the person who books, pays for, or drives a vehicle hired through our website, app, or branch (“Customer”, “you”). By creating an account, paying a booking token, completing KYC, or signing a rental agreement, you accept these Terms.</p>

<h2>1. Definitions</h2>
<ul>
<li><strong>Company / Car Hire Company:</strong> Dream Drive and authorised staff or partners acting for us.</li>
<li><strong>Vehicle:</strong> The car allocated to your booking, including accessories, keys, documents, GPS, and tools supplied with it.</li>
<li><strong>Customer / Hirer:</strong> The individual named on the booking who is responsible for payment, KYC, and care of the Vehicle.</li>
<li><strong>Additional Driver:</strong> Any other person we have verified and approved in writing to drive the Vehicle.</li>
<li><strong>Booking:</strong> A reservation for self-drive or with-driver hire for stated dates, times, and product type.</li>
<li><strong>Token:</strong> The advance amount paid to reserve the Vehicle; it is not the full rental charge unless stated otherwise.</li>
<li><strong>Security Deposit:</strong> A refundable amount held against damage, fines, fuel shortfall, excess km, or other charges.</li>
</ul>

<h2>2. Eligibility</h2>
<ul>
<li>You must be at least <strong>18 years</strong> old (or such higher age as required for the selected car) and hold a valid driving licence recognised in India.</li>
<li>Self-drive bookings require successful KYC (licence, government ID, and any address proof we request) before handover.</li>
<li>We may refuse or cancel a booking if documents are incomplete, appear forged, or do not match the booking details.</li>
<li>Only the Customer and approved Additional Drivers may operate a self-drive Vehicle.</li>
</ul>

<h2>3. Bookings, quotes &amp; token payment</h2>
<ul>
<li>Quotes on the website or app are estimates based on the details you enter. Final charges may change if dates, city, extras, delivery, or vehicle availability change.</li>
<li>Paying the Token reserves the selected car subject to availability, KYC, and these Terms. The Token amount is shown before payment.</li>
<li>Before Token payment we confirm your full name, date of birth, email, and mobile number.</li>
<li>The remaining rental amount, Security Deposit (if applicable), delivery fees, and any extras are payable before the Vehicle is handed over.</li>
<li>Promotional codes are subject to their own rules and may be withdrawn without notice.</li>
</ul>

<h2>4. Vehicle usage (self-drive)</h2>
<ul>
<li>Drive only with a valid licence and in a fit condition — never under the influence of alcohol, drugs, fatigue, or illness.</li>
<li>GPS tracking is mandatory. Tampering with, disabling, or removing tracking devices is treated as theft and may be reported to police.</li>
<li>Minor damages up to ₹10,000 (or the amount stated on your booking) are the Customer’s responsibility and payable in cash or as deducted from the deposit.</li>
<li>For major incidents, insurance may apply; you remain responsible for deductibles, loss-of-use fees, claim processing costs, and delays you cause.</li>
<li>Drunk driving, illegal use, or total loss may make you fully liable for repair or replacement cost beyond insurance.</li>
<li>We may terminate the hire immediately if these Terms are breached.</li>
</ul>

<h3>Prohibited uses</h3>
<ul>
<li>Overloading passengers or cargo beyond the Vehicle’s rated capacity</li>
<li>Towing, racing, speed trials, or off-road driving</li>
<li>Subleasing, ride-sharing, taxi, or commercial passenger service</li>
<li>Transport of animals (unless we agree in writing), hazardous or illegal goods</li>
<li>Smoking or consuming alcohol inside the Vehicle</li>
<li>Travel outside Jharkhand without our prior written consent</li>
<li>Any use that voids manufacturer or insurance cover</li>
</ul>

<h2>5. With-driver / chauffeur bookings</h2>
<ul>
<li>Our chauffeur drives the Vehicle. You must not demand unsafe speeds, illegal stops, or overload the car.</li>
<li>Waiting, night charges, interstate permits, tolls, parking, and driver allowances follow the package shown at booking or as communicated by support.</li>
<li>The chauffeur’s instructions on route safety and duty hours must be respected.</li>
</ul>

<h2>6. Delivery, handover &amp; return</h2>
<ul>
<li>Pickup and return are at the branch or doorstep location agreed in the booking, within the stated service area (primarily Ranchi and other active cities).</li>
<li>Inspect the Vehicle at handover. Note odometer, fuel level, and visible damage in the inspection record or photos. Complaints about pre-existing damage are valid only if raised at handover or within <strong>T+2 days</strong> of return where we allow post-return review.</li>
<li>Return the Vehicle clean, with fuel at the agreed level, on time, and with all documents and accessories.</li>
<li>Late return may attract hourly or daily extension charges and may affect the next booking.</li>
</ul>

<h2>7. Fuel, mileage &amp; extras</h2>
<ul>
<li>Unless your package says otherwise, return fuel must match the level at delivery. Shortfall is charged at prevailing rates plus a service fee if stated on the booking.</li>
<li>Packages include a km allowance where shown. Extra kilometre charges apply beyond that allowance.</li>
<li>Tolls, parking, FASTAG top-ups, interstate taxes, and similar third-party costs are payable by you unless expressly included.</li>
</ul>

<h2>8. Damage, theft &amp; insurance</h2>
<ul>
<li>You must secure the Vehicle, lock it when unattended, and use the parking brake on slopes.</li>
<li>In case of accident, theft, or breakdown: ensure safety, contact emergency services if needed, inform Dream Drive immediately, and cooperate with insurance and police as required.</li>
<li>Do not arrange major repairs yourself without our written approval.</li>
<li>Insurance cover is subject to the insurer’s policy. Exclusions (e.g. DUI, unauthorised drivers, prohibited use) remain your liability.</li>
</ul>

<h2>9. Traffic fines &amp; violations</h2>
<p>All traffic, parking, challan, and camera fines during the hire period are your responsibility. We may charge the fine amount plus an administration fee. Challenges or disputes about fines should be raised within <strong>T+7 days</strong> of return.</p>

<h2>10. Illegal use</h2>
<p>Any unlawful activity involving the Vehicle during the rental period is attributed to the Customer. We may terminate the hire, forfeit applicable amounts, and share information with law enforcement.</p>

<h2>11. Extensions</h2>
<p>Extensions must be requested before the scheduled return, approved by us, and prepaid. Continuing to keep the Vehicle without approval may be treated as unauthorised use and may lead to recovery action, extra charges, and legal proceedings.</p>

<h2>12. Cancellation &amp; refunds</h2>
<p>Cancellation and Token refunds follow our <a href="/legal/cancellation">Cancellation &amp; Refund Policy</a> and the band shown for your product type and hours before trip start. Dream Drive may refuse handover or cancel without Token refund if KYC fails, documents are invalid, or these Terms are breached.</p>

<h2>13. Security deposit</h2>
<ul>
<li>Self-drive (and some other) bookings require a Security Deposit shown before payment.</li>
<li>Deposits are released after return inspection, subject to deductions for damage, fuel, fines, excess km, cleaning, or other amounts due.</li>
<li>Release timelines depend on payment method and bank processing; we initiate refund of the eligible balance after clearance.</li>
</ul>

<h2>14. Platform accounts &amp; communications</h2>
<ul>
<li>Keep your login, phone, and email secure and up to date. OTPs and booking alerts sent to your registered contacts are deemed received.</li>
<li>You authorise us to contact you by call, SMS, WhatsApp, email, or in-app message about bookings, KYC, payments, and service updates.</li>
</ul>

<h2>15. Limitation of liability</h2>
<p>To the fullest extent permitted by law, Dream Drive is not liable for indirect, incidental, or consequential losses (including missed flights, events, or business). Our total liability for a booking is limited to the hire charges paid for that booking, except where liability cannot be limited under applicable law (including proven gross negligence or wilful misconduct).</p>

<h2>16. Changes to these Terms</h2>
<p>We may update these Terms from time to time. The version published on our website at the time of your Token payment or agreement signature applies to that booking. Material changes will be reflected with an updated “Last updated” date.</p>

<h2>17. Governing law &amp; jurisdiction</h2>
<p>These Terms are governed by the laws of India. Subject to mandatory consumer protections, disputes are subject to the exclusive jurisdiction of the courts at <strong>Ranchi, Jharkhand</strong> (including the High Court of Jharkhand where applicable). We prefer to resolve issues amicably via our support team first.</p>

<h2>18. Contact</h2>
${CONTACT_BLOCK}`,
  },
  {
    slug: "privacy",
    title: "Privacy Policy",
    excerpt:
      "How Dream Drive collects, uses, stores, and shares your personal information.",
    metaTitle: "Privacy Policy | Dream Drive",
    metaDescription:
      "Dream Drive privacy policy — booking data, KYC, payments, cookies, and your rights under Indian law.",
    sortOrder: 2,
    body: `<p><em>Last updated: 19 November 2026</em></p>
<p>This Privacy Policy explains how <strong>Dream Drive</strong> (“we”, “us”) handles personal information when you use our website, apps, WhatsApp, phone support, or branch services. We respect your privacy and process data to fulfil rentals, payments, KYC, safety, and support.</p>

<h2>1. Who we are</h2>
${CONTACT_BLOCK}
<p>For privacy requests, email us at the address above with the subject “Privacy request”.</p>

<h2>2. Information we collect</h2>
<h3>Account &amp; contact</h3>
<ul>
<li>Name, date of birth, mobile number, email address</li>
<li>Login identifiers and authentication data (including OTP verification)</li>
</ul>
<h3>Booking &amp; trip</h3>
<ul>
<li>Pickup/drop locations, dates, times, rental type, selected vehicle</li>
<li>Quotes, invoices, coupons, delivery preferences, and trip status</li>
<li>Communications with support (calls, chats, tickets)</li>
</ul>
<h3>KYC &amp; eligibility</h3>
<ul>
<li>Driving licence details and images</li>
<li>Government ID and address proof as required for self-drive</li>
<li>Verification status and notes needed to approve handover</li>
</ul>
<h3>Payments</h3>
<ul>
<li>Token, balance, deposit, and refund amounts</li>
<li>Payment status and references from our payment partner (e.g. Razorpay). We do not store full card numbers on our servers.</li>
</ul>
<h3>Agreements &amp; signatures</h3>
<ul>
<li>Rental agreement content, e-sign status, and related audit metadata via our e-sign partner where used</li>
</ul>
<h3>Device &amp; usage</h3>
<ul>
<li>IP address, browser/app type, approximate location (if you allow), pages viewed, and cookies or similar technologies — see our <a href="/legal/cookies">Cookie Policy</a></li>
</ul>
<h3>Vehicle telemetry (self-drive)</h3>
<ul>
<li>GPS and related tracking needed for fleet safety, theft prevention, and service recovery during an active hire</li>
</ul>

<h2>3. How we use information</h2>
<ul>
<li>Create and manage your account and bookings</li>
<li>Process payments, deposits, refunds, and invoices</li>
<li>Complete KYC and decide on vehicle handover</li>
<li>Generate and facilitate signing of rental agreements</li>
<li>Provide customer support and send trip-critical notifications</li>
<li>Improve safety, prevent fraud, and enforce our Terms</li>
<li>Comply with legal, tax, accounting, and regulatory duties</li>
<li>Send optional offers or newsletters where you have opted in or as permitted by law — you may opt out of marketing messages</li>
</ul>

<h2>4. Legal bases (India)</h2>
<p>We process personal data for purposes connected with your booking and our legitimate business needs, including performance of a contract, compliance with law, and — where required — with your consent (for example certain KYC document uploads or marketing). Where the Digital Personal Data Protection Act, 2023 and related rules apply, we act as a Data Fiduciary for the processing described here.</p>

<h2>5. Sharing of information</h2>
<p>We do <strong>not</strong> sell your personal data. We may share limited data with:</p>
<ul>
<li><strong>Payment processors</strong> to collect or refund amounts</li>
<li><strong>KYC / e-sign / SMS / email / WhatsApp providers</strong> to verify identity, send OTPs, and complete agreements</li>
<li><strong>Fleet partners, chauffeurs, and branch staff</strong> who need trip details to deliver the service</li>
<li><strong>Insurers, surveyors, and law enforcement</strong> when required for claims, accidents, or legal process</li>
<li><strong>Professional advisers and authorities</strong> for tax, audit, or court orders</li>
</ul>
<p>Service providers are expected to use data only to perform services for us and to protect it appropriately.</p>

<h2>6. Retention</h2>
<p>We keep booking, payment, KYC, and agreement records for as long as needed to provide the service, handle disputes, and meet legal retention periods (including tax and accounting). When data is no longer required, we delete or anonymise it where feasible.</p>

<h2>7. Security</h2>
<p>We use administrative, technical, and organisational measures appropriate to the sensitivity of the data (access controls, encrypted transport where applicable, and staff need-to-know access). No method of transmission or storage is fully secure; please protect your OTP and account access.</p>

<h2>8. Your rights</h2>
<p>Subject to applicable law, you may request:</p>
<ul>
<li>Access to personal data we hold about you</li>
<li>Correction of inaccurate data</li>
<li>Deletion or erasure where legally permitted (we may retain data required for bookings, claims, or law)</li>
<li>Withdrawal of consent for processing that relies on consent (e.g. marketing)</li>
<li>Grievance redressal via the contact details above</li>
</ul>
<p>We may need to verify your identity before fulfilling a request.</p>

<h2>9. Children</h2>
<p>Our services are not directed at children under 18. We do not knowingly create hire accounts for minors.</p>

<h2>10. Cross-border processing</h2>
<p>Some processors may store or process data on servers outside India. Where that occurs, we take steps consistent with applicable law to protect your information.</p>

<h2>11. Changes</h2>
<p>We may update this Policy periodically. The “Last updated” date will change when we do. Continued use of our services after an update constitutes acceptance of the revised Policy where permitted by law.</p>

<h2>12. Contact &amp; grievance</h2>
${CONTACT_BLOCK}`,
  },
  {
    slug: "cancellation",
    title: "Cancellation & Refund Policy",
    excerpt:
      "When you can cancel a booking and how token refunds are calculated by product type.",
    metaTitle: "Cancellation & Refund Policy | Dream Drive",
    metaDescription:
      "Dream Drive cancellation windows and refund percentages for self-drive, chauffeur, airport, tour, and subscription bookings.",
    sortOrder: 3,
    body: `<p><em>Last updated: 19 November 2026</em></p>
<p>This Cancellation &amp; Refund Policy applies to bookings made with <strong>Dream Drive</strong>. It works together with our <a href="/legal/terms">Terms and Conditions</a>. Refund percentages below apply to the <strong>paid Token / cancellable hire amount</strong> processed for that booking, as shown in your account at cancellation time. Security deposits already collected are handled separately after inspection.</p>

<h2>1. How to cancel</h2>
<ul>
<li>Cancel from your account booking page where the status allows customer cancellation, or contact support with your booking ID.</li>
<li>Refund eligibility is based on the time remaining before the scheduled trip start when we receive the cancellation.</li>
<li>Bookings that have reached handover, are ongoing, or are completed cannot be cancelled for a Token refund under this policy.</li>
</ul>

<h2>2. Refund bands by product</h2>
<p>We use the first matching band (hours before start → refund % of the eligible paid amount):</p>

<h3>Self-drive</h3>
<ul>
<li>48 hours or more → <strong>100%</strong></li>
<li>24 hours or more, but under 48 → <strong>50%</strong></li>
<li>Under 24 hours → <strong>0%</strong></li>
</ul>

<h3>With-driver (local)</h3>
<ul>
<li>24 hours or more → <strong>100%</strong></li>
<li>6 hours or more, but under 24 → <strong>50%</strong></li>
<li>Under 6 hours → <strong>0%</strong></li>
</ul>

<h3>With-driver (intercity) &amp; outstation</h3>
<ul>
<li>48 hours or more → <strong>100%</strong></li>
<li>12 hours or more, but under 48 → <strong>50%</strong></li>
<li>Under 12 hours → <strong>0%</strong></li>
</ul>

<h3>Airport transfers</h3>
<ul>
<li>12 hours or more → <strong>100%</strong></li>
<li>3 hours or more, but under 12 → <strong>50%</strong></li>
<li>Under 3 hours → <strong>0%</strong></li>
</ul>

<h3>One-way</h3>
<ul>
<li>24 hours or more → <strong>100%</strong></li>
<li>6 hours or more, but under 24 → <strong>50%</strong></li>
<li>Under 6 hours → <strong>0%</strong></li>
</ul>

<h3>Tour packages</h3>
<ul>
<li>72 hours or more → <strong>100%</strong></li>
<li>24 hours or more, but under 72 → <strong>50%</strong></li>
<li>Under 24 hours → <strong>0%</strong></li>
</ul>

<h3>Subscription</h3>
<ul>
<li>168 hours (7 days) or more → <strong>100%</strong></li>
<li>48 hours or more, but under 168 → <strong>50%</strong></li>
<li>Under 48 hours → <strong>0%</strong></li>
</ul>

<h2>3. Company-initiated cancellations</h2>
<ul>
<li>If we cancel because the Vehicle is unavailable and we cannot offer a reasonable alternative, you receive a full refund of the Token paid for that booking.</li>
<li>If we cancel or refuse handover due to failed KYC, invalid documents, suspected fraud, or breach of Terms, Token refund may be denied in whole or part as permitted by those Terms.</li>
</ul>

<h2>4. Refund method &amp; timing</h2>
<ul>
<li>Approved refunds are initiated to the original payment method where possible.</li>
<li>Bank or UPI timelines are outside our control; please allow several business days after we initiate the refund.</li>
<li>Partial refunds may appear as a new credit against the original payment reference.</li>
</ul>

<h2>5. Non-refundable items</h2>
<ul>
<li>Third-party costs already incurred (permits, tolls prepaid on request, special procurements) may be non-refundable.</li>
<li>No-shows without timely cancellation follow the 0% band for that product.</li>
<li>Amounts deducted for damage, fines, fuel, or excess km are not refundable.</li>
</ul>

<h2>6. Changes to trips</h2>
<p>Date or car changes are not automatic cancellations. Ask support; fee differences and policy bands for the new schedule may apply.</p>

<h2>7. Contact</h2>
${CONTACT_BLOCK}`,
  },
  {
    slug: "cookies",
    title: "Cookie Policy",
    excerpt:
      "How Dream Drive uses cookies and similar technologies on our website and apps.",
    metaTitle: "Cookie Policy | Dream Drive",
    metaDescription:
      "Learn which cookies Dream Drive uses for login, bookings, security, and analytics.",
    sortOrder: 4,
    body: `<p><em>Last updated: 19 November 2026</em></p>
<p>This Cookie Policy explains how <strong>Dream Drive</strong> uses cookies and similar technologies when you visit our website or use related web apps. It should be read with our <a href="/legal/privacy">Privacy Policy</a>.</p>

<h2>1. What are cookies?</h2>
<p>Cookies are small text files stored on your device. Similar technologies include local storage, session storage, and pixels. They help the site remember preferences, keep you signed in, and understand how the product is used.</p>

<h2>2. How we use cookies</h2>
<ul>
<li><strong>Essential:</strong> authentication, security, load balancing, and booking session continuity. The site may not work correctly if these are blocked.</li>
<li><strong>Functional:</strong> remembering city, language, or UI preferences you choose.</li>
<li><strong>Analytics (if enabled):</strong> aggregated insights on pages visited and performance so we can improve the product.</li>
<li><strong>Marketing (if enabled):</strong> measuring campaign effectiveness; we only use these where appropriate and in line with applicable law.</li>
</ul>

<h2>3. Examples</h2>
<ul>
<li>Session cookies tied to login or OTP flows</li>
<li>Tokens or flags needed to complete checkout securely</li>
<li>Preference keys such as selected city or dismissed banners</li>
</ul>

<h2>4. Third parties</h2>
<p>Payment, analytics, or support tools may set their own cookies when you interact with their features. Their policies apply to those cookies.</p>

<h2>5. Your choices</h2>
<ul>
<li>Most browsers let you block or delete cookies via settings. Blocking essential cookies may prevent booking or account access.</li>
<li>You can clear site data for dream-drive domains after your session if you use a shared device.</li>
</ul>

<h2>6. Updates</h2>
<p>We may update this Policy when our tools or legal requirements change. The “Last updated” date will reflect the latest version.</p>

<h2>7. Contact</h2>
${CONTACT_BLOCK}`,
  },
  {
    slug: "disclaimer",
    title: "Disclaimer",
    excerpt:
      "Important limits on website information, vehicle availability, and third-party services.",
    metaTitle: "Disclaimer | Dream Drive",
    metaDescription:
      "Dream Drive website and service disclaimer for quotes, availability, and external links.",
    sortOrder: 5,
    body: `<p><em>Last updated: 19 November 2026</em></p>
<p>The information on the Dream Drive website, apps, and communications is provided for general booking and support purposes. It does not replace the booking confirmation, rental agreement, or mandatory disclosures shown at checkout.</p>

<h2>1. No absolute guarantee of availability</h2>
<p>Vehicle photos, features, and prices are indicative. A specific registration number is confirmed only when we allocate a car to your booking. If a car becomes unavailable, we will offer an alternative or cancel with refund as described in our <a href="/legal/cancellation">Cancellation &amp; Refund Policy</a>.</p>

<h2>2. Quotes &amp; estimates</h2>
<p>Online quotes depend on the inputs you provide. Tolls, fines, fuel, interstate taxes, extra km, waiting charges, and damages may be extra unless expressly included.</p>

<h2>3. Third-party services</h2>
<p>Payments, maps, SMS, WhatsApp, e-sign, and similar tools are provided by third parties. Their uptime and terms are outside our direct control, though we choose reputable providers.</p>

<h2>4. External links</h2>
<p>Links to other websites are for convenience only. We are not responsible for their content or privacy practices.</p>

<h2>5. Driving &amp; road risk</h2>
<p>Self-drive customers are responsible for safe operation of the Vehicle and compliance with traffic law. With-driver trips still require passengers to follow reasonable safety instructions.</p>

<h2>6. Limitation</h2>
<p>To the extent permitted by law, Dream Drive is not liable for decisions you make solely based on website content without confirming details with our team for your specific trip. Binding terms are set out in the <a href="/legal/terms">Terms and Conditions</a> and your signed rental agreement.</p>

<h2>7. Contact</h2>
${CONTACT_BLOCK}`,
  },
];
