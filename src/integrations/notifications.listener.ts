import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { Post } from '../posts/entities/post.entity';
import { Device } from './entities/device.entity';
import { FirebaseMessagingService } from './firebase-messaging.service';
import type { CommentCreatedEvent, LikeCreatedEvent } from './events/notification-events';

interface PushNotification {
  title: string;
  body: string;
}

@Injectable()
export class NotificationsListener {
  private readonly logger = new Logger(NotificationsListener.name);

  constructor(
    @InjectRepository(Post)
    private readonly postsRepo: Repository<Post>,
    @InjectRepository(Device)
    private readonly devicesRepo: Repository<Device>,
    private readonly firebaseMessagingService: FirebaseMessagingService,
  ) {}

  @OnEvent('comment.created')
  async handleCommentCreated(event: CommentCreatedEvent): Promise<void> {
    await this.notifyPostAuthor(event.postId, event.authorId, {
      title: 'New comment',
      body: 'Someone commented on your post',
    });
  }

  @OnEvent('like.created')
  async handleLikeCreated(event: LikeCreatedEvent): Promise<void> {
    await this.notifyPostAuthor(event.postId, event.userId, {
      title: 'New like',
      body: 'Someone liked your post',
    });
  }

  private async notifyPostAuthor(
    postId: string,
    actorId: string,
    notification: PushNotification,
  ): Promise<void> {
    const post = await this.postsRepo.findOneBy({ id: postId });
    if (!post || post.authorId === actorId) {
      return;
    }

    const devices = await this.devicesRepo.findBy({ userId: post.authorId });
    for (const device of devices) {
      await this.sendToDevice(device, notification);
    }
  }

  private async sendToDevice(device: Device, notification: PushNotification): Promise<void> {
    try {
      await this.firebaseMessagingService.send(device.pushToken, notification);
    } catch (error) {
      if (this.firebaseMessagingService.isUnregisteredTokenError(error)) {
        await this.devicesRepo.delete({ pushToken: device.pushToken });
        return;
      }
      this.logger.error(
        `Failed to send push notification to device ${device.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
