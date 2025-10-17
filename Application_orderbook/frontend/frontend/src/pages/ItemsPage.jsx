import React, { useState, useEffect } from 'react';
import { Package, Plus, AlertCircle, RefreshCw } from 'lucide-react';
import { useItems } from '../hooks/useItems';
import { useCustomers } from '../hooks/useCustomers';
import ItemForm from '../components/items/ItemForm';
import ItemTable from '../components/items/ItemTable';

const ItemsPage = ({ setCurrentPage }) => {
    const { items, loading: itemsLoading, fetchItems, createItem, updateItem, updateItemQuantity, deleteItem } = useItems();
    const { customers, loading: customersLoading, fetchCustomers } = useCustomers();
    const [showForm, setShowForm] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    // Fetch customers AND items when page loads
    useEffect(() => {
        const loadData = async () => {
            await fetchCustomers();
            await fetchItems();
        };
        loadData();
    }, []);

    // Debug logging
    useEffect(() => {
        console.log('📦 Items loaded:', items.length);
        console.log('👥 Customers loaded:', customers.length);
        if (items.length > 0) {
            console.log('First item customerId:', items[0].customerId);
        }
        if (customers.length > 0) {
            console.log('First customer id:', customers[0].id);
        }
    }, [items, customers]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await Promise.all([fetchCustomers(), fetchItems()]);
        setTimeout(() => setRefreshing(false), 500);
    };

    const handleSubmit = async (formData) => {
        console.log('📤 Submitting item with data:', formData);
        
        let result;
        if (editingItem) {
            result = await updateItem(editingItem.id, formData);
        } else {
            result = await createItem(formData);
        }
        
        if (result.success) {
            setShowForm(false);
            setEditingItem(null);
            // Refresh data after successful operation
            await Promise.all([fetchCustomers(), fetchItems()]);
        }
    };

    const handleEdit = (item) => {
        console.log('Editing item:', item);
        setEditingItem(item);
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this item?')) {
            const result = await deleteItem(id);
            if (result.success) {
                await fetchItems();
            }
        }
    };

    const handleQuantityUpdate = async (id, newQuantity) => {
        const result = await updateItemQuantity(id, parseInt(newQuantity));
        if (result.success) {
            await fetchItems();
        }
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
                alert('Please create a customer first before adding items.');
                return;
            }
        }
        setShowForm(!showForm);
        setEditingItem(null);
    };

    const loading = itemsLoading || customersLoading;

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
                <div className="flex gap-3">
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                    <button
                        onClick={handleAddItemClick}
                        className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
                    >
                        <Plus className="w-5 h-5" />
                        Add Item
                    </button>
                </div>
            </div>

            {customers.length === 0 && !loading && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-yellow-800 font-medium">No customers found</p>
                        <p className="text-yellow-700 text-sm mt-1">
                            You need to create customers before you can add items. 
                            <button 
                                onClick={() => setCurrentPage('customers')}
                                className="ml-1 underline hover:text-yellow-900"
                            >
                                Go to Customers
                            </button>
                        </p>
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