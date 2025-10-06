// src/pages/OrdersPage.jsx
import React, { useState } from 'react';
import { ShoppingCart, Plus } from 'lucide-react';
import { useOrders } from '../hooks/useOrders';
import { useCustomers } from '../hooks/useCustomers';
import OrderForm from '../components/orders/OrderForm';
import OrderTable from '../components/orders/OrderTable';

const OrdersPage = () => {
    const { orders, loading, createOrder, cancelOrder, deleteOrder } = useOrders();
    const { customers } = useCustomers();
    const [showForm, setShowForm] = useState(false);

    const handleSubmit = async (formData) => {
        const result = await createOrder(formData);
        if (result.success) {
            setShowForm(false);
        }
    };

    const handleCancel = async (id) => {
        if (window.confirm('Are you sure you want to cancel this order?')) {
            await cancelOrder(id);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this order?')) {
            await deleteOrder(id);
        }
    };

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <ShoppingCart className="w-8 h-8 text-purple-600" />
                    <h1 className="text-3xl font-bold text-gray-800">Orders</h1>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition flex items-center gap-2"
                >
                    <Plus className="w-5 h-5" />
                    Create Order
                </button>
            </div>

            {showForm && (
                <OrderForm
                    onSubmit={handleSubmit}
                    onCancel={() => setShowForm(false)}
                    customers={customers}
                />
            )}

            <OrderTable
                orders={orders}
                customers={customers}
                onCancel={handleCancel}
                onDelete={handleDelete}
                loading={loading}
            />
        </div>
    );
};

export default OrdersPage;