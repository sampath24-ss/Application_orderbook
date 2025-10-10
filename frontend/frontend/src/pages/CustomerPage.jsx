// frontend/src/components/CustomersPage.jsx
import { useState, useEffect } from 'react';
import apiService from '../api/apiService';
import websocketService from '../services/websocketService';

const CustomersPage = () => {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        address: ''
    });

    // Initialize WebSocket connection and subscriptions
    useEffect(() => {
        // Connect to WebSocket
        websocketService.connect('user-123'); // Replace with actual user ID
        websocketService.startPingInterval();

        // Subscribe to customer updates
        websocketService.subscribe(
            [
                'CUSTOMER_CREATED_SUCCESS',
                'CUSTOMER_UPDATED_SUCCESS',
                'CUSTOMER_DELETED_SUCCESS',
                'CUSTOMER_CREATED_FAILED',
                'CUSTOMERS_LIST_RESPONSE'
            ],
            ['customer-updates'],
            handleCustomerUpdate
        );

        // Load initial customers
        loadCustomers();

        // Cleanup on unmount
        return () => {
            websocketService.disconnect();
        };
    }, []);

    const handleCustomerUpdate = (event) => {
        console.log('🎉 Customer update received:', event);

        switch (event.eventType) {
            case 'CUSTOMER_CREATED_SUCCESS':
                // Add the new customer to the list
                setCustomers(prev => {
                    // Check if customer already exists
                    const exists = prev.some(c => c.id === event.data.id);
                    if (exists) {
                        return prev.map(c => c.id === event.data.id ? event.data : c);
                    }
                    return [event.data, ...prev];
                });
                console.log('✅ New customer added to list:', event.data);
                break;

            case 'CUSTOMER_UPDATED_SUCCESS':
                // Update existing customer
                setCustomers(prev =>
                    prev.map(c => c.id === event.data.id ? event.data : c)
                );
                console.log('✅ Customer updated in list:', event.data);
                break;

            case 'CUSTOMER_DELETED_SUCCESS':
                // Remove customer from list
                const deletedId = event.data.id || event.data.customerId;
                setCustomers(prev => prev.filter(c => c.id !== deletedId));
                console.log('✅ Customer removed from list:', deletedId);
                break;

            case 'CUSTOMER_CREATED_FAILED':
                console.error('❌ Customer creation failed:', event.data);
                setError(event.data.error || 'Failed to create customer');
                break;

            case 'CUSTOMERS_LIST_RESPONSE':
                // Handle bulk customer list updates
                if (event.data.customers) {
                    setCustomers(event.data.customers);
                }
                break;

            default:
                console.log('Unhandled customer event:', event.eventType);
        }
    };

    const loadCustomers = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await apiService.customers.getAll();
            if (response.success && response.data) {
                setCustomers(response.data.customers || response.data);
            }
        } catch (err) {
            console.error('Error loading customers:', err);
            setError('Failed to load customers');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        try {
            console.log('📤 Creating customer:', formData);

            // Send request - it will return 202 Accepted
            const response = await apiService.customers.create(formData);

            if (response.success) {
                console.log('✅ Customer creation initiated:', response.data);

                // Don't add to state here - wait for WebSocket update
                // Just show success message
                alert(`Customer creation initiated! ID: ${response.data.id}`);

                // Reset form
                setFormData({ name: '', email: '', phone: '', address: '' });
                setShowForm(false);
            }
        } catch (err) {
            console.error('❌ Error creating customer:', err);
            setError('Failed to create customer: ' + err.message);
        }
    };

    const handleDelete = async (customerId) => {
        if (!confirm('Are you sure you want to delete this customer?')) {
            return;
        }

        try {
            console.log('🗑️ Deleting customer:', customerId);
            const response = await apiService.customers.delete(customerId);

            if (response.success) {
                console.log('✅ Customer deletion initiated');
                // Customer will be removed from list via WebSocket update
            }
        } catch (err) {
            console.error('❌ Error deleting customer:', err);
            setError('Failed to delete customer');
        }
    };

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Customers</h1>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition"
                >
                    {showForm ? 'Cancel' : 'Add Customer'}
                </button>
            </div>

            {/* WebSocket Connection Status */}
            <div className="mb-4 p-3 bg-blue-50 rounded-lg flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${websocketService.isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
                <span className="text-sm text-gray-700">
                    {websocketService.isConnected ? 'Real-time updates active' : 'Connecting...'}
                </span>
            </div>

            {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                    {error}
                </div>
            )}

            {showForm && (
                <div className="mb-6 bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-4">Add New Customer</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Name *
                            </label>
                            <input
                                type="text"
                                name="name"
                                required
                                value={formData.name}
                                onChange={handleChange}
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Email *
                            </label>
                            <input
                                type="email"
                                name="email"
                                required
                                value={formData.email}
                                onChange={handleChange}
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Phone
                            </label>
                            <input
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Address
                            </label>
                            <textarea
                                name="address"
                                value={formData.address}
                                onChange={handleChange}
                                rows="3"
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <button
                            type="submit"
                            className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition"
                        >
                            Create Customer
                        </button>
                    </form>
                </div>
            )}

            {loading ? (
                <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                    <p className="mt-4 text-gray-600">Loading customers...</p>
                </div>
            ) : customers.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg shadow-md">
                    <p className="text-gray-600 text-lg">No customers found</p>
                    <p className="text-gray-500 mt-2">Add your first customer to get started</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {customers.map((customer) => (
                        <div key={customer.id} className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition">
                            <div className="flex justify-between items-start mb-3">
                                <h3 className="text-xl font-semibold text-gray-800">{customer.name}</h3>
                                <button
                                    onClick={() => handleDelete(customer.id)}
                                    className="text-red-600 hover:text-red-800 text-sm"
                                >
                                    Delete
                                </button>
                            </div>
                            <div className="space-y-2 text-gray-600">
                                <p className="text-sm">
                                    <span className="font-medium">Email:</span> {customer.email}
                                </p>
                                {customer.phone && (
                                    <p className="text-sm">
                                        <span className="font-medium">Phone:</span> {customer.phone}
                                    </p>
                                )}
                                {customer.address && (
                                    <p className="text-sm">
                                        <span className="font-medium">Address:</span> {customer.address}
                                    </p>
                                )}
                                <p className="text-xs text-gray-400 mt-3">
                                    ID: {customer.id}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CustomersPage;