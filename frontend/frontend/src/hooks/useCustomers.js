import { useState, useEffect } from 'react';
import api from '../api/apiService';

export const useCustomers = () => {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchCustomers = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.customers.getAll();
            setCustomers(response.data || []);
        } catch (err) {
            setError(err.message);
            console.error('Error fetching customers:', err);
        } finally {
            setLoading(false);
        }
    };

    const createCustomer = async (data) => {
        try {
            await api.customers.create(data);
            await fetchCustomers();
            return { success: true };
        } catch (err) {
            setError(err.message);
            return { success: false, error: err.message };
        }
    };

    const updateCustomer = async (id, data) => {
        try {
            await api.customers.update(id, data);
            await fetchCustomers();
            return { success: true };
        } catch (err) {
            setError(err.message);
            return { success: false, error: err.message };
        }
    };

    const deleteCustomer = async (id) => {
        try {
            await api.customers.delete(id);
            await fetchCustomers();
            return { success: true };
        } catch (err) {
            setError(err.message);
            return { success: false, error: err.message };
        }
    };

    useEffect(() => {
        fetchCustomers();
    }, []);

    return {
        customers,
        loading,
        error,
        fetchCustomers,
        createCustomer,
        updateCustomer,
        deleteCustomer,
    };
};