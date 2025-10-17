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
        
        let customersData = [];
        if (Array.isArray(response)) {
            customersData = response;
        } else if (response.data && Array.isArray(response.data)) {
            // Backend returns: { success: true, data: [...] }
            customersData = response.data;
        } else if (response.customers && Array.isArray(response.customers)) {
            customersData = response.customers;
        }
        
        console.log('Customers Data:', customersData);
        setCustomers(customersData);
    } catch (err) {
        setError(err.message);
        console.error('Error fetching customers:', err);
        setCustomers([]); // Set empty array on error
    } finally {
        setLoading(false);
    }
};

    // Helper function to wait for customer to exist in database
    const waitForCustomer = async (customerId, maxAttempts = 10) => {
        console.log(' Waiting for customer to be created in database:', customerId);
        
        for (let i = 0; i < maxAttempts; i++) {
            await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms
            
            try {
                const response = await api.customers.getById(customerId);
                if (response && (response.data || response.id)) {
                    console.log(' Customer confirmed in database:', customerId);
                    return true;
                }
            } catch (err) {
                // Customer not found yet, continue waiting
                console.log(`⏳ Attempt ${i + 1}/${maxAttempts}: Customer not ready yet...`);
            }
        }
        
        console.error(' Timeout waiting for customer creation');
        return false;
    };

    const createCustomer = async (data) => {
        try {
            console.log(' Creating customer:', data);
            const result = await api.customers.create(data);
            console.log(' Customer creation initiated:', result);
            
            // Extract customer ID from response
            const customerId = result?.data?.id;
            
            if (customerId) {
                // Wait for customer to actually exist in database
                const exists = await waitForCustomer(customerId);
                
                if (exists) {
                    console.log(' Customer fully created, refreshing list...');
                    await fetchCustomers();
                    return { success: true };
                } else {
                    throw new Error('Customer creation timed out');
                }
            } else {
                // Fallback: just wait a bit and refresh
                await new Promise(resolve => setTimeout(resolve, 2000));
                await fetchCustomers();
                return { success: true };
            }
        } catch (err) {
            console.error(' Error creating customer:', err);
            setError(err.message);
            return { success: false, error: err.message };
        }
    };

    const updateCustomer = async (id, data) => {
        try {
            await api.customers.update(id, data);
            
            // Wait a bit for Kafka to process
            await new Promise(resolve => setTimeout(resolve, 1000));
            
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
            
            // Wait a bit for Kafka to process
            await new Promise(resolve => setTimeout(resolve, 1000));
            
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