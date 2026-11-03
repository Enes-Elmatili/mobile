// lib/types/address.ts
// Adresses enregistrées du client.

export interface SavedAddress {
  id: number;
  label: string;
  address: string;
  lat: number;
  lng: number;
}

/** GET /addresses — tableau nu, ou `{ data }` selon la version. */
export type AddressesResponse =
  | (SavedAddress[] & { data?: undefined })
  | { data?: SavedAddress[] };
