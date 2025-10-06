import React from 'react';
import { Users, Package, ShoppingCart, Menu } from 'lucide-react';

const Sidebar = ({ currentRoute, setCurrentRoute, isOpen, toggleSidebar }) => {
    const routes = [
        { path: 'customers', name: 'Customers', icon: Users },
        { path: 'items', name: 'Items', icon: Package },
        { path: 'orders', name: 'Orders', icon: ShoppingCart },
    ];

    return (
        <div className={`${isOpen ? 'w-64' : 'w-20'} bg-white shadow-lg transition-all duration-300`}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className={`font-bold text-xl text-gray-800 ${!isOpen && 'hidden'}`}>
                    Multi-Tenant
                </h2>
                <button
                    onClick={toggleSidebar}
                    className="p-2 hover:bg-gray-100 rounded-lg transition"
                >
                    <Menu className="w-6 h-6 text-gray-700" />
                </button>
            </div>

            <nav className="p-4">
                {routes.map((route) => {
                    const Icon = route.icon;
                    return (
                        <button
                            key={route.path}
                            onClick={() => setCurrentRoute(route.path)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition mb-2 ${currentRoute === route.path
                                    ? 'bg-purple-50 text-purple-600'
                                    : 'text-gray-700 hover:bg-gray-50'
                                }`}
                        >
                            <Icon className="w-5 h-5 flex-shrink-0" />
                            {isOpen && <span className="font-medium">{route.name}</span>}
                        </button>
                    );
                })}
            </nav>
        </div>
    );
};

export default Sidebar;