import React, { useState, useEffect } from 'react';
import { Package, Plus, AlertCircle, RefreshCw } from 'lucide-react';
import { useItems } from '../hooks/useItems';
import { useCustomers } from '../hooks/useCustomers';
import ItemForm from '../components/items/ItemForm';
import ItemTable from '../components/items/ItemTable';

const ItemsPage = ({ setCurrentPage }) => {
    const { items, loading, createItem, updateItem, updateItemQuantity, deleteItem } = useItems();
    const { customers, fetchCustomers } = useCustomers();
    const [showForm, setShowForm] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    // Auto-refresh customers when page loads
    useEffect(() => {
        fetchCustomers();
    }, []);
    console.log('📦 Items:', items);
    console.log('👥 Customers:', customers);

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchCustomers();
        setTimeout(() => setRefreshing(false), 500);
    };

    const handleSubmit = async (formData) => {
        console.log('📤 Submitting item with data:', formData);
        
        if (editingItem) {
            const result = await updateItem(editingItem.id, formData);
            if (result.success) {
                setShowForm(false);
                setEditingItem(null);
            }
        } else {
            const result = await createItem(formData);
            if (result.success) {
                setShowForm(false);
            }
        }
    };

    const handleEdit = (item) => {
        setEditingItem(item);
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this item?')) {
            await deleteItem(id);
        }
    };

    const handleQuantityUpdate = async (id, newQuantity) => {
        await updateItemQuantity(id, parseInt(newQuantity));
    };

    const handleCancel = () => {
        setShowForm(false);
        setEditingItem(null);
    };

    const handleAddItemClick = async () => {
        if (customers.length === 0) {
            // Refresh customers first
            await fetchCustomers();
            if (customers.length === 0) {
                return; // Still no customers
            }
        }
        setShowForm(!showForm);
        setEditingItem(null);
    };

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Package className="w-8 h-8 text-green-600" />
                    <h1 className="text-3xl font-bold text-gray-800">Items</h1>
                    <span className="text-sm text-gray-500">
                        ({customers.length} customer{customers.length !== 1 ? 's' : ''} available)
                    </span>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition flex items-center gap-2"
                        title="Refresh customers list"
                    >
                        <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                    <button
                        onClick={handleAddItemClick}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition flex items-center gap-2"
                    >
                        <Plus className="w-5 h-5" />
                        Add Item
                    </button>
                </div>
            </div>

            {/* Warning if no customers */}
            {customers.length === 0 && !showForm && (
                <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-6">
                    <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <h3 className="font-semibold text-yellow-900 mb-1">No Customers Available</h3>
                        <p className="text-yellow-800 text-sm mb-3">
                            You need to create at least one customer before you can create items. Items must be assigned to a customer.
                        </p>
                        <div className="flex gap-2">
                            {setCurrentPage && (
                                <button
                                    onClick={() => setCurrentPage('customers')}
                                    className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition text-sm"
                                >
                                    Go to Customers Page
                                </button>
                            )}
                            <button
                                onClick={handleRefresh}
                                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition text-sm"
                            >
                                Refresh Customer List
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showForm && (
                <ItemForm
                    onSubmit={handleSubmit}
                    onCancel={handleCancel}
                    initialData={editingItem}
                    customers={customers}
                />
            )}

            <ItemTable
                items={items}
                customers={customers}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onQuantityUpdate={handleQuantityUpdate}
                loading={loading}
            />
        </div>
    );
};



export default ItemsPage;