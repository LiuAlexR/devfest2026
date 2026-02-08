export interface StudySpot {
  key: string;
  name: string;
  category: 'libraries' | 'cafes' | 'restaurants' | 'parks' | 'coworking';
  neighborhood: string;
  wifi: boolean;
  outlets: boolean;
  avg_rating: number;
  review_count: number;
  latitude: number;
  longitude: number;
  description?: string;
}

export interface Review {
  id: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
}