import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type PanelUsernameDocument = PanelUsername & Document;

@Schema({ collection: 'panel_usernames', timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class PanelUsername {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Customer', required: true, index: true }) customer_id: Types.ObjectId;
  @Prop({ required: true, lowercase: true, trim: true }) username: string;
}

export const PanelUsernameSchema = SchemaFactory.createForClass(PanelUsername);
