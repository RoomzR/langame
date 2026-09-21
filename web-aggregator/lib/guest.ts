export function phoneLabel(phone?: string | null, walkIn?: boolean) {
  if (walkIn || !phone || phone.startsWith("walkin:")) return "без телефона";
  return phone;
}
