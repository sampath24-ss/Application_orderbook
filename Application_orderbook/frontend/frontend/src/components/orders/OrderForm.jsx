import React, { useState, useEffect } from 'react';

const OrderForm = ({ onSubmit, onCancel, initialData = null, customers = [], disabled = false }) => {
    const [formData, setFormData] = useState({
        customerId: '',
        items: [],
        totalAmount: '',
        status: 'PENDING',
        notes: '',
        deliveryDate: ''
    });

    useEffect(() => {
        if (initialData) {
            setFormData({
                customerId: initialData.customerId || '',
                items: initialData.items || [],
                totalAmount: initialData.totalAmount?.toString() || '',
                status: initialData.status || 'PENDING',
                notes: initialData.notes || '',
                deliveryDate: initialData.deliveryDate 
                    ? (typeof initialData.deliveryDate === 'string' 
                        ? initialData.deliveryDate.split('T')[0] 
                        : new Date(initialData.deliveryDate).toISOString().split('T')[0])
                    : ''
            });
        }
    }, [initialData]);

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit({
            ...formData,
            totalAmount: parseFloat(formData.totalAmount),
            deliveryDate: formData.deliveryDate || null,
            notes: formData.notes || null
        });
    };

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    return (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">
                {initialData ? 'Edit Order' : 'Create New Order'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <select
                        name="customerId"
                        value={formData.customerId}
                        onChange={handleChange}
                        required
                        disabled={disabled || !!initialData} // Disable customer selection when editing
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <option value="">Select Customer *</option>
                        {customers.map((customer) => (
                            <option key={customer.id} value={customer.id}>
                                {customer.name}
                            </option>
                        ))}
                    </select>
                    <input
                        type="number"
                        name="totalAmount"
                        step="0.01"
                        placeholder="Total Amount *"
                        value={formData.totalAmount}
                        onChange={handleChange}
                        required
                        disabled={disabled}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <input
                        type="date"
                        name="deliveryDate"
                        placeholder="Delivery Date"
                        value={formData.deliveryDate}
                        onChange={handleChange}
                        disabled={disabled}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <select
                        name="status"
                        value={formData.status}
                        onChange={handleChange}
                        disabled={disabled}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <option value="PENDING">Pending</option>
                        <option value="CONFIRMED">Confirmed</option>
                        <option value="PROCESSING">Processing</option>
                        <option value="SHIPPED">Shipped</option>
                        <option value="DELIVERED">Delivered</option>
                        <option value="CANCELLED">Cancelled</option>
                    </select>
                </div>
                <textarea
                    name="notes"
                    placeholder="Order Notes"
                    value={formData.notes}
                    onChange={handleChange}
                    rows="3"
                    disabled={disabled}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <div className="flex gap-3">
                    <button
                        type="submit"
                        disabled={disabled}
                        className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {disabled ? 'Processing...' : (initialData ? 'Update Order' : 'Create Order')}
                    </button>
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={disabled}
                        className="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    );
};

export default OrderForm;