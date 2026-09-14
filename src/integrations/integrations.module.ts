import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Device } from './entities/device.entity';
import { Post } from '../posts/entities/post.entity';
import { GoogleAuthService } from './google-auth.service';
import { DevicesService } from './devices.service';
import { DevicesController } from './devices.controller';
import { FirebaseMessagingService } from './firebase-messaging.service';
import { NotificationsListener } from './notifications.listener';

@Module({
  imports: [TypeOrmModule.forFeature([Device, Post])],
  controllers: [DevicesController],
  providers: [GoogleAuthService, DevicesService, FirebaseMessagingService, NotificationsListener],
  exports: [GoogleAuthService],
})
export class IntegrationsModule {}
