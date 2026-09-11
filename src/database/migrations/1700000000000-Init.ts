import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1700000000000 implements MigrationInterface {
  name = 'Init1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "displayName" character varying NOT NULL,
        "email" character varying NOT NULL,
        "passwordHash" character varying,
        "photoUrl" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "tokenHash" character varying NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "revokedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_refresh_tokens_tokenHash" UNIQUE ("tokenHash"),
        CONSTRAINT "PK_refresh_tokens" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_refresh_tokens_userId" ON "refresh_tokens" ("userId")
    `);

    await queryRunner.query(`
      ALTER TABLE "refresh_tokens"
        ADD CONSTRAINT "FK_refresh_tokens_userId"
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      CREATE TABLE "posts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "authorId" uuid NOT NULL,
        "title" character varying NOT NULL,
        "content" text NOT NULL,
        "imageUrl" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_posts" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_posts_createdAt" ON "posts" ("createdAt")
    `);

    await queryRunner.query(`
      ALTER TABLE "posts"
        ADD CONSTRAINT "FK_posts_authorId"
        FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      CREATE TABLE "comments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "postId" uuid NOT NULL,
        "authorId" uuid NOT NULL,
        "content" text NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_comments" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_comments_postId_createdAt" ON "comments" ("postId", "createdAt")
    `);

    await queryRunner.query(`
      ALTER TABLE "comments"
        ADD CONSTRAINT "FK_comments_postId"
        FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "comments"
        ADD CONSTRAINT "FK_comments_authorId"
        FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      CREATE TABLE "likes" (
        "postId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_likes" PRIMARY KEY ("postId", "userId")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "likes"
        ADD CONSTRAINT "FK_likes_postId"
        FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "likes"
        ADD CONSTRAINT "FK_likes_userId"
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."devices_platform_enum" AS ENUM('IOS', 'ANDROID', 'WEB')
    `);

    await queryRunner.query(`
      CREATE TABLE "devices" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "pushToken" character varying NOT NULL,
        "platform" "public"."devices_platform_enum" NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_devices_pushToken" UNIQUE ("pushToken"),
        CONSTRAINT "PK_devices" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "devices"
        ADD CONSTRAINT "FK_devices_userId"
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "devices" DROP CONSTRAINT "FK_devices_userId"`);
    await queryRunner.query(`DROP TABLE "devices"`);
    await queryRunner.query(`DROP TYPE "public"."devices_platform_enum"`);
    await queryRunner.query(`ALTER TABLE "likes" DROP CONSTRAINT "FK_likes_userId"`);
    await queryRunner.query(`ALTER TABLE "likes" DROP CONSTRAINT "FK_likes_postId"`);
    await queryRunner.query(`DROP TABLE "likes"`);
    await queryRunner.query(`ALTER TABLE "comments" DROP CONSTRAINT "FK_comments_authorId"`);
    await queryRunner.query(`ALTER TABLE "comments" DROP CONSTRAINT "FK_comments_postId"`);
    await queryRunner.query(`DROP INDEX "IDX_comments_postId_createdAt"`);
    await queryRunner.query(`DROP TABLE "comments"`);
    await queryRunner.query(`ALTER TABLE "posts" DROP CONSTRAINT "FK_posts_authorId"`);
    await queryRunner.query(`DROP INDEX "IDX_posts_createdAt"`);
    await queryRunner.query(`DROP TABLE "posts"`);
    await queryRunner.query(`ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_refresh_tokens_userId"`);
    await queryRunner.query(`DROP INDEX "IDX_refresh_tokens_userId"`);
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
