import api from "../api/http";

export function trackLead(payload) {
  return api.post("/v1/public/leads", payload).catch(() => {});
}

export function trackWhatsApp(phone) {
  return trackLead({
    name: "WhatsApp enquiry",
    phone: phone || undefined,
    source: "whatsapp",
  });
}

export function trackCall(phone) {
  return trackLead({
    name: "Call enquiry",
    phone: phone || undefined,
    source: "phone",
  });
}
