import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Demo, DemoSchema } from './schemas/demo.schema';
import { Order, OrderSchema } from './schemas/order.schema';
import { Customer, CustomerSchema } from './schemas/customer.schema';
import { DemoMongoRepository } from './repositories/demo.repository';
import { OrderMongoRepository } from './repositories/order.repository';
import { CustomerMongoRepository } from './repositories/customer.repository';
import { DemoRepositoryPort } from '../../domain/ports/demo-repository.port';
import { OrderRepositoryPort } from '../../domain/ports/order-repository.port';
import { CustomerRepositoryPort } from '../../domain/ports/customer-repository.port';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('mongodb.uri'),
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([
      { name: Demo.name, schema: DemoSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Customer.name, schema: CustomerSchema },
    ]),
  ],
  providers: [
    {
      provide: DemoRepositoryPort,
      useClass: DemoMongoRepository,
    },
    {
      provide: OrderRepositoryPort,
      useClass: OrderMongoRepository,
    },
    {
      provide: CustomerRepositoryPort,
      useClass: CustomerMongoRepository,
    },
  ],
  exports: [DemoRepositoryPort, OrderRepositoryPort, CustomerRepositoryPort],
})
export class DatabaseModule {}
