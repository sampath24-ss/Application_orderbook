export interface Customer {
    id: string;
    name: string;
    email: string;
    phone?: string;
    address?: string;
    createdAt: Date;
    updatedAt: Date
}

export interface CreateCustomerRequest {
    name: string;
    email: string;
    phone?: string;
    address?: string;
}

export interface UpdateCustomerRequest {
    name?: string;
    email?: string;
    phone?: string;
    address?: string
}

export interface CustomerItem {
    id: string;
    customerId: string;
    name: string;
    description?: string;
    price: number;
    quantity: number;
    category?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateCustomerItemRequest {
    customerId: string;
    name: string;
    description?: string;
    price: number;
    quantity: number;
    category?: string;
}

export interface UpdateCustomerItemRequest {
    name?: string;
    description?: string;
    price?: number;
    quantity?: number;
    category?: string;
}

export interface Order {
    id: string;
    customerId: string;
    items: OrderItem[];
    totalAmount: number;
    status: OrderStatus;
    orderDate: Date;
    deliveryDate?: Date;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface OrderItem {
    itemId: string;
    name: string;
    price: number;
    quantity: number;
    subtotal: number;
}

export interface CreateOrderRequest {
    customerId: string;
    items: {
        itemId: string;
        quantity: number;
    }[];
    notes?: string;
    deliveryDate?: Date;
}

export interface UpdateOrderRequest {
    status?: OrderStatus;
    deliveryDate?: Date;
    notes?: string;
}

export enum OrderStatus {
    PENDING = 'PENDING',
    CONFIRMED = 'CONFIRMED',
    PROCESSING = 'PROCESSING',
    SHIPPED = 'SHIPPED',
    DELIVERED = 'DELIVERED',
    CANCELLED = 'CANCELLED'
}

export interface KafkaEvent {
    eventType: string;
    eventId: string;
    timestamp: Date;
    data: any;
    metadata?: {
        userId?: string;
        tenantId?: string;
        correlationId?: string;
    };
}

export interface CustomerEvent extends KafkaEvent {
    eventType: 'CUSTOMER_CREATED' | 'CUSTOMER_UPDATED' | 'CUSTOMER_DELETED';
    data: Customer | CreateCustomerRequest | UpdateCustomerRequest;
}

export interface CustomerItemEvent extends KafkaEvent {
    eventType: 'ITEM_CREATED' | 'ITEM_UPDATED' | 'ITEM_DELETED';
    data: CustomerItem | CreateCustomerItemRequest | UpdateCustomerItemRequest;
}

export interface OrderEvent extends KafkaEvent {
    eventType: 'ORDER_CREATED' | 'ORDER_UPDATED' | 'ORDER_CANCELLED';
    data: Order | CreateOrderRequest | UpdateOrderRequest;
}

export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    message?: string;
    errors?: string[];
    timestamp: Date;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export interface ApiError {
    statusCode: number;
    message: string;
    details?: any;
}