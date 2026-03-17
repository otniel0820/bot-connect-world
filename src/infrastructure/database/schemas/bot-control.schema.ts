import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BotControlDocument = BotControl & Document;

@Schema({
  collection: 'bot_control',
  timestamps: { createdAt: false, updatedAt: 'updated_at' },
})
export class BotControl {
  @Prop({ default: true }) bot_enabled: boolean;
  @Prop({ default: true }) demos_enabled: boolean;
  @Prop({ default: true }) renewals_enabled: boolean;
  @Prop({ default: true }) new_activations_enabled: boolean;
}

export const BotControlSchema = SchemaFactory.createForClass(BotControl);
