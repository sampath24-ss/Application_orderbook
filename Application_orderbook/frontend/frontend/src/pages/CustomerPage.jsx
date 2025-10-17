import React, { useState } from 'react';
import { Users, Plus } from 'lucide-react';
import { useCustomers } from '../hooks/useCustomers';
import CustomerForm from '../components/customers/CustomerForm';
import CustomerTable from '../components/customers/CustomerTable';

const CustomersPage = () => {
    const { customers, loading, createCustomer, updateCustomer, deleteCustomer } = useCustomers();
    const [showForm, setShowForm] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (formData) => {
        setSubmitting(true);
        try {
            let result;
            if (editingCustomer) {
                console.log('Updating customer:', editingCustomer.id, formData);
                result = await updateCustomer(editingCustomer.id, formData);
            } else {
                console.log('Creating new customer:', formData);
                result = await createCustomer(formData);
            }
            
            if (result.success) {
                setShowForm(false);
                setEditingCustomer(null);
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

    const handleEdit = (customer) => {
        console.log('Editing customer:', customer);
        setEditingCustomer(customer);
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this customer?')) {
            setSubmitting(true);
            try {
                const result = await deleteCustomer(id);
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

    const handleCancel = () => {
        setShowForm(false);
        setEditingCustomer(null);
    };

    const handleAddClick = () => {
        setEditingCustomer(null);
        setShowForm(!showForm);
    };

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Users className="w-8 h-8 text-blue-600" />
                    <h1 className="text-3xl font-bold text-gray-800">Customers</h1>
                </div>
                <button
                    onClick={handleAddClick}
                    disabled={submitting}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
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
                    disabled={submitting}
                />
            )}

            <CustomerTable
                customers={customers}
                onEdit={handleEdit}
                onDelete={handleDelete}
                loading={loading || submitting}
            />
        </div>
    );
};

export default CustomersPage;