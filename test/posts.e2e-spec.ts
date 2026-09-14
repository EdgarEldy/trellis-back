import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { createValidationPipe } from '../src/common/pipes/create-validation-pipe';

interface AuthedUser {
  token: string;
  id: string;
}

describe('Posts (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let userA: AuthedUser;
  let userB: AuthedUser;

  const registerUser = async (): Promise<AuthedUser> => {
    const email = `e2e-${randomUUID()}@test.local`;
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'password123', displayName: 'Posts E2E User' })
      .expect(201);
    return { token: res.body.accessToken, id: res.body.user.id };
  };

  const createPost = async (token: string, title: string): Promise<{ id: string }> => {
    const res = await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${token}`)
      .field('title', title)
      .field('content', 'content')
      .expect(201);
    return res.body;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(createValidationPipe());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    dataSource = app.get(DataSource);
    userA = await registerUser();
    userB = await registerUser();
  });

  afterEach(async () => {
    await dataSource.query(`DELETE FROM posts WHERE "authorId" IN ($1, $2)`, [userA.id, userB.id]);
  });

  afterAll(async () => {
    await dataSource.query(`DELETE FROM users WHERE id IN ($1, $2)`, [userA.id, userB.id]);
    await app.close();
  });

  describe('GET /posts', () => {
    it('returns pages in the right order across two calls, with no overlap and no gap', async () => {
      const created = [
        await createPost(userA.token, 'Pagination Post 1'),
        await createPost(userA.token, 'Pagination Post 2'),
        await createPost(userA.token, 'Pagination Post 3'),
      ];
      const createdIds = created.map((post) => post.id);

      const full = await request(app.getHttpServer())
        .get('/posts?limit=50')
        .set('Authorization', `Bearer ${userA.token}`)
        .expect(200);
      const fullIds: string[] = full.body.items.map((item: { id: string }) => item.id);

      const page1 = await request(app.getHttpServer())
        .get('/posts?limit=2')
        .set('Authorization', `Bearer ${userA.token}`)
        .expect(200);
      const page2 = await request(app.getHttpServer())
        .get(`/posts?limit=2&cursor=${page1.body.nextCursor}`)
        .set('Authorization', `Bearer ${userA.token}`)
        .expect(200);

      const page1Ids: string[] = page1.body.items.map((item: { id: string }) => item.id);
      const page2Ids: string[] = page2.body.items.map((item: { id: string }) => item.id);
      const combined = [...page1Ids, ...page2Ids];

      expect(combined).toEqual(fullIds.slice(0, combined.length));
      expect(page1Ids.filter((id) => page2Ids.includes(id))).toHaveLength(0);
      createdIds.forEach((id) => expect(combined).toContain(id));
    });
  });

  describe('DELETE /comments/:id', () => {
    it('rejects deleting another user\'s comment with 403 and leaves the row in place', async () => {
      const post = await createPost(userA.token, 'Comment ownership test');
      const commentRes = await request(app.getHttpServer())
        .post(`/posts/${post.id}/comments`)
        .set('Authorization', `Bearer ${userB.token}`)
        .send({ content: 'Not yours to delete' })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/comments/${commentRes.body.id}`)
        .set('Authorization', `Bearer ${userA.token}`)
        .expect(403);

      const rows = await dataSource.query('SELECT id FROM comments WHERE id = $1', [
        commentRes.body.id,
      ]);
      expect(rows).toHaveLength(1);
    });
  });

  describe('POST /posts/:postId/likes', () => {
    it('returns a likesCount matching an independent count query after the toggle', async () => {
      const post = await createPost(userA.token, 'Like count test');

      const res = await request(app.getHttpServer())
        .post(`/posts/${post.id}/likes`)
        .set('Authorization', `Bearer ${userB.token}`)
        .expect(200);

      const [{ count }] = await dataSource.query(
        'SELECT COUNT(*)::int AS count FROM likes WHERE "postId" = $1',
        [post.id],
      );
      expect(res.body.likesCount).toBe(count);
    });
  });

  describe('DELETE /posts/:id', () => {
    it('cascades the delete to the post\'s comments and likes', async () => {
      const post = await createPost(userA.token, 'Cascade delete test');
      await request(app.getHttpServer())
        .post(`/posts/${post.id}/comments`)
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ content: 'A comment' })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/posts/${post.id}/likes`)
        .set('Authorization', `Bearer ${userB.token}`)
        .expect(200);

      await request(app.getHttpServer())
        .delete(`/posts/${post.id}`)
        .set('Authorization', `Bearer ${userA.token}`)
        .expect(204);

      const comments = await dataSource.query('SELECT id FROM comments WHERE "postId" = $1', [
        post.id,
      ]);
      const likes = await dataSource.query('SELECT * FROM likes WHERE "postId" = $1', [post.id]);
      expect(comments).toHaveLength(0);
      expect(likes).toHaveLength(0);
    });
  });
});
