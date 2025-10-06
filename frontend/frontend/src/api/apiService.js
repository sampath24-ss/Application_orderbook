const API_BASE_URL = 'http://localhost:3000/api';

class ApiService {
    async request(endpoint, options = {}) {
        const url = `${API_BASE_URL}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            ...options,
        };

        try {
            const response = await fetch(url, config);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    // Generic CRUD operations
    get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    }

    post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    patch(endpoint, data) {
        return this.request(endpoint, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    }

    delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }

    // Customer endpoints
    customers = {
        getAll: () => this.get('/customers'),
        getById: (id) => this.get(`/customers/${id}`),
        create: (data) => this.post('/customers', data),
        update: (id, data) => this.put(`/customers/${id}`, data),
        delete: (id) => this.delete(`/customers/${id}`),
    };

    // Item endpoints
    items = {
        getAll: () => this.get('/items'),
        getById: (id) => this.get(`/items/item/${id}`),
        getByCustomerId: (customerId) => this.get(`/items/customer/${customerId}`),
        create: (data) => this.post('/items', data),
        update: (id, data) => this.put(`/items/item/${id}`, data),
        updateQuantity: (id, quantity) => this.patch(`/items/item/${id}/quantity`, { quantity }),
        delete: (id) => this.delete(`/items/item/${id}`),
    };

    // Order endpoints
    orders = {
        getAll: () => this.get('/orders'),
        getById: (id) => this.get(`/orders/${id}`),
        getByCustomerId: (customerId) => this.get(`/orders/customer/${customerId}`),
        create: (data) => this.post('/orders', data),
        update: (id, data) => this.put(`/orders/${id}`, data),
        cancel: (id) => this.post(`/orders/${id}/cancel`),
        delete: (id) => this.delete(`/orders/${id}`),
    };
}

export default new ApiService();