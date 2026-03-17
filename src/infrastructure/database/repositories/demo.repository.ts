import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Demo, DemoDocument } from '../schemas/demo.schema';
import { CreateDemoData, DemoRecord, DemoRepositoryPort } from '../../../domain/ports/demo-repository.port';

@Injectable()
export class DemoMongoRepository implements DemoRepositoryPort {
  constructor(@InjectModel(Demo.name) private readonly demoModel: Model<DemoDocument>) {}

  async save(data: CreateDemoData): Promise<void> {
    await this.demoModel.create(data);
  }

  async findPendingFollowUps(): Promise<DemoRecord[]> {
    const now = new Date();
    const docs = await this.demoModel.find({
      expiresAt: { $lte: now },
      followUpSent: false,
    }).exec();

    return docs.map((d) => ({
      id: (d._id as any).toString(),
      facebookUserId: d.facebookUserId,
      fullname: d.fullname,
      panelUsername: d.panelUsername,
      panelPassword: d.panelPassword,
      packageName: d.packageName,
      activatedAt: d.activatedAt,
      expiresAt: d.expiresAt,
      followUpSent: d.followUpSent,
    }));
  }

  async markFollowUpSent(id: string): Promise<void> {
    await this.demoModel.findByIdAndUpdate(id, {
      followUpSent: true,
      followUpSentAt: new Date(),
    }).exec();
  }

  async findByFacebookUserId(facebookUserId: string): Promise<DemoRecord | null> {
    const doc = await this.demoModel.findOne({ facebookUserId }).sort({ activatedAt: -1 }).exec();
    if (!doc) return null;
    return {
      id: (doc._id as any).toString(),
      facebookUserId: doc.facebookUserId,
      fullname: doc.fullname,
      panelUsername: doc.panelUsername,
      panelPassword: doc.panelPassword,
      packageName: doc.packageName,
      activatedAt: doc.activatedAt,
      expiresAt: doc.expiresAt,
      followUpSent: doc.followUpSent,
    };
  }
}
