import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Demo, DemoSchema } from './schemas/demo.schema';
import { Order, OrderSchema } from './schemas/order.schema';
import { Customer, CustomerSchema } from './schemas/customer.schema';
import { BotControl, BotControlSchema } from './schemas/bot-control.schema';
import { PanelUsername, PanelUsernameSchema } from './schemas/panel-username.schema';
import { DemoMongoRepository } from './repositories/demo.repository';
import { OrderMongoRepository } from './repositories/order.repository';
import { CustomerMongoRepository } from './repositories/customer.repository';
import { BotControlMongoRepository } from './repositories/bot-control.repository';
import { PanelUsernameMongoRepository } from './repositories/panel-username.repository';
import { DemoRepositoryPort } from '../../domain/ports/demo-repository.port';
import { OrderRepositoryPort } from '../../domain/ports/order-repository.port';
import { CustomerRepositoryPort } from '../../domain/ports/customer-repository.port';
import { BotControlRepositoryPort } from '../../domain/ports/bot-control-repository.port';
import { PanelUsernameRepositoryPort } from '../../domain/ports/panel-username-repository.port';

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
      { name: BotControl.name, schema: BotControlSchema },
      { name: PanelUsername.name, schema: PanelUsernameSchema },
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
    {
      provide: BotControlRepositoryPort,
      useClass: BotControlMongoRepository,
    },
    {
      provide: PanelUsernameRepositoryPort,
      useClass: PanelUsernameMongoRepository,
    },
  ],
  exports: [DemoRepositoryPort, OrderRepositoryPort, CustomerRepositoryPort, BotControlRepositoryPort, PanelUsernameRepositoryPort],
})
export class DatabaseModule {}
