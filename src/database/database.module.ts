import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.getOrThrow<string>('database.url'),
        synchronize: false,
        logging: config.get<string>('app.nodeEnv') === 'development',
        autoLoadEntities: true,
      }),
    }),
  ],
})
export class DatabaseModule {}
