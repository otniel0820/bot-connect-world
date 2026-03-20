import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type OrderDocument = Order & Document;

@Schema({ collection: 'orders', timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class Order {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Customer', required: true, index: true }) customer_id: Types.ObjectId;
  @Prop({ required: true }) plan_id: string;
  @Prop({ required: true }) devices: number;
  @Prop({ required: true }) months: number;
  @Prop({ required: true }) amount: number;
  @Prop({ required: true, enum: ['stripe', 'paypal'] }) payment_method: string;
  @Prop({ required: true, unique: true }) payment_receipt_id: string;
  @Prop({ enum: ['pending', 'completed', 'failed'], default: 'pending' }) status: string;
  @Prop({ default: false }) is_renewal: boolean;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'PanelUsername', default: null }) panel_username_id: Types.ObjectId | null;
  @Prop({ default: false }) bot_verified: boolean;
  @Prop({ required: true }) activation_date: Date;
  @Prop({ required: true }) expiration_date: Date;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
