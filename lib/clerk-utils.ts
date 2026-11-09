interface ClerkEmailAddress {
  id: string;
  email_address: string;
}

export interface ClerkUserData {
  id: string;
  email_addresses?: ClerkEmailAddress[];
  primary_email_address_id?: string | null;
}

export function getPrimaryEmail(data: ClerkUserData): string | null {
  const addresses = data.email_addresses ?? [];
  const primary = addresses.find((address) => address.id === data.primary_email_address_id);
  return primary?.email_address ?? addresses[0]?.email_address ?? null;
}
