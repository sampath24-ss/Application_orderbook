import React, { useState, useEffect } from 'react';

const ItemForm = ({ onSubmit, onCancel, initialData = null, customers = [] }) => {
    const [formData, setFormData] = useState({
        customerId: '',
        name: '',
        description: '',
        price: '',
        quantity: '',
        category: ''
    });

    useEffect(() => {
        if (initialData) {
            setFormData({
                ...initialData,
                price: initialData.price?.toString() || '',
                quantity: initialData.quantity?.toString() || ''
            });
        }
    }, [initialData]);

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit({
            ...formData,
            price: parseFloat(formData.price),
            quantity: parseInt(formData.quantity)
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
                {initialData ? 'Edit Item' : 'Add New Item'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <select
                        name="customerId"
                        value={formData.customerId}
                        onChange={handleChange}
                        required
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                        <option value="">Select Customer *</option>
                        {customers.map((customer) => (
                            <option key={customer.id} value={customer.id}>
                                {customer.name}
                            </option>
                        ))}
                    </select>
                    <input
                        type="text"
                        name="name"
                        placeholder="Item Name *"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <input
                        type="text"
                        name="description"
                        placeholder="Description"
                        value={formData.description}
                        onChange={handleChange}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <input
                        type="text"
                        name="category"
                        placeholder="Category"
                        value={formData.category}
                        onChange={handleChange}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <input
                        type="number"
                        name="price"
                        step="0.01"
                        placeholder="Price *"
                        value={formData.price}
                        onChange={handleChange}
                        required
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <input
                        type="number"
                        name="quantity"
                        placeholder="Quantity *"
                        value={formData.quantity}
                        onChange={handleChange}
                        required
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                </div>
                <div className="flex gap-3">
                    <button
                        type="submit"
                        className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition"
                    >
                        {initialData ? 'Update' : 'Create'}
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

export default ItemForm;