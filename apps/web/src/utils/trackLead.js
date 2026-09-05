import api from "../api/http";

export function trackLead(payload) {
  return api.post("/v1/public/leads", payload).catch(() => {});
}

export function trackWhatsApp() {
  return trackLead({
    name: "WhatsApp enquiry",
    source: "whatsapp",
  });
}

export function trackCall() {
  return trackLead({
    name: "Call enquiry",
    source: "phone",
  });
}
