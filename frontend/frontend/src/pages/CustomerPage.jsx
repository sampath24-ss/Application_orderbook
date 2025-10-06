import React, { useState } from 'react';
import { Users, Plus } from 'lucide-react';
import { useCustomers } from '../hooks/useCustomers';
import CustomerForm from '../components/customers/CustomerForm';
import CustomerTable from '../components/customers/CustomerTable';

const CustomersPage = () => {
    const { customers, loading, createCustomer, updateCustomer, deleteCustomer } = useCustomers();
    const [showForm, setShowForm] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null);

    const handleSubmit = async (formData) => {
        if (editingCustomer) {
            const result = await updateCustomer(editingCustomer.id, formData);
            if (result.success) {
                setShowForm(false);
                setEditingCustomer(null);
            }
        } else {
            const result = await createCustomer(formData);
            if (result.success) {
                setShowForm(false);
            }
        }
    };

    const handleEdit = (customer) => {
        setEditingCustomer(customer);
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this customer?')) {
            await deleteCustomer(id);
        }
    };

    const handleCancel = () => {
        setShowForm(false);
        setEditingCustomer(null);
    };

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Users className="w-8 h-8 text-blue-600" />
                    <h1 className="text-3xl font-bold text-gray-800">Customers</h1>
                </div>
                <button
                    onClick={() => {
                        setShowForm(!showForm);
                        setEditingCustomer(null);
                    }}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
                >
                    <Plus className="w-5 h-5" />
                    Add Customer
                </button>
            </div>

            {showForm && (
                <CustomerForm
                    onSubmit={handleSubmit}
                    onCancel={handleCancel}
                    initialData={editingCustomer}
                />
            )}

            <CustomerTable
                customers={customers}
                onEdit={handleEdit}
                onDelete={handleDelete}
                loading={loading}
            />
        </div>
    );
};

export default CustomersPage;