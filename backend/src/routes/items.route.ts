import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { itemController } from '../controllers/items.controller';

const router = Router();

router.get('/', asyncHandler(itemController.getAllItems));
router.post('/', asyncHandler(itemController.createCustomerItem));
router.get('/item/:id', asyncHandler(itemController.getCustomerItemById));
router.put('/item/:id', asyncHandler(itemController.updateCustomerItem));
router.patch('/item/:id/quantity', asyncHandler(itemController.updateItemQuantity));
router.delete('/item/:id', asyncHandler(itemController.deleteCustomerItem));

router.get('/customer/:customerId', asyncHandler(itemController.getCustomerItems));

export default router;