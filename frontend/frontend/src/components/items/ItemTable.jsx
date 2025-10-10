import React from 'react';
import { Edit2, Trash2, DollarSign, Package } from 'lucide-react';

const ItemTable = ({ items, customers, onEdit, onDelete, onQuantityUpdate, loading }) => {
    const getCustomerName = (customerId) => {
        console.log('Looking for customer:', customerId, 'in', customers);
        const customer = customers.find(c => c.id === customerId);
        console.log('Found customer:', customer);
        return customer ? customer.name : 'Unknown';
    };

    if (loading) {
        return (
            <div className="bg-white rounded-lg shadow-md p-8 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading items...</p>
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="bg-white rounded-lg shadow-md p-8 text-center">
                <p className="text-gray-600">No items found. Create your first item!</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Item
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Customer
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Price
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Quantity
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Category
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {items.map((item) => (
                            <tr key={item.id} className="hover:bg-gray-50 transition">
                                <td className="px-6 py-4">
                                    <div className="flex items-start gap-3">
                                        <Package className="w-5 h-5 text-green-600 mt-1" />
                                        <div>
                                            <div className="text-sm font-medium text-gray-900">{item.name}</div>
                                            {item.description && (
                                                <div className="text-sm text-gray-500 max-w-xs truncate">
                                                    {item.description}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-gray-900">{getCustomerName(item.customerId)}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center gap-1 text-sm text-gray-900">
                                        <DollarSign className="w-4 h-4" />
                                        <td className="py-3 px-4">${parseFloat(item.price || 0).toFixed(2)}</td>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <input
                                        type="number"
                                        min="0"
                                        value={item.quantity}
                                        onChange={(e) => onQuantityUpdate(item.id, e.target.value)}
                                        className="w-20 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                                    />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {item.category && (
                                        <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                                            {item.category}
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <div className="flex justify-end gap-2">
                                        <button
                                            onClick={() => onEdit(item)}
                                            className="text-green-600 hover:text-green-900 p-2 rounded-lg hover:bg-green-50 transition"
                                            title="Edit"
                                        >
                                            <Edit2 className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => onDelete(item.id)}
                                            className="text-red-600 hover:text-red-900 p-2 rounded-lg hover:bg-red-50 transition"
                                            title="Delete"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
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