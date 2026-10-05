export const STAFF_ROLES = [
  "SUPPORT",
  "SALES",
  "FLEET_OPS",
  "FINANCE",
  "BRANCH_MANAGER",
  "CITY_MANAGER",
  "SUPER_ADMIN",
];

export const ROLE_META = {
  SUPER_ADMIN: {
    label: "Super admin",
    blurb: "Full control. Create staff, assign access, and open every module.",
  },
  CITY_MANAGER: {
    label: "City manager",
    blurb: "City-wide ops: fleet, bookings, staff in that city, reports.",
  },
  BRANCH_MANAGER: {
    label: "Branch manager",
    blurb: "One branch: bookings, vehicles, drivers, inspections.",
  },
  FLEET_OPS: {
    label: "Fleet ops",
    blurb: "Cars, vehicles, availability, drivers, maintenance, tours.",
  },
  FINANCE: {
    label: "Finance",
    blurb: "Payments, settlements, partners, subscriptions, reports.",
  },
  SALES: {
    label: "Sales",
    blurb: "Bookings, customers, KYC, offers, coupons, CMS, leads.",
  },
  SUPPORT: {
    label: "Support",
    blurb: "Customers, tickets, KYC, agreements, reviews, notifications.",
  },
};

export const NAV = [
  ["/", "Dashboard", null, ""],
  ["/bookings", "Bookings", ["SALES", "SUPPORT", "FLEET_OPS", "BRANCH_MANAGER", "CITY_MANAGER"], "Operations"],
  ["/fleet", "Fleet", ["FLEET_OPS", "CITY_MANAGER", "SALES", "BRANCH_MANAGER"], "Fleet"],
  ["/availability", "Availability", ["FLEET_OPS", "BRANCH_MANAGER", "CITY_MANAGER", "SALES"], "Fleet"],
  ["/drivers", "Drivers", ["FLEET_OPS", "BRANCH_MANAGER", "CITY_MANAGER"], "Fleet"],
  ["/maintenance", "Maintenance", ["FLEET_OPS", "BRANCH_MANAGER", "CITY_MANAGER"], "Fleet"],
  ["/inspections", "Inspections", ["FLEET_OPS", "BRANCH_MANAGER", "CITY_MANAGER"], "Fleet"],
  ["/kyc", "KYC", ["SUPPORT", "SALES"], "People"],
  ["/agreements", "Agreements", ["SUPPORT", "SALES"], "People"],
  ["/customers", "Customers", ["SUPPORT", "SALES"], "People"],
  ["/staff", "Staff", ["CITY_MANAGER", "SUPER_ADMIN"], "People"],
  ["/cities", "Cities", ["CITY_MANAGER"], "Network"],
  ["/branches", "Branches", ["CITY_MANAGER", "FLEET_OPS", "BRANCH_MANAGER"], "Network"],
  ["/partners", "Partners", ["FINANCE", "FLEET_OPS", "CITY_MANAGER"], "Network"],
  ["/tickets", "Tickets", ["SUPPORT", "SALES"], "Support"],
  ["/reviews", "Reviews", ["SUPPORT", "SALES"], "Support"],
  ["/notifications", "Notifications", ["SUPPORT"], "Support"],
  ["/payments", "Payments", ["FINANCE"], "Finance"],
  ["/settlements", "Settlements", ["FINANCE"], "Finance"],
  ["/subscriptions", "Subscriptions", ["SALES", "FLEET_OPS", "FINANCE"], "Finance"],
  ["/reports", "Reports", ["FINANCE", "CITY_MANAGER"], "Finance"],
  ["/leads", "Leads", ["SALES", "SUPPORT", "CITY_MANAGER"], "Growth"],
  ["/offers", "Offers", ["SALES"], "Growth"],
  ["/coupons", "Coupons", ["SALES"], "Growth"],
  ["/packages", "Trips & tours", ["SALES", "FLEET_OPS"], "Growth"],
  ["/cms", "CMS", ["SALES"], "Content"],
  ["/banners", "Banners", ["SALES"], "Content"],
  ["/getaways", "Getaways", ["SALES"], "Content"],
  ["/blogs", "Blogs", ["SALES"], "Content"],
  ["/media", "Media", ["SALES"], "Content"],
  ["/audit", "Audit", [], "System"],
];

export function groupedNav(roles) {
  const groups = [];
  for (const item of NAV) {
    const [, , allowed, group] = item;
    if (!canSee(roles, allowed)) continue;
    const key = group || "";
    const last = groups[groups.length - 1];
    if (!last || last.key !== key) groups.push({ key, label: key, items: [item] });
    else last.items.push(item);
  }
  return groups;
}

export function isStaff(roles) {
  return (roles || []).some((role) => STAFF_ROLES.includes(role));
}

export function canSee(roles, allowed) {
  if ((roles || []).includes("SUPER_ADMIN")) return true;
  if (allowed == null) return true;
  return allowed.some((role) => (roles || []).includes(role));
}

export function modulesForRoles(roles) {
  if ((roles || []).includes("SUPER_ADMIN")) {
    return NAV.filter(([href]) => href !== "/").map(([, label]) => label);
  }
  return NAV.filter(([href, , allowed]) => href !== "/" && canSee(roles, allowed)).map(([, label]) => label);
}

export function canAccessPath(path, roles) {
  if (!path || path === "/login") return true;
  if (!isStaff(roles)) return false;
  if ((roles || []).includes("SUPER_ADMIN")) return true;
  const match = NAV.filter(([href]) => {
    if (href === "/") return path === "/";
    return path === href || path.startsWith(`${href}/`) || path.startsWith(`${href}?`);
  }).sort((a, b) => b[0].length - a[0].length)[0];
  if (!match) return true;
  return canSee(roles, match[2]);
}

export function roleLabel(name) {
  return ROLE_META[name]?.label || String(name || "").replace(/_/g, " ");
}

const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export function generateStaffPassword() {
  let body = "";
  const cryptoObj = typeof crypto !== "undefined" ? crypto : null;
  if (cryptoObj?.getRandomValues) {
    const bytes = new Uint8Array(8);
    cryptoObj.getRandomValues(bytes);
    body = Array.from(bytes, (b) => PASSWORD_ALPHABET[b % PASSWORD_ALPHABET.length]).join("");
  } else {
    body = Array.from({ length: 8 }, () => PASSWORD_ALPHABET[Math.floor(Math.random() * PASSWORD_ALPHABET.length)]).join("");
  }
  return `Dd-${body.slice(0, 4)}-${body.slice(4)}`;
}
