export interface UserProfile {
  id: string;
  username: string;
  email: string;
  role: 'ADMIN' | 'USER';
  avatar: string | null;
  bio: string | null;
  postCount: number;
  commentCount: number;
  createdAt: string;
  level: {
    level: number;
    title: string;
    icon: string;
    currentExp: number;
    nextLevelExp: number;
  };
}

export interface MyPost {
  id: string;
  title: string;
  summary: string;
  category: { id: string; name: string; slug: string } | null;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  isPinned: boolean;
  isEssence: boolean;
  createdAt: string;
}

export interface MyComment {
  id: string;
  content: string;
  postId: string;
  postTitle: string;
  createdAt: string;
}
