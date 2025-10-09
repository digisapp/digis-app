// User types
export interface User {
  id: string;
  supabase_id: string;
  email: string;
  username: string;
  name?: string;
  avatar?: string;
  profile_pic_url?: string;
  bio?: string;
  is_creator: boolean;
  is_verified?: boolean;
  token_balance?: number;
  creator_type?: string;
  followers_count?: number;
  following_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Creator extends User {
  stream_price?: number;
  video_price?: number;
  voice_price?: number;
  message_price?: number;
  text_message_price?: number;
  image_message_price?: number;
  video_message_price?: number;
  voice_memo_price?: number;
  hourly_rate?: number;
  per_minute_rate?: number;
  categories?: string[];
  gallery_photos?: string[];
  stream_audience_control?: boolean;
  total_sessions?: number;
  total_earnings?: number;
  rating?: number;
  state?: string;
  country?: string;
  custom_greeting?: string;
  min_session_duration?: number;
  max_session_duration?: number;
  availability_status?: 'online' | 'busy' | 'offline';
}

// Session types
export interface Session {
  id: string;
  creator_id: string;
  fan_id: string;
  type: SessionType;
  status: SessionStatus;
  start_time: string;
  end_time?: string;
  duration_minutes?: number;
  total_amount?: number;
  price_per_min: number;
}

export type SessionType = 'video' | 'voice' | 'stream';
export type SessionStatus = 'scheduled' | 'active' | 'ended' | 'cancelled';

// Token types
export interface TokenBalance {
  user_id: string;
  balance: number;
  updated_at: string;
}

export interface TokenTransaction {
  id: string;
  user_id: string;
  amount: number;
  type: TransactionType;
  description: string;
  created_at: string;
  session_id?: string;
  creator_id?: string;
}

export type TransactionType = 'purchase' | 'spend' | 'refund' | 'tip' | 'earning';

// Payment types
export interface PaymentMethod {
  id: string;
  type: 'card';
  card: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  };
  is_default: boolean;
}

export interface TokenPackage {
  id: number;
  name: string;
  tokens: number;
  price: number;
  bonus_tokens?: number;
  popular?: boolean;
}

// Message types
export interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  type: MessageType;
  session_id?: string;
  created_at: string;
  read_at?: string;
  media_url?: string;
}

export type MessageType = 'text' | 'image' | 'video' | 'voice' | 'tip';

// Agora types
export interface AgoraToken {
  token: string;
  channel: string;
  uid: string;
  role: 'host' | 'audience';
  expires_at: number;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// Form types
export interface SignupFormData {
  email: string;
  password: string;
  username: string;
  name?: string;
  is_creator?: boolean;
  creator_type?: string;
}

export interface LoginFormData {
  email: string;
  password: string;
}

export interface ProfileUpdateForm {
  bio?: string;
  profile_pic_url?: string;
  username?: string;
  stream_price?: number;
  video_price?: number;
  voice_price?: number;
  message_price?: number;
  creator_type?: string;
  show_token_balance?: boolean;
  gallery_photos?: string[];
  stream_audience_control?: boolean;
  state?: string;
  country?: string;
}

export interface SessionCreateForm {
  creator_id: string;
  type: SessionType;
  scheduled_time?: string;
  estimated_duration?: number;
}

// WebSocket event types
export interface WSMessage {
  type: WSEventType;
  payload: any;
  timestamp: number;
}

export type WSEventType = 
  | 'session.started'
  | 'session.ended'
  | 'message.new'
  | 'token.updated'
  | 'user.online'
  | 'user.offline'
  | 'stream.started'
  | 'stream.ended';

// Notification types
export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  action_url?: string;
  metadata?: Record<string, any>;
}

export type NotificationType = 
  | 'session_request'
  | 'session_started'
  | 'session_ended'
  | 'payment_received'
  | 'tip_received'
  | 'message_received'
  | 'follower_new';