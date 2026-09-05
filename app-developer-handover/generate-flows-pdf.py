from pathlib import Path

from fpdf import FPDF

OUT = Path(__file__).resolve().parent / "DreamDrive-App-Flows.pdf"

NAVY = (11, 31, 51)
TEAL = (16, 122, 112)
GOLD = (196, 149, 58)
WHITE = (255, 255, 255)
INK = (32, 41, 49)
MUTED = (90, 102, 114)
LINE = (210, 218, 224)
BOX = (245, 248, 250)
GREEN = (22, 122, 80)
RED = (153, 45, 45)


class FlowPDF(FPDF):
    def header(self):
        if self.page_no() == 1:
            return
        self.set_fill_color(*NAVY)
        self.rect(0, 0, 210, 12, "F")
        self.set_text_color(*WHITE)
        self.set_font("Helvetica", "B", 9)
        self.set_xy(12, 3.5)
        self.cell(0, 5, "Dream Drive  |  App developer handover  |  Customer flows", align="L")
        self.set_font("Helvetica", "", 8)
        self.set_xy(0, 3.5)
        self.cell(198, 5, "API /v1", align="R")
        self.set_y(16)

    def footer(self):
        self.set_y(-12)
        self.set_draw_color(*LINE)
        self.line(12, self.get_y(), 198, self.get_y())
        self.set_text_color(*MUTED)
        self.set_font("Helvetica", "", 8)
        self.set_y(-10)
        self.cell(0, 6, f"Confidential  |  fill live-api.config.json before sharing  |  {self.page_no()}/{{nb}}", align="C")


def box(pdf: FlowPDF, x, y, w, h, title, sub="", fill=BOX, border=TEAL, title_color=NAVY):
    pdf.set_fill_color(*fill)
    pdf.set_draw_color(*border)
    pdf.set_line_width(0.4)
    pdf.rect(x, y, w, h, "FD")
    pdf.set_xy(x + 2, y + 2)
    pdf.set_text_color(*title_color)
    pdf.set_font("Helvetica", "B", 8)
    pdf.multi_cell(w - 4, 4, title, align="C")
    if sub:
        pdf.set_text_color(*MUTED)
        pdf.set_font("Helvetica", "", 7)
        pdf.set_xy(x + 2, y + h - 8)
        pdf.multi_cell(w - 4, 3.2, sub, align="C")


def arrow_right(pdf: FlowPDF, x, y):
    pdf.set_draw_color(*TEAL)
    pdf.set_fill_color(*TEAL)
    pdf.set_line_width(0.6)
    pdf.line(x, y, x + 7, y)
    pdf.polygon([(x + 7, y - 1.6), (x + 11, y), (x + 7, y + 1.6)], "F")


def arrow_down(pdf: FlowPDF, x, y, h=8):
    pdf.set_draw_color(*TEAL)
    pdf.set_fill_color(*TEAL)
    pdf.set_line_width(0.6)
    pdf.line(x, y, x, y + h - 3)
    pdf.polygon([(x - 1.6, y + h - 3), (x, y + h), (x + 1.6, y + h - 3)], "F")


def section(pdf: FlowPDF, title):
    pdf.set_text_color(*NAVY)
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(0, 8, title, ln=1)
    pdf.set_draw_color(*GOLD)
    pdf.set_line_width(0.8)
    y = pdf.get_y()
    pdf.line(12, y, 70, y)
    pdf.ln(4)


def para(pdf: FlowPDF, text):
    pdf.set_text_color(*INK)
    pdf.set_font("Helvetica", "", 10)
    pdf.multi_cell(0, 5, text)
    pdf.ln(2)


def bullet(pdf: FlowPDF, text):
    pdf.set_text_color(*INK)
    pdf.set_font("Helvetica", "", 10)
    x = pdf.get_x()
    pdf.cell(6, 5, "-")
    pdf.multi_cell(0, 5, text)
    pdf.set_x(x)


def main():
    pdf = FlowPDF(orientation="P", unit="mm", format="A4")
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=16)

    # Cover
    pdf.add_page()
    pdf.set_fill_color(*NAVY)
    pdf.rect(0, 0, 210, 297, "F")
    pdf.set_fill_color(*TEAL)
    pdf.rect(0, 0, 8, 297, "F")
    pdf.set_fill_color(*GOLD)
    pdf.rect(0, 250, 210, 8, "F")

    pdf.set_text_color(*GOLD)
    pdf.set_font("Helvetica", "B", 12)
    pdf.set_xy(24, 48)
    pdf.cell(0, 8, "APP DEVELOPER HANDOVER")

    pdf.set_text_color(*WHITE)
    pdf.set_font("Helvetica", "B", 32)
    pdf.set_xy(24, 62)
    pdf.cell(0, 14, "Dream Drive")
    pdf.set_font("Helvetica", "", 16)
    pdf.set_xy(24, 80)
    pdf.cell(0, 8, "Customer app  |  screens, flows, central API")

    pdf.set_font("Helvetica", "", 11)
    pdf.set_xy(24, 110)
    pdf.set_text_color(180, 198, 210)
    pdf.multi_cell(
        160,
        6,
        "The app owns frontend screens and navigation.\n"
        "All prices, availability, KYC, payments, and booking status\n"
        "come from the live /v1 API. Do not invent business rules\n"
        "on the device.",
    )

    pdf.set_xy(24, 160)
    pdf.set_text_color(*WHITE)
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(0, 6, "API prefix     /v1", ln=1)
    pdf.set_x(24)
    pdf.cell(0, 6, "Auth           Authorization: Bearer <token>", ln=1)
    pdf.set_x(24)
    pdf.cell(0, 6, "Money          integer paise   |   Time  UTC in, IST on screen", ln=1)
    pdf.set_x(24)
    pdf.cell(0, 6, "Realtime       Socket.IO  {SOCKET_URL}/booking  + HTTP poll", ln=1)

    pdf.set_xy(24, 210)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(180, 198, 210)
    pdf.multi_cell(160, 5, "Fill live-api.config.json with HTTPS URLs before sharing this pack.\nUpdated 5 Sep 2026")

    # Split
    pdf.add_page()
    section(pdf, "1. Who does what")
    para(
        pdf,
        "Share one HTTPS API with the app team. They never call admin routes, internal routes, "
        "or write the database. You run KYC review, Razorpay webhooks, Leegality, and fleet ops.",
    )

    y = pdf.get_y() + 2
    pdf.set_fill_color(232, 247, 244)
    pdf.set_draw_color(*TEAL)
    pdf.rect(12, y, 90, 52, "FD")
    pdf.set_xy(16, y + 4)
    pdf.set_text_color(*TEAL)
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(0, 6, "App developer")
    pdf.set_xy(16, y + 12)
    pdf.set_text_color(*INK)
    pdf.set_font("Helvetica", "", 9)
    pdf.multi_cell(
        82,
        4.5,
        "Screens, UX, navigation\nRazorpay Checkout UI\nPush token, deep links\nDisplay API data\nForm UX (API still validates)",
    )

    pdf.set_fill_color(255, 247, 230)
    pdf.set_draw_color(*GOLD)
    pdf.rect(108, y, 90, 52, "FD")
    pdf.set_xy(112, y + 4)
    pdf.set_text_color(*GOLD)
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(0, 6, "API owner")
    pdf.set_xy(112, y + 12)
    pdf.set_text_color(*INK)
    pdf.set_font("Helvetica", "", 9)
    pdf.multi_cell(
        82,
        4.5,
        "Live /v1 API + socket\nPrices, holds, refunds\nKYC decision, e-sign\nWebhooks, email OTP\nAdmin panel / fleet",
    )
    pdf.set_y(y + 58)

    section(pdf, "2. Connect")
    for line in [
        "Base URL from live-api.config.json  (HTTPS). Health: GET /health",
        "Public: /v1/public/** and auth login/otp/register/google",
        "Everything else: Bearer token (OTP session dd1.* or Firebase ID token)",
        "OTP: 3 sends / 15 min / IP, code lives 5 minutes",
        "Errors: read message or error. Some bodies return {error} with HTTP 200 - check it.",
        "Native apps skip CORS. Expo web needs CORS_ORIGINS on the API.",
    ]:
        bullet(pdf, line)

    # Auth flow
    pdf.add_page()
    section(pdf, "3. Auth flow")
    para(pdf, "Preferred path is email OTP. Password and Google are also live.")

    steps = [
        ("Splash", "GET /health\nrestore token"),
        ("OTP send", "POST /v1/auth\n/otp/send"),
        ("OTP verify", "POST /v1/auth\n/otp/verify"),
        ("Store token", "Secure store\nKeychain/Keystore"),
        ("Profile", "GET /v1/me\nPOST /v1/me/devices"),
    ]
    x = 12
    y = 48
    for i, (t, s) in enumerate(steps):
        box(pdf, x, y, 32, 28, t, s)
        if i < len(steps) - 1:
            arrow_right(pdf, x + 33, y + 14)
        x += 38

    pdf.set_y(86)
    bullet(pdf, "POST /v1/auth/login  { email, password }  -> Firebase ID token")
    bullet(pdf, "POST /v1/auth/register  password min 8 chars")
    bullet(pdf, "POST /v1/auth/google  { idToken }")
    bullet(pdf, "PATCH /v1/me phone change requires a second OTP then POST /v1/me/phone/verify")
    bullet(pdf, "dev:email tokens work only when NODE_ENV is not production")
    pdf.ln(3)
    para(pdf, "401 Sign in required  -> clear session.  401 Account disabled  -> banned copy, no retry.")

    # Money path
    pdf.add_page()
    section(pdf, "4. Search  ->  pay  (core money path)")
    para(
        pdf,
        "The device never calculates hire. Quote freezes price (~20 min). Booking holds a vehicle (~15 min). "
        "Razorpay success is not enough - poll payment until SUCCESS.",
    )

    rows = [
        [
            ("Home / Search", "cities + search"),
            ("Car detail", "slug + availability"),
            ("Login if needed", "Bearer token"),
            ("Create quote", "POST /v1/quotes"),
        ],
        [
            ("Offer code", "optional apply-offer"),
            ("Create booking", "POST /v1/bookings"),
            ("AWAITING_PAYMENT", "hold clock 15 min"),
            ("Create order", "POST /payments/orders"),
        ],
        [
            ("Razorpay UI", "use keyId + orderId"),
            ("Verify backup", "POST /payments/verify"),
            ("Poll payment", "GET /payments/:id"),
            ("Reload booking", "branch on status"),
        ],
    ]
    y = 52
    for row in rows:
        x = 14
        for i, (t, s) in enumerate(row):
            box(pdf, x, y, 42, 24, t, s)
            if i < 3:
                arrow_right(pdf, x + 43.5, y + 12)
            x += 48
        if row is not rows[-1]:
            arrow_down(pdf, 105, y + 24, 10)
        y += 34

    pdf.set_y(162)
    section(pdf, "Hard rules")
    bullet(pdf, "amountPaise and depositPaise from the quote/order only. Format paise / 100 as INR.")
    bullet(pdf, "If quote.expired or hold lapses, start a new quote. Do not reuse stale ids.")
    bullet(pdf, "Same quoteId posted twice returns the existing booking (idempotent).")
    bullet(pdf, "kind TOKEN | BALANCE | DEPOSIT. Customers typically pay TOKEN first.")
    bullet(pdf, "If orders.mock is true, staging may skip the Razorpay SDK.")

    # KYC
    pdf.add_page()
    section(pdf, "5. Self-drive KYC + e-sign")
    para(
        pdf,
        "After token payment, self-drive usually becomes AWAITING_KYC. Staff approve in admin. "
        "The app only uploads, submits, and opens Leegality. Closing a WebView is not a signature.",
    )

    kyc = [
        ("Upload files", "POST /v1/kyc/uploads\nkind DL AADHAAR SELFIE"),
        ("Submit case", "POST /v1/kyc/submit\n+ bookingId"),
        ("Staff review", "not in the app\nstatus SUBMITTED"),
        ("Sign URL", "GET /v1/me/agreements\nenvelope.signUrl"),
        ("Poll booking", "CONFIRMED\nwhen webhook lands"),
    ]
    x = 12
    y = 58
    for i, (t, s) in enumerate(kyc):
        fill = BOX if i != 2 else (255, 247, 230)
        border = TEAL if i != 2 else GOLD
        box(pdf, x, y, 34, 32, t, s, fill=fill, border=border)
        if i < len(kyc) - 1:
            arrow_right(pdf, x + 35, y + 16)
        x += 39

    pdf.set_y(100)
    bullet(pdf, "Self-drive required: driving licence + (Aadhaar or address proof) + selfie with ID.")
    bullet(pdf, "PDF / JPG / PNG / WebP, max 8 MB.")
    bullet(pdf, "Aadhaar 12 digits, PAN ABCDE1234F, DL must cover drop-off. API stores hashes, last4 only.")
    bullet(pdf, "If GET /v1/me/kyc reusable=true, submit bookingId with empty documents.")
    bullet(pdf, "NEEDS_REUPLOAD: only that kind again. Show notes from the case.")
    pdf.ln(2)
    para(
        pdf,
        "With-driver / airport / tour may skip KYC and jump to CONFIRMED after pay. Still poll the booking; "
        "do not hard-code the next screen.",
    )

    # Status + track
    pdf.add_page()
    section(pdf, "6. Booking status machine")
    para(pdf, "Render the status the API returns. Suggested customer CTAs:")

    statuses = [
        ("AWAITING_PAYMENT", "Pay now  |  hold timer"),
        ("AWAITING_KYC", "Upload documents"),
        ("AWAITING_SIGNATURE", "Open agreement"),
        ("CONFIRMED", "Dates, branch, driver"),
        ("HANDOVER / ONGOING", "Trip live  |  cancel off"),
        ("RETURN_PENDING", "Return in progress"),
        ("COMPLETED", "Review CTA"),
        ("CANCELLED / NO_SHOW", "Refund / book again"),
    ]
    y = 48
    for i, (st, cta) in enumerate(statuses):
        col = i % 2
        row = i // 2
        x = 12 + col * 96
        yy = y + row * 18
        pdf.set_fill_color(*BOX)
        pdf.set_draw_color(*TEAL)
        pdf.rect(x, yy, 90, 16, "FD")
        pdf.set_xy(x + 3, yy + 2)
        pdf.set_font("Helvetica", "B", 8)
        pdf.set_text_color(*NAVY)
        pdf.cell(84, 5, st)
        pdf.set_xy(x + 3, yy + 8)
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(*MUTED)
        pdf.cell(84, 5, cta)

    pdf.set_y(128)
    section(pdf, "7. Track + cancel + support")
    bullet(pdf, "Logged in: GET /v1/me/bookings then GET /v1/bookings/:id (id or publicId).")
    bullet(pdf, "Socket: io(SOCKET_URL/booking)  emit booking:subscribe  on booking:status  then refetch.")
    bullet(pdf, "Always poll GET booking every ~8 seconds if the socket drops.")
    bullet(pdf, "Guest: POST /v1/public/bookings/track/otp then /track/verify  (phone must match profile).")
    bullet(pdf, "Cancel: POST /v1/bookings/:id/cancel until handover. Show refundPct from the response.")
    bullet(pdf, "Tickets: POST /v1/me/tickets  |  CLOSED tickets cannot be replied to.")
    pdf.ln(2)
    para(
        pdf,
        "Refund bands (server): self-drive 100% if >= 48h before start, 50% if >= 24h, else 0. "
        "Airport 12h / 3h. Tour 72h / 24h. Subscription 7 days / 48h. Display policy before confirm.",
    )

    # Screens
    pdf.add_page()
    section(pdf, "8. Screens the app must ship")
    screens = [
        "Splash / force-update",
        "Login OTP, password, Google, register",
        "Home (banners, featured cars, call/WhatsApp)",
        "City + date + rental-type search",
        "Results + filters + availability",
        "Car detail + calendar busyDays",
        "Checkout from quote (no local math)",
        "Razorpay + payment poll",
        "KYC upload / submit",
        "Agreement + Leegality",
        "My bookings + detail + live status",
        "Guest track",
        "Profile, addresses, phone OTP",
        "Invoices PDF, wallet read-only",
        "Support tickets",
        "Packages, subscriptions",
        "Contact, legal CMS pages",
        "Review after COMPLETED",
    ]
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(*INK)
    left = screens[:9]
    right = screens[9:]
    y0 = pdf.get_y()
    for i, s in enumerate(left):
        pdf.set_xy(16, y0 + i * 7)
        pdf.cell(8, 6, f"{i+1}.")
        pdf.cell(80, 6, s)
    for i, s in enumerate(right):
        pdf.set_xy(110, y0 + i * 7)
        pdf.cell(8, 6, f"{i+10}.")
        pdf.cell(80, 6, s)

    pdf.set_y(y0 + 9 * 7 + 8)
    section(pdf, "Out of scope")
    bullet(pdf, "Admin panel, partner portal, delivery-executive app")
    bullet(pdf, "Approving KYC, assigning cars/drivers, capturing deposits")
    bullet(pdf, "Calling /v1/admin or /internal")

    # Checklist
    pdf.add_page()
    section(pdf, "9. What you send with the live API")
    for line in [
        "HTTPS API URL and socket URL in live-api.config.json",
        "Whether Razorpay is live or mock",
        "A test customer email that can receive OTP",
        "Proof that GET /health and public search return cars",
        "Firebase SHA-1 / iOS client ids for Google Sign-In on devices",
        "Support contact for outages",
        "Do not send database URLs, Razorpay secret, Leegality keys, INTERNAL_TOKEN",
    ]:
        bullet(pdf, line)

    pdf.ln(4)
    section(pdf, "10. App go-live")
    for line in [
        "Store builds use the live HTTPS URL, not localhost",
        "UAT: pay, kill app, reopen - booking follows webhook status",
        "Quote expiry and hold expiry handled",
        "Deep links dreamdrive://bookings/:id and dreamdrive://track/:publicId",
        "POST /v1/me/devices after login",
        "Never log tokens, OTP, Aadhaar, or PAN",
    ]:
        bullet(pdf, line)

    pdf.ln(6)
    pdf.set_fill_color(*NAVY)
    pdf.rect(12, pdf.get_y(), 186, 36, "F")
    pdf.set_text_color(*WHITE)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_xy(18, pdf.get_y() + 6)
    pdf.cell(0, 6, "Source of truth")
    pdf.set_font("Helvetica", "", 10)
    pdf.set_xy(18, pdf.get_y() + 8)
    pdf.multi_cell(
        174,
        5,
        "If the UI and the API disagree, the API wins. Rebuild the screen from GET /v1/bookings/:id. "
        "Full request/response contract: 03-api-contract.md   Requirements: 05-requirement-sheet.md",
    )

    pdf.output(str(OUT))
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
