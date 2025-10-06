import { useState, useEffect } from 'react';
import api from '../api/apiService';

export const useItems = () => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchItems = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.items.getAll();
            setItems(response.data || []);
        } catch (err) {
            setError(err.message);
            console.error('Error fetching items:', err);
        } finally {
            setLoading(false);
        }
    };

    const createItem = async (data) => {
        try {
            await api.items.create(data);
            await fetchItems();
            return { success: true };
        } catch (err) {
            setError(err.message);
            return { success: false, error: err.message };
        }
    };

    const updateItem = async (id, data) => {
        try {
            await api.items.update(id, data);
            await fetchItems();
            return { success: true };
        } catch (err) {
            setError(err.message);
            return { success: false, error: err.message };
        }
    };

    const updateItemQuantity = async (id, quantity) => {
        try {
            await api.items.updateQuantity(id, quantity);
            await fetchItems();
            return { success: true };
        } catch (err) {
            setError(err.message);
            return { success: false, error: err.message };
        }
    };

    const deleteItem = async (id) => {
        try {
            await api.items.delete(id);
            await fetchItems();
            return { success: true };
        } catch (err) {
            setError(err.message);
            return { success: false, error: err.message };
        }
    };

    useEffect(() => {
        fetchItems();
    }, []);

    return {
        items,
        loading,
        error,
        fetchItems,
        createItem,
        updateItem,
        updateItemQuantity,
        deleteItem,
    };
};