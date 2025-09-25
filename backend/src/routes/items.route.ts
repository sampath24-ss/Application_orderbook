import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { itemController } from '../controllers/items.controller';

const router = Router();

router.get('/', asyncHandler(itemController.getAllItems));
router.post('/', asyncHandler(itemController.createCustomerItem));

router.get('/item/:id', asyncHandler(itemController.getCustomerItemById));
router.get('/:customerId', asyncHandler(itemController.getCustomerItems));

router.put('/:id', asyncHandler(itemController.updateCustomerItem));
router.patch('/:id/quantity', asyncHandler(itemController.updateItemQuantity));
router.delete('/:id', asyncHandler(itemController.deleteCustomerItem));


export default router;