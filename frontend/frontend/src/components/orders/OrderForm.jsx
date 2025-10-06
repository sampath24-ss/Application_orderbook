import React, { useState } from 'react';

const OrderForm = ({ onSubmit, onCancel, customers = [] }) => {
    const [formData, setFormData] = useState({
        customerId: '',
        items: [],
        totalAmount: '',
        status: 'PENDING',
        notes: '',
        deliveryDate: ''
    });

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
            <h2 className="text-xl font-semibold mb-4">Create New Order</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <select
                        name="customerId"
                        value={formData.customerId}
                        onChange={handleChange}
                        required
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <input
                        type="date"
                        name="deliveryDate"
                        placeholder="Delivery Date"
                        value={formData.deliveryDate}
                        onChange={handleChange}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <select
                        name="status"
                        value={formData.status}
                        onChange={handleChange}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <div className="flex gap-3">
                    <button
                        type="submit"
                        className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition"
                    >
                        Create Order
                    </button>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-400 transition"
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    );
};

export default OrderForm;