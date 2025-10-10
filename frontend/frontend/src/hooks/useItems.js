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
            let itemsData = [];
        if (Array.isArray(response)) {
            itemsData = response;
        } else if (response.data && Array.isArray(response.data)) {
            itemsData = response.data;
        } else if (response.data && response.data.items && Array.isArray(response.data.items)) {
            itemsData = response.data.items;
        } else if (response.items && Array.isArray(response.items)) {
            itemsData = response.items;
        }
            
            console.log('📦 First Item:', itemsData[0]);
            setItems(itemsData);
        } catch (err) {
            setError(err.message);
            console.error('Error fetching items:', err);
            setItems([]); // Set empty array on error
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