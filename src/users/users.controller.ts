import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { mkdirSync } from 'fs';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UserResponseDto } from './dto/user-response.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

const AVATAR_UPLOAD_DIR = join(process.cwd(), 'uploads', 'avatars');
const AVATAR_MAX_SIZE_BYTES = 5 * 1024 * 1024;

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string): Promise<UserResponseDto> {
    return this.usersService.findById(id);
  }

  @Patch('me')
  updateProfile(
    @CurrentUser() userId: string,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    return this.usersService.updateProfile(userId, dto);
  }

  @Post('me/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          mkdirSync(AVATAR_UPLOAD_DIR, { recursive: true });
          cb(null, AVATAR_UPLOAD_DIR);
        },
        filename: (_req, file, cb) => {
          cb(null, `${randomUUID()}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: AVATAR_MAX_SIZE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          cb(new BadRequestException('File must be an image'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  uploadAvatar(
    @CurrentUser() userId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ photoUrl: string }> {
    if (!file) {
      throw new BadRequestException('File must be an image');
    }
    return this.usersService.updateAvatar(userId, file.filename);
  }
}
