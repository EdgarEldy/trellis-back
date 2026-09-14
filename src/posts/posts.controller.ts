import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { mkdirSync } from 'fs';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PagedPosts, PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostResponseDto } from './dto/post-response.dto';

const POST_IMAGE_UPLOAD_DIR = join(process.cwd(), 'uploads', 'posts');
const POST_IMAGE_MAX_SIZE_BYTES = 5 * 1024 * 1024;

mkdirSync(POST_IMAGE_UPLOAD_DIR, { recursive: true });

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  findMany(
    @CurrentUser() userId: string,
    @Query('cursor') cursor: string | undefined,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ): Promise<PagedPosts> {
    return this.postsService.findMany(userId, cursor, limit);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() userId: string,
  ): Promise<PostResponseDto> {
    return this.postsService.findOneById(id, userId);
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: POST_IMAGE_UPLOAD_DIR,
        filename: (_req, file, cb) => {
          cb(null, `${randomUUID()}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: POST_IMAGE_MAX_SIZE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          cb(new BadRequestException('File must be an image'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  create(
    @CurrentUser() userId: string,
    @Body() dto: CreatePostDto,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<PostResponseDto> {
    return this.postsService.create(userId, dto, file?.filename);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() userId: string,
    @Body() dto: UpdatePostDto,
  ): Promise<PostResponseDto> {
    return this.postsService.update(id, userId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() userId: string): Promise<void> {
    await this.postsService.remove(id, userId);
  }
}
