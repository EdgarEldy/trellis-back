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
  // TypeORM 1.x rejects empty-criteria delete; use queryBuilder instead
  await likeRepo.createQueryBuilder().delete().execute();
  await commentRepo.createQueryBuilder().delete().execute();
  await postRepo.createQueryBuilder().delete().execute();
  await userRepo.createQueryBuilder().delete().execute();

  // --- 5 users ---
  const passwordHash = await bcrypt.hash('password123', 10);

  const userData = [
    { displayName: 'Alice', email: 'alice@example.com' },
    { displayName: 'Bob', email: 'bob@example.com' },
    { displayName: 'Carol', email: 'carol@example.com' },
    { displayName: 'Dave', email: 'dave@example.com' },
    { displayName: 'Eve', email: 'eve@example.com' },
  ];

  const users: User[] = userData.map(({ displayName, email }) =>
    userRepo.create({ displayName, email, passwordHash, photoUrl: null }),
  );
  await userRepo.save(users);
  console.log(`Created ${users.length} users`);

  // --- 10 posts spread across the 5 users ---
  const postTitles = [
    'Getting started with NestJS',
    'TypeORM tips and tricks',
    'Understanding JWT tokens',
    'Building REST APIs',
    'PostgreSQL performance tuning',
    'Docker for Node.js developers',
    'Testing NestJS applications',
    'Guards and interceptors explained',
    'Cursor pagination deep dive',
    'Event-driven architecture in NestJS',
  ];

  const posts: Post[] = postTitles.map((title, i) =>
    postRepo.create({
      authorId: users[i % 5].id,
      title: `Post ${i + 1}: ${title}`,
      content:
        `This is post number ${i + 1}. It explores ${title.toLowerCase()} ` +
        `in the context of a NestJS REST API. The content is representative ` +
        `of real user-generated posts and exercises the API response shapes.`,
      imageUrl: null,
    }),
  );
  await postRepo.save(posts);
  console.log(`Created ${posts.length} posts`);

  // --- 10 comments per post = 100 comments total ---
  const commentTexts = [
    'Great post!',
    'Very informative, thanks for sharing.',
    'I learned something new today.',
    'Well explained, keep it up!',
    'This was exactly what I needed.',
    'Excellent write-up.',
    'Looking forward to more posts like this.',
    'Fascinating perspective on the topic.',
    'Really helpful for my current project.',
    'Bookmarked for future reference.',
  ];

  const comments: Comment[] = [];
  posts.forEach((post, pi) => {
    for (let j = 0; j < 10; j++) {
      // Rotate through all 5 users as comment authors (avoid post owner when possible)
      const authorIndex = (pi + j + 1) % 5;
      comments.push(
        commentRepo.create({
          postId: post.id,
          authorId: users[authorIndex].id,
          content: commentTexts[j],
        }),
      );
    }
  });
  await commentRepo.save(comments);
  console.log(`Created ${comments.length} comments (10 per post)`);

  // --- 30 likes across 10 posts, max 5 per post (5 users x 10 posts = 50 unique pairs) ---
  // Build all unique (postId, userId) pairs, then pick 30
  const allPairs: Array<{ postId: string; userId: string }> = [];
  for (const post of posts) {
    for (const user of users) {
      allPairs.push({ postId: post.id, userId: user.id });
    }
  }

  // Deterministically select 30 pairs spread across all posts (3 per post)
  const selectedPairs = posts.flatMap((post) =>
    users.slice(0, 3).map((user) => ({ postId: post.id, userId: user.id })),
  );

  const likes: Like[] = selectedPairs.map(({ postId, userId }) =>
    likeRepo.create({ postId, userId }),
  );
  await likeRepo.save(likes);
  console.log(`Created ${likes.length} likes (3 per post across ${posts.length} posts)`);

  console.log('Seed completed successfully.');
  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
