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
  await likeRepo.delete({});
  await commentRepo.delete({});
  await postRepo.delete({});
  await userRepo.delete({});

  // Create 3 users
  const passwordHash = await bcrypt.hash('password123', 10);

  const alice = userRepo.create({
    displayName: 'Alice',
    email: 'alice@example.com',
    passwordHash,
    photoUrl: null,
  });
  const bob = userRepo.create({
    displayName: 'Bob',
    email: 'bob@example.com',
    passwordHash,
    photoUrl: null,
  });
  const carol = userRepo.create({
    displayName: 'Carol',
    email: 'carol@example.com',
    passwordHash,
    photoUrl: null,
  });

  await userRepo.save([alice, bob, carol]);

  // Create 25 posts (more than one page of 20) spread across the three users
  const postData = Array.from({ length: 25 }, (_, i) => {
    const authors = [alice, bob, carol];
    const author = authors[i % 3];
    return postRepo.create({
      authorId: author.id,
      title: `Post ${i + 1}: A sample title`,
      content: `This is the content of post number ${i + 1}. It contains enough text to be interesting.`,
      imageUrl: null,
    });
  });

  const posts = await postRepo.save(postData);

  // Create 10 comments spread across posts
  const commentData = [
    { post: posts[0], author: bob, content: 'Great post, Alice!' },
    { post: posts[0], author: carol, content: 'I agree, very interesting.' },
    { post: posts[1], author: alice, content: 'Nice work Bob.' },
    { post: posts[2], author: bob, content: 'Thanks for sharing, Carol.' },
    { post: posts[3], author: carol, content: 'Fascinating perspective.' },
    { post: posts[4], author: alice, content: 'Well written!' },
    { post: posts[5], author: bob, content: 'Looking forward to more.' },
    { post: posts[6], author: carol, content: 'Loved reading this.' },
    { post: posts[7], author: alice, content: 'Very insightful.' },
    { post: posts[8], author: bob, content: 'Keep it up!' },
  ];

  const comments = commentData.map(({ post, author, content }) =>
    commentRepo.create({
      postId: post.id,
      authorId: author.id,
      content,
    }),
  );

  await commentRepo.save(comments);

  // Create some likes across posts
  const likeData = [
    { postId: posts[0].id, userId: bob.id },
    { postId: posts[0].id, userId: carol.id },
    { postId: posts[1].id, userId: alice.id },
    { postId: posts[1].id, userId: carol.id },
    { postId: posts[2].id, userId: alice.id },
    { postId: posts[3].id, userId: bob.id },
    { postId: posts[4].id, userId: carol.id },
    { postId: posts[5].id, userId: alice.id },
  ];

  const likes = likeData.map(({ postId, userId }) =>
    likeRepo.create({ postId, userId }),
  );

  await likeRepo.save(likes);

  console.log('Seed completed: 3 users, 25 posts, 10 comments, 8 likes');
  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
