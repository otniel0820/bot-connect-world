import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PanelUsername, PanelUsernameDocument } from '../schemas/panel-username.schema';
import { PanelUsernameRepositoryPort, PanelUsernameInfo } from '../../../domain/ports/panel-username-repository.port';

@Injectable()
export class PanelUsernameMongoRepository implements PanelUsernameRepositoryPort {
  constructor(@InjectModel(PanelUsername.name) private readonly model: Model<PanelUsernameDocument>) {}

  private toInfo(doc: PanelUsernameDocument): PanelUsernameInfo {
    return {
      id:         doc.id,
      customerId: doc.customer_id.toString(),
      username:   doc.username,
    };
  }

  async create(customerId: string, username: string): Promise<PanelUsernameInfo> {
    const doc = await this.model.create({ customer_id: customerId, username: username.toLowerCase().trim() });
    return this.toInfo(doc);
  }

  async findById(id: string): Promise<PanelUsernameInfo | null> {
    const doc = await this.model.findById(id).exec();
    return doc ? this.toInfo(doc) : null;
  }

  async findByCustomerId(customerId: string): Promise<PanelUsernameInfo[]> {
    const docs = await this.model.find({ customer_id: customerId }).sort({ created_at: 1 }).exec();
    return docs.map((d) => this.toInfo(d));
  }

  async hasAny(customerId: string): Promise<boolean> {
    const count = await this.model.countDocuments({ customer_id: customerId }).exec();
    return count > 0;
  }
}
