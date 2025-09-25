import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { CustomerController } from '../controllers/customer.controller';

const router = Router();


router.post('/', asyncHandler(CustomerController.createCustomer));

router.get('/', asyncHandler(CustomerController.getAllCustomers));

router.get('/:id', asyncHandler(CustomerController.getCustomerById));

router.put('/:id', asyncHandler(CustomerController.updateCustomer));

router.delete('/:id', asyncHandler(CustomerController.deleteCustomer));

export default router;