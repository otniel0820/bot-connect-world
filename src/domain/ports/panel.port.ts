export interface CreatedPanelUser {
  fullname: string;
  username: string;
  password: string;
  package: string;
}

export abstract class PanelPort {
  abstract createUser(fullname: string, packageName: string): Promise<CreatedPanelUser>;
  abstract renewUser(username: string, packageName: string): Promise<CreatedPanelUser>;
}
