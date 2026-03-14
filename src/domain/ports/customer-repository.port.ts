export interface CustomerInfo {
  id: string;
  name: string;
  panelUsername?: string; // existe si ya tiene suscripción activa
}

export abstract class CustomerRepositoryPort {
  abstract findByCustomerId(customerId: string): Promise<CustomerInfo | null>;
  abstract findByFacebookId(facebookId: string): Promise<CustomerInfo | null>;
  abstract updatePanelCredentials(customerId: string, panelUsername: string, facebookId: string): Promise<void>;
}
