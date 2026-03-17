import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CustomerDocument = Customer & Document;

@Schema({ collection: 'customers', timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class Customer {
  @Prop({ required: true, trim: true }) name: string;
  @Prop({ required: true, unique: true, lowercase: true }) email: string;
  @Prop({ required: true }) phone: string;
  @Prop({ default: null }) referral_code: string;
  @Prop({ default: null }) facebook_id: string; // Facebook sender ID (lo setea el bot)
}

export const CustomerSchema = SchemaFactory.createForClass(Customer);
