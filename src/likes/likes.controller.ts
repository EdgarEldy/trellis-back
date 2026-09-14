import { Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { LikesService, ToggleLikeResult } from './likes.service';

@Controller()
export class LikesController {
  constructor(private readonly likesService: LikesService) {}

  @Post('posts/:postId/likes')
  @HttpCode(HttpStatus.OK)
  toggle(
    @Param('postId', ParseUUIDPipe) postId: string,
    @CurrentUser() userId: string,
  ): Promise<ToggleLikeResult> {
    return this.likesService.toggle(postId, userId);
  }

  @Get('posts/:postId/likes/me')
  isLikedByMe(
    @Param('postId', ParseUUIDPipe) postId: string,
    @CurrentUser() userId: string,
  ): Promise<{ liked: boolean }> {
    return this.likesService.isLikedByMe(postId, userId);
  }
}
