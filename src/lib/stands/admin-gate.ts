export const ADMIN_PIN = "stand-admin";

export function assertAdminPin(pin: string) {
  if (pin.trim() !== ADMIN_PIN) throw new Error("Wrong PIN");
}
