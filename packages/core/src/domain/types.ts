export interface BaseEntity {
  id: string;
  ownerId: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface LabeledValue {
  label: string;
  value: string;
}

export interface PostalAddress {
  label: string;
  street: string;
  city: string;
  postalCode: string;
  country: string;
}

export interface LabeledDate {
  label: string;
  date: string; // ISO yyyy-mm-dd
}

export interface KeyValue {
  key: string;
  value: string;
}
