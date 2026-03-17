export interface CustomerInfo {
  id: string;
  name: string;
}

export abstract class CustomerRepositoryPort {
  abstract findByCustomerId(customerId: string): Promise<CustomerInfo | null>;
  abstract findByFacebookId(facebookId: string): Promise<CustomerInfo | null>;
  abstract updateFacebookId(customerId: string, facebookId: string): Promise<void>;
}
