import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Customer, CustomerDocument } from '../schemas/customer.schema';
import { CustomerRepositoryPort, CustomerInfo } from '../../../domain/ports/customer-repository.port';

@Injectable()
export class CustomerMongoRepository implements CustomerRepositoryPort {
  constructor(@InjectModel(Customer.name) private readonly customerModel: Model<CustomerDocument>) {}

  async findByCustomerId(customerId: string): Promise<CustomerInfo | null> {
    const customer = await this.customerModel.findById(customerId).exec();
    if (!customer) return null;
    return {
      id: customer.id,
      name: customer.name,
      panelUsername: customer.username || undefined,
    };
  }

  async findByFacebookId(facebookId: string): Promise<CustomerInfo | null> {
    const customer = await this.customerModel.findOne({ facebook_id: facebookId }).exec();
    if (!customer) return null;
    return {
      id: customer.id,
      name: customer.name,
      panelUsername: customer.username || undefined,
    };
  }

  async updatePanelCredentials(customerId: string, panelUsername: string, facebookId: string): Promise<void> {
    await this.customerModel.findByIdAndUpdate(customerId, {
      username: panelUsername,
      facebook_id: facebookId,
    }).exec();
  }
}
