import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post } from './entities/post.entity';
import { Like } from '../likes/entities/like.entity';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Post, Like])],
  controllers: [PostsController],
  providers: [PostsService],
})
export class PostsModule {}
