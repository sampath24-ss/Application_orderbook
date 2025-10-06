import React, { useState } from 'react';
import { Package, Plus } from 'lucide-react';
import { useItems } from '../hooks/useItems';
import { useCustomers } from '../hooks/useCustomers';
import ItemForm from '../components/items/ItemForm';
import ItemTable from '../components/items/ItemTable';

const ItemsPage = () => {
    const { items, loading, createItem, updateItem, updateItemQuantity, deleteItem } = useItems();
    const { customers } = useCustomers();
    const [showForm, setShowForm] = useState(false);
    const [editingItem, setEditingItem] = useState(null);

    const handleSubmit = async (formData) => {
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

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Package className="w-8 h-8 text-green-600" />
                    <h1 className="text-3xl font-bold text-gray-800">Items</h1>
                </div>
                <button
                    onClick={() => {
                        setShowForm(!showForm);
                        setEditingItem(null);
                    }}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition flex items-center gap-2"
                >
                    <Plus className="w-5 h-5" />
                    Add Item
                </button>
            </div>

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