import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DemoDocument = Demo & Document;

@Schema({ collection: 'demos', timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class Demo {
  @Prop({ required: true }) facebookUserId: string;
  @Prop({ required: true }) fullname: string;
  @Prop({ required: true }) panelUsername: string;
  @Prop({ required: true }) panelPassword: string;
  @Prop({ required: true }) packageName: string;
  @Prop({ required: true }) activatedAt: Date;
  @Prop({ required: true }) expiresAt: Date;
  @Prop({ default: false }) followUpSent: boolean;
  @Prop() followUpSentAt?: Date;
}

export const DemoSchema = SchemaFactory.createForClass(Demo);
