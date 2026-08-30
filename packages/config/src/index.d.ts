export function read(name: string, fallback?: string): string | undefined;
export function urls(): {
  gateway: string;
  identity: string;
  catalog: string;
  booking: string;
  payment: string;
  document: string;
  fleet: string;
  partner: string;
  notification: string;
  platform: string;
  socket: string;
};
export function internalToken(): string;
