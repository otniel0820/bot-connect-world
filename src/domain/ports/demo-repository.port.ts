export interface CreateDemoData {
  facebookUserId: string;
  fullname: string;
  panelUsername: string;
  panelPassword: string;
  packageName: string;
  activatedAt: Date;
  expiresAt: Date;
}

export interface DemoRecord extends CreateDemoData {
  id: string;
  followUpSent: boolean;
}

export abstract class DemoRepositoryPort {
  abstract save(data: CreateDemoData): Promise<void>;
  abstract findPendingFollowUps(): Promise<DemoRecord[]>;
  abstract markFollowUpSent(id: string): Promise<void>;
}
