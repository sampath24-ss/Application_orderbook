import React from 'react';
import { Edit, Trash2 } from 'lucide-react';

const ItemTable = ({ items, customers, onEdit, onDelete, onQuantityUpdate, loading }) => {
    const getCustomerName = (customerId) => {
        const customer = customers.find(c => c.id === customerId);
        return customer ? customer.name : '-';
    };

    if (loading) {
        return <p className="text-gray-500 p-6">Loading items...</p>;
    }

    if (items.length === 0) {
        return <p className="text-gray-500 p-6">No items found</p>;
    }

    return (
        <div className="bg-white rounded-lg shadow-md p-6">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-gray-200">
                            <th className="text-left py-3 px-4">Name</th>
                            <th className="text-left py-3 px-4">Category</th>
                            <th className="text-left py-3 px-4">Price</th>
                            <th className="text-left py-3 px-4">Quantity</th>
                            <th className="text-left py-3 px-4">Customer</th>
                            <th className="text-right py-3 px-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item) => (
                            <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                                <td className="py-3 px-4 font-medium">{item.name}</td>
                                <td className="py-3 px-4">{item.category || '-'}</td>
                                <td className="py-3 px-4">${item.price.toFixed(2)}</td>
                                <td className="py-3 px-4">
                                    <input
                                        type="number"
                                        value={item.quantity}
                                        onChange={(e) => onQuantityUpdate(item.id, e.target.value)}
                                        className="w-20 px-2 py-1 border border-gray-300 rounded"
                                    />
                                </td>
                                <td className="py-3 px-4">{getCustomerName(item.customerId)}</td>
                                <td className="py-3 px-4 text-right">
                                    <button
                                        onClick={() => onEdit(item)}
                                        className="text-green-600 hover:text-green-800 mr-3"
                                    >
                                        <Edit className="w-5 h-5 inline" />
                                    </button>
                                    <button
                                        onClick={() => onDelete(item.id)}
                                        className="text-red-600 hover:text-red-800"
                                    >
                                        <Trash2 className="w-5 h-5 inline" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ItemTable;