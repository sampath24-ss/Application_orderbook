import React from 'react';
import { Trash2 } from 'lucide-react';

const OrderTable = ({ orders, customers, onCancel, onDelete, loading }) => {
    const getCustomerName = (customerId) => {
        const customer = customers.find(c => c.id === customerId);
        return customer ? customer.name : 'Unknown';
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'PENDING': return 'bg-yellow-100 text-yellow-800';
            case 'COMPLETED': return 'bg-green-100 text-green-800';
            case 'CANCELLED': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    if (loading) {
        return <p className="text-gray-500 p-6">Loading orders...</p>;
    }

    if (orders.length === 0) {
        return <p className="text-gray-500 p-6">No orders found</p>;
    }

    return (
        <div className="bg-white rounded-lg shadow-md p-6">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-gray-200">
                            <th className="text-left py-3 px-4">Order ID</th>
                            <th className="text-left py-3 px-4">Customer</th>
                            <th className="text-left py-3 px-4">Total Amount</th>
                            <th className="text-left py-3 px-4">Status</th>
                            <th className="text-left py-3 px-4">Date</th>
                            <th className="text-right py-3 px-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {orders.map((order) => (
                            <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50">
                                <td className="py-3 px-4 font-medium">#{order.id.slice(0, 8)}</td>
                                <td className="py-3 px-4">{getCustomerName(order.customerId)}</td>
                                <td className="py-3 px-4">${order.totalAmount?.toFixed(2) || '0.00'}</td>
                                <td className="py-3 px-4">
                                    <span className={`px-3 py-1 rounded-full text-sm ${getStatusColor(order.status)}`}>
                                        {order.status}
                                    </span>
                                </td>
                                <td className="py-3 px-4">
                                    {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '-'}
                                </td>
                                <td className="py-3 px-4 text-right">
                                    {order.status !== 'CANCELLED' && (
                                        <button
                                            onClick={() => onCancel(order.id)}
                                            className="text-orange-600 hover:text-orange-800 mr-3"
                                        >
                                            Cancel
                                        </button>
                                    )}
                                    <button
                                        onClick={() => onDelete(order.id)}
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

export default OrderTable;