export interface CommentCreatedEvent {
  postId: string;
  authorId: string;
}

export interface LikeCreatedEvent {
  postId: string;
  userId: string;
}
