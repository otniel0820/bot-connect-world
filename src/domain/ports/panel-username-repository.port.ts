export interface PanelUsernameInfo {
  id: string;
  customerId: string;
  username: string;
}

export abstract class PanelUsernameRepositoryPort {
  abstract create(customerId: string, username: string): Promise<PanelUsernameInfo>;
  abstract findById(id: string): Promise<PanelUsernameInfo | null>;
  abstract findByCustomerId(customerId: string): Promise<PanelUsernameInfo[]>;
  abstract hasAny(customerId: string): Promise<boolean>;
}
