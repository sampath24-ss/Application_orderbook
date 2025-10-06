import React from 'react';
import { Edit, Trash2 } from 'lucide-react';

const CustomerTable = ({ customers, onEdit, onDelete, loading }) => {
    if (loading) {
        return <p className="text-gray-500 p-6">Loading customers...</p>;
    }

    if (customers.length === 0) {
        return <p className="text-gray-500 p-6">No customers found</p>;
    }

    return (
        <div className="bg-white rounded-lg shadow-md p-6">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-gray-200">
                            <th className="text-left py-3 px-4">Name</th>
                            <th className="text-left py-3 px-4">Email</th>
                            <th className="text-left py-3 px-4">Phone</th>
                            <th className="text-left py-3 px-4">Address</th>
                            <th className="text-right py-3 px-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {customers.map((customer) => (
                            <tr key={customer.id} className="border-b border-gray-100 hover:bg-gray-50">
                                <td className="py-3 px-4 font-medium">{customer.name}</td>
                                <td className="py-3 px-4">{customer.email}</td>
                                <td className="py-3 px-4">{customer.phone || '-'}</td>
                                <td className="py-3 px-4">{customer.address || '-'}</td>
                                <td className="py-3 px-4 text-right">
                                    <button
                                        onClick={() => onEdit(customer)}
                                        className="text-blue-600 hover:text-blue-800 mr-3"
                                    >
                                        <Edit className="w-5 h-5 inline" />
                                    </button>
                                    <button
                                        onClick={() => onDelete(customer.id)}
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

export default CustomerTable;