import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BotControl, BotControlDocument } from '../schemas/bot-control.schema';
import { BotControlRepositoryPort, BotControlSettings } from '../../../domain/ports/bot-control-repository.port';

@Injectable()
export class BotControlMongoRepository implements BotControlRepositoryPort {
  constructor(
    @InjectModel(BotControl.name) private readonly model: Model<BotControlDocument>,
  ) {}

  async getSettings(): Promise<BotControlSettings> {
    const existing = await this.model.findOne().lean().exec();
    if (existing) {
      return this.toSettings(existing);
    }
    // First run: create default document
    const created = await this.model.create({});
    return this.toSettings(created.toObject());
  }

  watchChanges(
    onChange: (settings: BotControlSettings) => void,
    onError: (err: Error) => void,
  ): () => Promise<void> {
    const stream = this.model.watch([], { fullDocument: 'updateLookup' });

    stream.on('change', (change: any) => {
      const doc = change.fullDocument;
      if (doc) {
        onChange(this.toSettings(doc));
      }
    });

    stream.on('error', onError);

    return () => stream.close();
  }

  private toSettings(doc: any): BotControlSettings {
    return {
      bot_enabled:             doc.bot_enabled ?? true,
      demos_enabled:           doc.demos_enabled ?? true,
      renewals_enabled:        doc.renewals_enabled ?? true,
      new_activations_enabled: doc.new_activations_enabled ?? true,
    };
  }
}
