import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Post } from '../../posts/entities/post.entity';
import { Comment } from '../../comments/entities/comment.entity';
import { Like } from '../../likes/entities/like.entity';
import { RefreshToken } from '../../auth/entities/refresh-token.entity';
import { Device } from '../../integrations/entities/device.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  displayName: string;

  @Column({ unique: true })
  email: string;

  @Column({ type: 'varchar', nullable: true })
  passwordHash: string | null;

  @Column({ type: 'varchar', nullable: true })
  photoUrl: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Post, (p) => p.author)
  posts: Post[];

  @OneToMany(() => Comment, (c) => c.author)
  comments: Comment[];

  @OneToMany(() => Like, (l) => l.user)
  likes: Like[];

  @OneToMany(() => RefreshToken, (r) => r.user)
  refreshTokens: RefreshToken[];

  @OneToMany(() => Device, (d) => d.user)
  devices: Device[];
}
