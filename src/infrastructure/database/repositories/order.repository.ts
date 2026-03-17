import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order, OrderDocument } from '../schemas/order.schema';
import { OrderRepositoryPort, OrderInfo } from '../../../domain/ports/order-repository.port';

@Injectable()
export class OrderMongoRepository implements OrderRepositoryPort {
  constructor(@InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>) {}

  async isBotVerified(paymentReceiptId: string): Promise<boolean> {
    const order = await this.orderModel.findOne({ payment_receipt_id: paymentReceiptId }).exec();
    return order?.bot_verified === true;
  }

  async markBotVerified(paymentReceiptId: string): Promise<void> {
    await this.orderModel.findOneAndUpdate(
      { payment_receipt_id: paymentReceiptId },
      { bot_verified: true },
    ).exec();
  }

  async findUnverifiedByCustomerId(customerId: string): Promise<(OrderInfo & { paymentReceiptId: string }) | null> {
    const order = await this.orderModel.findOne({
      customer_id: customerId,
      bot_verified: false,
    }).sort({ created_at: -1 }).exec();
    if (!order) return null;
    return {
      customerId: order.customer_id.toString(),
      planId: order.plan_id,
      devices: order.devices,
      months: order.months,
      amount: order.amount,
      paymentReceiptId: order.payment_receipt_id,
    };
  }

  async findByPaymentReceiptId(paymentReceiptId: string): Promise<OrderInfo | null> {
    const order = await this.orderModel.findOne({ payment_receipt_id: paymentReceiptId }).exec();
    if (!order) return null;
    return {
      id:               order.id,
      customerId:       order.customer_id.toString(),
      planId:           order.plan_id,
      devices:          order.devices,
      months:           order.months,
      amount:           order.amount,
      isRenewal:        order.is_renewal ?? false,
      panelUsernameId:  order.panel_username_id?.toString() ?? null,
    };
  }

  async setPanelUsernameId(orderId: string, panelUsernameId: string): Promise<void> {
    await this.orderModel.findByIdAndUpdate(orderId, { panel_username_id: panelUsernameId }).exec();
  }
}
