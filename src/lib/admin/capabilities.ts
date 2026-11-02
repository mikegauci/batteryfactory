export const ADMIN_CAPABILITIES = {
  pages: "Pages",
  products: "Products",
  orders: "Orders",
  media: "Media library",
} as const;
export type AdminCapability = keyof typeof ADMIN_CAPABILITIES;

export function hasAdminCapability(
  user: { role: string; adminCapabilities: string[] | null },
  capability?: AdminCapability,
) {
  return (
    user.role === "admin" &&
    (user.adminCapabilities === null ||
      (capability !== undefined && user.adminCapabilities.includes(capability)))
  );
}

export function cleanAdminCapabilities(
  role: string,
  fullAccess: boolean,
  capabilities: string[],
): AdminCapability[] | null {
  if (role !== "admin" || fullAccess) return null;
  return [...new Set(capabilities)].filter((key): key is AdminCapability =>
    Object.hasOwn(ADMIN_CAPABILITIES, key),
  );
}
