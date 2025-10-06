import { useState, useEffect } from 'react';
import api from '../api/apiService';

export const useOrders = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchOrders = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.orders.getAll();
            setOrders(response.data || []);
        } catch (err) {
            setError(err.message);
            console.error('Error fetching orders:', err);
        } finally {
            setLoading(false);
        }
    };

    const createOrder = async (data) => {
        try {
            await api.orders.create(data);
            await fetchOrders();
            return { success: true };
        } catch (err) {
            setError(err.message);
            return { success: false, error: err.message };
        }
    };

    const updateOrder = async (id, data) => {
        try {
            await api.orders.update(id, data);
            await fetchOrders();
            return { success: true };
        } catch (err) {
            setError(err.message);
            return { success: false, error: err.message };
        }
    };

    const cancelOrder = async (id) => {
        try {
            await api.orders.cancel(id);
            await fetchOrders();
            return { success: true };
        } catch (err) {
            setError(err.message);
            return { success: false, error: err.message };
        }
    };

    const deleteOrder = async (id) => {
        try {
            await api.orders.delete(id);
            await fetchOrders();
            return { success: true };
        } catch (err) {
            setError(err.message);
            return { success: false, error: err.message };
        }
    };

    useEffect(() => {
        fetchOrders();
    }, []);

    return {
        orders,
        loading,
        error,
        fetchOrders,
        createOrder,
        updateOrder,
        cancelOrder,
        deleteOrder,
    };
};