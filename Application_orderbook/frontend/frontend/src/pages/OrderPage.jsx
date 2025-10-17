import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus } from 'lucide-react';
import { useOrders } from '../hooks/useOrders';
import { useCustomers } from '../hooks/useCustomers';
import OrderForm from '../components/orders/OrderForm';
import OrderTable from '../components/orders/OrderTable';

const OrdersPage = () => {
    const { orders, loading: ordersLoading, createOrder, updateOrder, cancelOrder, deleteOrder } = useOrders();
    const { customers, loading: customersLoading, fetchCustomers } = useCustomers();
    const [showForm, setShowForm] = useState(false);
    const [editingOrder, setEditingOrder] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    // Fetch customers when the page loads
    useEffect(() => {
        fetchCustomers();
    }, []);

    const handleSubmit = async (formData) => {
        setSubmitting(true);
        try {
            let result;
            if (editingOrder) {
                console.log('Updating order:', editingOrder.id, formData);
                result = await updateOrder(editingOrder.id, formData);
            } else {
                console.log('Creating new order:', formData);
                result = await createOrder(formData);
            }
            
            if (result.success) {
                setShowForm(false);
                setEditingOrder(null);
            } else {
                alert(result.error || 'Operation failed');
            }
        } catch (error) {
            console.error('Form submission error:', error);
            alert('An error occurred: ' + error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleEdit = (order) => {
        console.log('Editing order:', order);
        setEditingOrder(order);
        setShowForm(true);
    };

    const handleCancel = async (id) => {
        if (window.confirm('Are you sure you want to cancel this order?')) {
            setSubmitting(true);
            try {
                const result = await cancelOrder(id);
                if (!result.success) {
                    alert(result.error || 'Cancel failed');
                }
            } catch (error) {
                console.error('Cancel error:', error);
                alert('An error occurred: ' + error.message);
            } finally {
                setSubmitting(false);
            }
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this order?')) {
            setSubmitting(true);
            try {
                const result = await deleteOrder(id);
                if (!result.success) {
                    alert(result.error || 'Delete failed');
                }
            } catch (error) {
                console.error('Delete error:', error);
                alert('An error occurred: ' + error.message);
            } finally {
                setSubmitting(false);
            }
        }
    };

    const handleFormCancel = () => {
        setShowForm(false);
        setEditingOrder(null);
    };

    const handleAddClick = () => {
        if (customers.length === 0) {
            alert('Please create customers first before creating orders.');
            return;
        }
        setEditingOrder(null);
        setShowForm(!showForm);
    };

    const loading = ordersLoading || customersLoading || submitting;

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <ShoppingCart className="w-8 h-8 text-purple-600" />
                    <h1 className="text-3xl font-bold text-gray-800">Orders</h1>
                    <span className="text-sm text-gray-500">
                        ({customers.length} customer{customers.length !== 1 ? 's' : ''} available)
                    </span>
                </div>
                <button
                    onClick={handleAddClick}
                    disabled={loading}
                    className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Plus className="w-5 h-5" />
                    {editingOrder ? 'Edit Order' : 'Create Order'}
                </button>
            </div>

            {customers.length === 0 && !loading && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                    <p className="text-yellow-800 font-medium">No customers available</p>
                    <p className="text-yellow-700 text-sm mt-1">
                        You need to create customers before you can create orders.
                    </p>
                </div>
            )}

            {showForm && (
                <OrderForm
                    onSubmit={handleSubmit}
                    onCancel={handleFormCancel}
                    initialData={editingOrder}
                    customers={customers}
                    disabled={submitting}
                />
            )}

            <OrderTable
                orders={orders}
                customers={customers}
                onEdit={handleEdit}
                onCancel={handleCancel}
                onDelete={handleDelete}
                loading={loading}
            />
        </div>
    );
};

export default OrdersPage;