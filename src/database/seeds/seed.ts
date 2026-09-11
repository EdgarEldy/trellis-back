import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import { AppDataSource } from '../data-source';
import { User } from '../../users/entities/user.entity';
import { Post } from '../../posts/entities/post.entity';
import { Comment } from '../../comments/entities/comment.entity';
import { Like } from '../../likes/entities/like.entity';

async function seed(): Promise<void> {
  await AppDataSource.initialize();

  const userRepo = AppDataSource.getRepository(User);
  const postRepo = AppDataSource.getRepository(Post);
  const commentRepo = AppDataSource.getRepository(Comment);
  const likeRepo = AppDataSource.getRepository(Like);

  // Clear existing seed data in FK-safe order
  // TypeORM 1.x disallows empty-criteria delete; use queryBuilder instead
  await likeRepo.createQueryBuilder().delete().execute();
  await commentRepo.createQueryBuilder().delete().execute();
  await postRepo.createQueryBuilder().delete().execute();
  await userRepo.createQueryBuilder().delete().execute();

  // Create 30 users with hashed passwords
  const passwordHash = await bcrypt.hash('password123', 10);

  const firstNames = [
    'Alice', 'Bob', 'Carol', 'Dave', 'Eve',
    'Frank', 'Grace', 'Hank', 'Iris', 'Jack',
    'Karen', 'Leo', 'Maya', 'Noah', 'Olivia',
    'Paul', 'Quinn', 'Rose', 'Sam', 'Tara',
    'Uma', 'Victor', 'Wendy', 'Xander', 'Yara',
    'Zach', 'Amber', 'Blake', 'Chloe', 'Derek',
  ];

  const users: User[] = [];
  for (let i = 0; i < 30; i++) {
    const name = firstNames[i];
    users.push(
      userRepo.create({
        displayName: name,
        email: `${name.toLowerCase()}@example.com`,
        passwordHash,
        photoUrl: null,
      }),
    );
  }
  await userRepo.save(users);
  console.log(`Created ${users.length} users`);

  // Create 30 posts spread across first 5 users
  const posts: Post[] = [];
  for (let i = 0; i < 30; i++) {
    const author = users[i % 5];
    posts.push(
      postRepo.create({
        authorId: author.id,
        title: `Post ${i + 1}: ${getPostTitle(i)}`,
        content: `This is post number ${i + 1}. ${getPostContent(i)}`,
        imageUrl: null,
      }),
    );
  }
  await postRepo.save(posts);
  console.log(`Created ${posts.length} posts`);

  // Create 30 comments spread across different posts and authors
  const comments: Comment[] = [];
  for (let i = 0; i < 30; i++) {
    const post = posts[i % 20]; // spread across first 20 posts
    const author = users[(i + 3) % 30]; // different author than post owner
    comments.push(
      commentRepo.create({
        postId: post.id,
        authorId: author.id,
        content: `Comment ${i + 1}: ${getCommentContent(i)}`,
      }),
    );
  }
  await commentRepo.save(comments);
  console.log(`Created ${comments.length} comments`);

  // Create 30 likes with unique (postId, userId) combinations
  const likeSet = new Set<string>();
  const likes: Like[] = [];
  let attempts = 0;
  while (likes.length < 30 && attempts < 1000) {
    attempts++;
    const postIndex = attempts % 25; // across first 25 posts
    const userIndex = (attempts * 7) % 30; // spread across all users
    const post = posts[postIndex];
    const user = users[userIndex];
    const key = `${post.id}:${user.id}`;
    if (!likeSet.has(key)) {
      likeSet.add(key);
      likes.push(likeRepo.create({ postId: post.id, userId: user.id }));
    }
  }
  await likeRepo.save(likes);
  console.log(`Created ${likes.length} likes`);

  console.log('Seed completed successfully.');
  await AppDataSource.destroy();
}

function getPostTitle(index: number): string {
  const titles = [
    'Getting started with NestJS', 'TypeORM tips and tricks', 'Understanding JWT tokens',
    'Building REST APIs', 'PostgreSQL performance tuning', 'Docker for Node.js developers',
    'Testing NestJS applications', 'Guards and interceptors explained', 'Cursor pagination deep dive',
    'Event-driven architecture in NestJS',
  ];
  return titles[index % titles.length];
}

function getPostContent(index: number): string {
  return `This is an example post demonstrating content for entry number ${index + 1}. ` +
    `It contains enough text to be representative of real user-generated content ` +
    `and exercises the pagination and search features of the API.`;
}

function getCommentContent(index: number): string {
  const comments = [
    'Great post!', 'Very informative.', 'Thanks for sharing this.',
    'I learned something new today.', 'Well explained!', 'Looking forward to more.',
    'This was exactly what I needed.', 'Excellent write-up.', 'Keep it up!',
    'Fascinating perspective.',
  ];
  return comments[index % comments.length];
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
