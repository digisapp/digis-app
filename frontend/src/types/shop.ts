/**
 * Shop-related TypeScript type definitions
 */

export interface Product {
  id: number | string;
  name: string;
  description?: string;
  price: number; // in tokens
  type: 'digital' | 'physical';
  category?: string;
  stock?: number; // for physical products
  sales?: number;
  rating?: number;
  reviews?: number;
  thumbnail?: string;
  images?: string[];
  createdAt?: string;
  updatedAt?: string;
  creatorId?: string;
  isActive?: boolean;
  tags?: string[];
  downloadUrl?: string; // for digital products
  shippingInfo?: ShippingInfo; // for physical products
}

export interface ShippingInfo {
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  shippingClass?: 'standard' | 'express' | 'overnight';
  estimatedDays?: number;
}

export interface Order {
  id: number | string;
  orderId: string;
  customerId: string;
  customerName?: string;
  customerEmail?: string;
  products: OrderItem[];
  totalAmount: number; // in tokens
  status: OrderStatus;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  shippingAddress?: Address;
  billingAddress?: Address;
  trackingNumber?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;
}

export interface OrderItem {
  productId: number | string;
  productName: string;
  quantity: number;
  price: number; // unit price in tokens
  total: number; // quantity * price
  type: 'digital' | 'physical';
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  phone?: string;
}

export type OrderStatus = 
  | 'pending'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export interface ShopSettings {
  id?: string;
  creatorId: string;
  shopName?: string;
  shopUrl?: string;
  description?: string;
  bannerImage?: string;
  logoImage?: string;
  isActive: boolean;
  policies?: {
    returns?: string;
    shipping?: string;
    privacy?: string;
  };
  socialLinks?: {
    instagram?: string;
    twitter?: string;
    website?: string;
  };
  paymentMethods?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ShopAnalytics {
  totalSales: number;
  totalRevenue: number; // in tokens
  totalOrders: number;
  totalProducts: number;
  averageOrderValue: number;
  averageRating: number;
  topProducts: ProductAnalytics[];
  recentOrders: Order[];
  salesByPeriod?: SalesPeriod[];
  conversionRate?: number;
}

export interface ProductAnalytics {
  product: Product;
  views: number;
  sales: number;
  revenue: number; // in tokens
  conversionRate: number;
  trend: 'up' | 'down' | 'stable';
}

export interface SalesPeriod {
  period: string; // e.g., '2024-01', '2024-W01', '2024-01-15'
  sales: number;
  revenue: number; // in tokens
  orders: number;
}

export interface ShopCustomer {
  id: string;
  name: string;
  email: string;
  totalPurchases: number;
  totalSpent: number; // in tokens
  lastPurchase?: string;
  favoriteProducts?: Product[];
  isRepeatCustomer: boolean;
}