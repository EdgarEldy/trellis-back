import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreatePostDto {
  @ApiProperty({ example: 'My first post' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: "Here's what happened today..." })
  @IsString()
  @IsNotEmpty()
  content: string;
}
