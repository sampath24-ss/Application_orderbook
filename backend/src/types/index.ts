// types/index.ts - Complete Enhanced Types

// Base entity interface for all entities
export interface BaseEntity {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    tenantId?: string | undefined; // Multi-tenant support
}

// Customer interfaces
export interface Customer extends BaseEntity {
    name: string;
    email: string;
    phone?: string | undefined;
    address?: string | undefined;
    status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
}

export interface CreateCustomerRequest {
    name: string;
    email: string;
    phone?: string;
    address?: string;
    tenantId?: string;
}

export interface UpdateCustomerRequest {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
}

// Customer Item interfaces
export interface CustomerItem extends BaseEntity {
    customerId: string;
    name: string;
    description?: string | undefined;
    price: number;
    quantity: number;
    category?: string | undefined;
    status: 'ACTIVE' | 'INACTIVE' | 'OUT_OF_STOCK';
    minStockLevel?: number | undefined; // For inventory alerts
}

export interface CreateCustomerItemRequest {
    customerId: string;
    name: string;
    description?: string;
    price: number;
    quantity: number;
    category?: string;
    minStockLevel?: number;
    tenantId?: string;
}

export interface UpdateCustomerItemRequest {
    name?: string;
    description?: string;
    price?: number;
    quantity?: number;
    category?: string;
    status?: 'ACTIVE' | 'INACTIVE' | 'OUT_OF_STOCK';
    minStockLevel?: number;
}

// Order interfaces
export interface Order extends BaseEntity {
    customerId: string;
    items: OrderItem[];
    totalAmount: number;
    status: OrderStatus;
    orderDate: Date;
    deliveryDate: Date | null;
    notes: string | null;
    paymentStatus: PaymentStatus;
    shippingAddress: string | null;
    discount: number;
    taxAmount: number;
    shippingCost: number;
    orderNumber: string;
    priority: OrderPriority;
}

export interface OrderItem {
    id: string;
    itemId: string;
    name: string;
    description: string | null;
    price: number;
    quantity: number;
    subtotal: number;
    discountAmount: number;
    taxAmount: number;
    sku: string | null;
}

export interface CreateOrderRequest {
    status: OrderStatus;
    customerId: string;
    items: CreateOrderItemRequest[];
    notes: string | null;
    deliveryDate: Date | null;
    shippingAddress: string | null;
    tenantId: string | null;
    priority: OrderPriority;
    discountCode: string | null;
    specialInstructions: string | null;
}

export interface CreateOrderItemRequest {
    itemId: string;
    quantity: number;
    specialInstructions: string | null;
}

export interface UpdateOrderRequest {
    status: OrderStatus | null;
    deliveryDate: Date | null;
    notes: string | null;
    paymentStatus: PaymentStatus | null;
    shippingAddress: string | null;
    priority: OrderPriority | null;
    trackingNumber: string | null;
    cancelReason: string | null;
}

export enum OrderStatus {
    DRAFT = 'DRAFT',
    PENDING = 'PENDING',
    CONFIRMED = 'CONFIRMED',
    PROCESSING = 'PROCESSING',
    PACKED = 'PACKED',
    SHIPPED = 'SHIPPED',
    OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
    DELIVERED = 'DELIVERED',
    CANCELLED = 'CANCELLED',
    REFUNDED = 'REFUNDED',
    RETURNED = 'RETURNED',
    FAILED = 'FAILED'
}

export enum PaymentStatus {
    PENDING = 'PENDING',
    AUTHORIZED = 'AUTHORIZED',
    PAID = 'PAID',
    FAILED = 'FAILED',
    REFUNDED = 'REFUNDED',
    PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
    CANCELLED = 'CANCELLED',
    EXPIRED = 'EXPIRED'
}

export enum OrderPriority {
    LOW = 'LOW',
    NORMAL = 'NORMAL',
    HIGH = 'HIGH',
    URGENT = 'URGENT'
}

export interface OrderStatusHistory {
    id: string;
    orderId: string;
    fromStatus: OrderStatus | null;
    toStatus: OrderStatus;
    reason: string | null;
    updatedBy: string | null;
    timestamp: Date;
    notes: string | null;
}

export interface OrderPayment {
    id: string;
    orderId: string;
    amount: number;
    paymentMethod: PaymentMethod;
    paymentStatus: PaymentStatus;
    transactionId: string | null;
    processedAt: Date | null;
    failureReason: string | null;
    refundAmount: number;
    refundedAt: Date | null;
}

export enum PaymentMethod {
    CREDIT_CARD = 'CREDIT_CARD',
    DEBIT_CARD = 'DEBIT_CARD',
    BANK_TRANSFER = 'BANK_TRANSFER',
    PAYPAL = 'PAYPAL',
    STRIPE = 'STRIPE',
    CASH_ON_DELIVERY = 'CASH_ON_DELIVERY',
    WALLET = 'WALLET',
    CRYPTOCURRENCY = 'CRYPTOCURRENCY'
}

export interface OrderShipment {
    id: string;
    orderId: string;
    trackingNumber: string;
    carrier: string;
    shippedDate: Date | null;
    estimatedDelivery: Date | null;
    actualDelivery: Date | null;
    shippingCost: number;
    shippingAddress: OrderAddress;
    status: ShipmentStatus;
}

export enum ShipmentStatus {
    PENDING = 'PENDING',
    PICKED_UP = 'PICKED_UP',
    IN_TRANSIT = 'IN_TRANSIT',
    OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
    DELIVERED = 'DELIVERED',
    FAILED_DELIVERY = 'FAILED_DELIVERY',
    RETURNED_TO_SENDER = 'RETURNED_TO_SENDER',
    LOST = 'LOST',
    DAMAGED = 'DAMAGED'
}

export interface OrderAddress {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone: string | null;
    instructions: string | null;
}

export interface OrderDiscount {
    id: string;
    orderId: string;
    discountCode: string;
    discountType: DiscountType;
    discountValue: number;
    appliedAmount: number;
    description: string;
}

export enum DiscountType {
    PERCENTAGE = 'PERCENTAGE',
    FIXED_AMOUNT = 'FIXED_AMOUNT',
    BUY_ONE_GET_ONE = 'BUY_ONE_GET_ONE',
    FREE_SHIPPING = 'FREE_SHIPPING'
}

export interface OrderTax {
    id: string;
    orderId: string;
    taxType: string;
    taxRate: number;
    taxAmount: number;
    taxableAmount: number;
}

export interface OrderAnalytics {
    totalOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
    ordersByStatus: Record<OrderStatus, number>;
    ordersByPaymentStatus: Record<PaymentStatus, number>;
    topCustomers: Array<{
        customerId: string;
        customerName: string;
        orderCount: number;
        totalSpent: number;
    }>;
    revenueByPeriod: Array<{
        period: string;
        revenue: number;
        orderCount: number;
    }>;
}

export interface OrderFilters {
    status: OrderStatus[] | null;
    paymentStatus: PaymentStatus[] | null;
    customerId: string | null;
    orderNumber: string | null;
    minAmount: number | null;
    maxAmount: number | null;
    startDate: Date | null;
    endDate: Date | null;
    priority: OrderPriority[] | null;
    tenantId: string | null;
    hasDiscount: boolean | null;
    paymentMethod: PaymentMethod[] | null;
}

export interface BulkOrderUpdate {
    orderIds: string[];
    updates: Partial<UpdateOrderRequest>;
    reason: string;
    updatedBy: string;
}

export interface OrderValidationResult {
    isValid: boolean;
    errors: OrderValidationError[];
    warnings: OrderValidationWarning[];
}

export interface OrderValidationError {
    field: string;
    message: string;
    code: string;
    value: any;
}

export interface OrderValidationWarning {
    field: string;
    message: string;
    suggestion: string;
}

// Enhanced Kafka Event interfaces
export interface KafkaEventMetadata {
    userId?: string;
    tenantId?: string;
    correlationId?: string;
    requestId?: string;
    source?: 'API' | 'ENGINE' | 'WEBSOCKET' | 'SCHEDULER';
    retryCount?: number;
    originalTimestamp?: Date;
    traceId?: string; // For distributed tracing
}

export interface KafkaEvent {
    eventId: string;
    eventType: string;
    timestamp: Date;
    data: any;
    metadata?: KafkaEventMetadata;
}

// Specific event types for better type safety
export type CustomerEventType = 
    | 'CUSTOMER_CREATED' 
    | 'CUSTOMER_UPDATED' 
    | 'CUSTOMER_DELETED'
    | 'CUSTOMER_REQUESTED'
    | 'CUSTOMERS_REQUESTED'
    | 'CUSTOMER_STATUS_CHANGED';

export type CustomerUpdateEventType = 
    | 'CUSTOMER_CREATED_SUCCESS'
    | 'CUSTOMER_CREATED_FAILED'
    | 'CUSTOMER_UPDATED_SUCCESS'
    | 'CUSTOMER_UPDATED_FAILED'
    | 'CUSTOMER_DELETED_SUCCESS'
    | 'CUSTOMER_DELETED_FAILED'
    | 'CUSTOMER_FOUND'
    | 'CUSTOMER_NOT_FOUND'
    | 'CUSTOMERS_LIST_RESPONSE';

export type ItemEventType = 
    | 'ITEM_CREATED' 
    | 'ITEM_UPDATED' 
    | 'ITEM_DELETED'
    | 'ITEM_REQUESTED'
    | 'ITEMS_REQUESTED'
    | 'ALL_ITEMS_REQUESTED'
    | 'ITEM_QUANTITY_UPDATED'
    | 'ITEM_LOW_STOCK_ALERT';

export type ItemUpdateEventType = 
    | 'ITEM_CREATED_SUCCESS'
    | 'ITEM_CREATED_FAILED'
    | 'ITEM_UPDATED_SUCCESS'
    | 'ITEM_UPDATED_FAILED'
    | 'ITEM_DELETED_SUCCESS'
    | 'ITEM_DELETED_FAILED'
    | 'ITEM_FOUND'
    | 'ITEM_NOT_FOUND'
    | 'CUSTOMER_ITEMS_RESPONSE'
    | 'ALL_ITEMS_RESPONSE'
    | 'ITEM_QUANTITY_UPDATED_SUCCESS'
    | 'ITEM_QUANTITY_UPDATED_FAILED';

export type OrderEventType = 
    | 'ORDER_CREATED' 
    | 'ORDER_UPDATED' 
    | 'ORDER_CANCELLED'
    | 'ORDER_REQUESTED'
    | 'CUSTOMER_ORDERS_REQUESTED'
    | 'ALL_ORDERS_REQUESTED'
    | 'ORDER_DELETED'
    | 'ORDER_PAYMENT_UPDATED';

export type OrderUpdateEventType = 
    | 'ORDER_CREATED_SUCCESS'
    | 'ORDER_CREATED_FAILED'
    | 'ORDER_UPDATED_SUCCESS'
    | 'ORDER_UPDATED_FAILED'
    | 'ORDER_CANCELLED_SUCCESS'
    | 'ORDER_CANCEL_FAILED'
    | 'ORDER_FOUND'
    | 'ORDER_NOT_FOUND'
    | 'CUSTOMER_ORDERS_RESPONSE'
    | 'ALL_ORDERS_RESPONSE'
    | 'ORDER_DELETED_SUCCESS'
    | 'ORDER_DELETE_FAILED';

export interface CustomerEvent extends KafkaEvent {
    eventType: CustomerEventType;
    data: Customer | CreateCustomerRequest | UpdateCustomerRequest | any;
}

export interface CustomerItemEvent extends KafkaEvent {
    eventType: ItemEventType;
    data: CustomerItem | CreateCustomerItemRequest | UpdateCustomerItemRequest | any;
}

export interface OrderEvent extends KafkaEvent {
    eventType: OrderEventType;
    data: Order | CreateOrderRequest | UpdateOrderRequest | any;
}

// Update event interfaces
export interface CustomerUpdateEvent extends KafkaEvent {
    eventType: CustomerUpdateEventType;
    data: Customer | any;
}

export interface ItemUpdateEvent extends KafkaEvent {
    eventType: ItemUpdateEventType;
    data: CustomerItem | any;
}

export interface OrderUpdateEvent extends KafkaEvent {
    eventType: OrderUpdateEventType;
    data: Order | any;
}

// Response interfaces
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    message?: string;
    errors?: string[];
    timestamp: Date;
    requestId?: string;
    correlationId?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrevious: boolean;
    };
}

export interface ApiError extends Error {
    statusCode: number;
    message: string;
    details?: any;
    correlationId?: string;
    timestamp: Date;
}

// Search and filter interfaces
export interface SearchFilters {
    search?: string;
    category?: string;
    status?: string;
    minPrice?: number;
    maxPrice?: number;
    startDate?: Date;
    endDate?: Date;
    tenantId?: string;
    customerId?: string;
    lowStock?: boolean;
}

export interface PaginationOptions {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
}

// Event processing results
export interface EventProcessingResult {
    success: boolean;
    shouldPublishUpdate: boolean;
    updateEvent?: KafkaEvent;
    error?: string;
    processingTime?: number;
    retryable?: boolean;
}

// WebSocket message types
export interface WebSocketMessage {
    type: 'EVENT_UPDATE' | 'SUBSCRIPTION_ACK' | 'ERROR' | 'HEARTBEAT' | 'CONNECTION_ACK'| 'PONG';
    data: any;
    timestamp: Date;
    correlationId?: string;
}

export interface WebSocketSubscription {
    userId?: string | undefined;
    tenantId?: string | undefined;
    eventTypes: string[];
    channels: string[];
}

export interface WebSocketClient {
    id: string;
    userId?: string | undefined;
    tenantId?: string | undefined;
    subscriptions: WebSocketSubscription[];
    connectedAt: Date;
    lastActivity: Date;
}

// Database query interfaces
export interface QueryOptions extends PaginationOptions {
    filters?: SearchFilters;
    includeDeleted?: boolean;
    tenantId?: string;
}

export interface QueryResult<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

// Audit and logging
export interface AuditLog {
    id: string;
    entityType: 'CUSTOMER' | 'ITEM' | 'ORDER';
    entityId: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW';
    userId?: string;
    tenantId?: string;
    oldData?: any;
    newData?: any;
    timestamp: Date;
    ipAddress?: string;
    userAgent?: string;
}

// Health check
export interface HealthCheck {
    service: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: Date;
    uptime: number;
    version?: string;
    components: {
        database: 'healthy' | 'unhealthy';
        kafka: 'healthy' | 'unhealthy';
        redis?: 'healthy' | 'unhealthy';
        websocket?: 'healthy' | 'unhealthy';
    };
    metrics?: {
        memoryUsage?: number;
        cpuUsage?: number;
        activeConnections?: number;
        processedEvents?: number;
    };
}

// Configuration interfaces
export interface KafkaTopics {
    customerEvents: string;
    customerItemsEvents: string;
    orderEvents: string;
    customerUpdates: string;
    itemUpdates: string;
    orderUpdates: string;
    notifications?: string;
    deadLetter?: string;
}

export interface DatabaseConfig {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    maxConnections: number;
    ssl: boolean;
}

export interface KafkaConfig {
    brokers: string[];
    clientId: string;
    groupId: string;
    topics: KafkaTopics;
    producer: any;
    consumer: any;
}

// Service interfaces
export interface ServiceResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    timestamp: Date;
}

export interface ServiceHealthStatus {
    healthy: boolean;
    lastCheck: Date;
    error?: string;
}

// Notification interfaces
export interface NotificationPayload {
    type: 'SUCCESS' | 'ERROR' | 'WARNING' | 'INFO';
    title: string;
    message: string;
    data?: any;
    userId?: string;
    tenantId?: string;
    channels: ('EMAIL' | 'SMS' | 'PUSH' | 'WEBSOCKET')[];
}

// Analytics interfaces
export interface AnalyticsEvent {
    eventType: string;
    entityType: string;
    entityId: string;
    userId?: string;
    tenantId?: string;
    properties?: Record<string, any>;
    timestamp: Date;
}

export interface AnalyticsQuery {
    metric: string;
    dimensions?: string[];
    filters?: Record<string, any>;
    timeRange: {
        start: Date;
        end: Date;
    };
    tenantId?: string;
}

// Rate limiting
export interface RateLimit {
    windowMs: number;
    maxRequests: number;
    message?: string;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
}

// Caching
export interface CacheOptions {
    ttl: number; // Time to live in seconds
    key: string;
    tags?: string[];
}

// Validation schemas (for Joi)
export interface ValidationSchema {
    body?: any;
    params?: any;
    query?: any;
    headers?: any;
}

// Error types
export class ValidationError extends Error {
    constructor(
        message: string, 
        public field: string, 
        public value: any
    ) {
        super(message);
        this.name = 'ValidationError';
    }
}

export class NotFoundError extends Error {
    constructor(message: string, public entityType: string, public entityId: string) {
        super(message);
        this.name = 'NotFoundError';
    }
}

export class ConflictError extends Error {
    constructor(message: string, public details?: any) {
        super(message);
        this.name = 'ConflictError';
    }
}

export class UnauthorizedError extends Error {
    constructor(message: string = 'Unauthorized') {
        super(message);
        this.name = 'UnauthorizedError';
    }
}

export class ForbiddenError extends Error {
    constructor(message: string = 'Forbidden') {
        super(message);
        this.name = 'ForbiddenError';
    }
}

// Export commonly used type unions
export type EntityStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'OUT_OF_STOCK';
export type EventSource = 'API' | 'ENGINE' | 'WEBSOCKET' | 'SCHEDULER';
export type NotificationChannel = 'EMAIL' | 'SMS' | 'PUSH' | 'WEBSOCKET';
export type NotificationType = 'SUCCESS' | 'ERROR' | 'WARNING' | 'INFO';
export type SortOrder = 'ASC' | 'DESC';
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';