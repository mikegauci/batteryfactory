// Billing and delivery details from the checkout page (WooCommerce's fields).
export type Address = {
  first_name: string;
  last_name: string;
  company: string;
  address_1: string;
  address_2: string;
  city: string;
  postcode: string;
  country: string;
  phone: string;
};
export type CustomerDetails = {
  billing: Address & { email: string };
  shipping: Address;
  note: string;
};

const FIELDS = [
  "first_name",
  "last_name",
  "company",
  "address_1",
  "address_2",
  "city",
  "postcode",
  "phone",
] as const;
const REQUIRED = [
  "first_name",
  "last_name",
  "address_1",
  "city",
  "postcode",
] as const;

function address(raw: unknown, withPhone: boolean): Address | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const out = { country: "MT" } as Address;
  for (const f of FIELDS) {
    const v = typeof r[f] === "string" ? (r[f] as string).trim() : "";
    if (v.length > 200) return null;
    out[f] = v;
  }
  if (REQUIRED.some((f) => !out[f]) || (withPhone && !out.phone)) return null;
  return out;
}

// Validates the details sent to /api/checkout/. Delivery is Malta & Gozo
// only, so the country is always MT, as on the live checkout.
export function parseCustomerDetails(
  raw: unknown,
): CustomerDetails | { error: string } {
  const r = (raw ?? {}) as Record<string, unknown>;
  const billing = address(r.billing, true);
  const email =
    typeof (r.billing as Record<string, unknown>)?.email === "string"
      ? ((r.billing as Record<string, string>).email ?? "").trim()
      : "";
  if (
    !billing ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 200
  )
    return { error: "Please fill in all required billing fields." };
  const shipping = r.ship_elsewhere ? address(r.shipping, false) : billing;
  if (!shipping)
    return { error: "Please fill in all required delivery fields." };
  const note = typeof r.note === "string" ? r.note.trim().slice(0, 2000) : "";
  return { billing: { ...billing, email }, shipping, note };
}
