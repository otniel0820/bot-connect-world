import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { MessengerPort } from '../domain/ports/messenger.port';
import { AiProviderPort } from '../domain/ports/ai-provider.port';
import { PanelPort } from '../domain/ports/panel.port';
import { FacebookMessengerAdapter } from './adapters/facebook/facebook-messenger.adapter';
import { OpenAiAdapter } from './adapters/ai/openai.adapter';
import { IptvPanelAdapter } from './adapters/panel/iptv-panel.adapter';
import { DatabaseModule } from './database/database.module';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '.env',
    }),
    DatabaseModule,
  ],
  providers: [
    {
      provide: MessengerPort,
      useClass: FacebookMessengerAdapter,
    },
    {
      provide: AiProviderPort,
      useClass: OpenAiAdapter,
    },
    {
      provide: PanelPort,
      useClass: IptvPanelAdapter,
    },
  ],
  exports: [MessengerPort, AiProviderPort, PanelPort, DatabaseModule],
})
export class InfrastructureModule {}
