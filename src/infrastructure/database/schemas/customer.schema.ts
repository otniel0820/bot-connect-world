import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CustomerDocument = Customer & Document;

@Schema({ collection: 'customers', timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class Customer {
  @Prop() name: string;
  @Prop({ required: true, unique: true, lowercase: true }) email: string;
  @Prop() phone: string;
  @Prop({ default: null }) referral_code: string;
  @Prop({ default: null }) username: string;    // Panel username (lo setea el bot tras verificar pago)
  @Prop({ default: null }) facebook_id: string; // Facebook sender ID (lo setea el bot)
}

export const CustomerSchema = SchemaFactory.createForClass(Customer);
