import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { OrderController } from '../controllers/order.controller';

const router = Router();


router.post('/', asyncHandler(OrderController.createOrder));

router.get('/', asyncHandler(OrderController.getAllOrders));

router.get('/customer/:customerId', asyncHandler(OrderController.getOrdersByCustomerId));


router.get('/:id', asyncHandler(OrderController.getOrderById));

router.put('/:id', asyncHandler(OrderController.updateOrder));

router.post('/:id/cancel', asyncHandler(OrderController.cancelOrder));

router.delete('/:id', asyncHandler(OrderController.deleteOrder));

export default router; 