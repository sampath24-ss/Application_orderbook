import { useState } from 'react';
import { Users, Package, ShoppingCart, Home } from 'lucide-react';
import CustomersPage from './pages/CustomerPage';
import ItemsPage from './pages/ItemsPage';
import OrdersPage from './pages/OrderPage';
import './App.css';

function App() {
  const [currentPage, setCurrentPage] = useState('home');

  const renderPage = () => {
    switch (currentPage) {
      case 'customers':
        return <CustomersPage />;
      case 'items':
        return <ItemsPage />;
      case 'orders':
        return <OrdersPage />;
      default:
        return <HomePage setCurrentPage={setCurrentPage} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Bar */}
      <nav className="bg-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <ShoppingCart className="w-8 h-8 text-indigo-600" />
              <h1 className="text-2xl font-bold text-gray-800">Multi-Tenant Manager</h1>
            </div>
            <div className="flex gap-2">
              <NavButton
                icon={<Home className="w-5 h-5" />}
                label="Home"
                active={currentPage === 'home'}
                onClick={() => setCurrentPage('home')}
              />
              <NavButton
                icon={<Users className="w-5 h-5" />}
                label="Customers"
                active={currentPage === 'customers'}
                onClick={() => setCurrentPage('customers')}
              />
              <NavButton
                icon={<Package className="w-5 h-5" />}
                label="Items"
                active={currentPage === 'items'}
                onClick={() => setCurrentPage('items')}
              />
              <NavButton
                icon={<ShoppingCart className="w-5 h-5" />}
                label="Orders"
                active={currentPage === 'orders'}
                onClick={() => setCurrentPage('orders')}
              />
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto">
        {renderPage()}
      </main>
    </div>
  );
}

const NavButton = ({ icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
      active
        ? 'bg-indigo-600 text-white'
        : 'text-gray-700 hover:bg-gray-100'
    }`}
  >
    {icon}
    <span className="font-medium">{label}</span>
  </button>
);

const HomePage = ({ setCurrentPage }) => (
  <div className="p-6">
    <div className="mb-8">
      <h1 className="text-4xl font-bold text-gray-800 mb-2">Welcome to Multi-Tenant Manager</h1>
      <p className="text-gray-600 text-lg">Manage your customers, items, and orders efficiently</p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <DashboardCard
        icon={<Users className="w-12 h-12" />}
        title="Customers"
        description="Manage your customer database"
        color="blue"
        onClick={() => setCurrentPage('customers')}
      />
      <DashboardCard
        icon={<Package className="w-12 h-12" />}
        title="Items"
        description="Track your inventory and products"
        color="green"
        onClick={() => setCurrentPage('items')}
      />
      <DashboardCard
        icon={<ShoppingCart className="w-12 h-12" />}
        title="Orders"
        description="Process and track orders"
        color="purple"
        onClick={() => setCurrentPage('orders')}
      />
    </div>

    <div className="mt-12 bg-white rounded-lg shadow-md p-8">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Quick Start Guide</h2>
      <div className="space-y-4">
        <Step number="1" text="Add customers to your database" />
        <Step number="2" text="Create items and assign them to customers" />
        <Step number="3" text="Create orders for your customers" />
        <Step number="4" text="Track order status and manage deliveries" />
      </div>
    </div>
  </div>
);

const DashboardCard = ({ icon, title, description, color, onClick }) => {
  const colorClasses = {
    blue: 'text-blue-600 hover:bg-blue-50 border-blue-200',
    green: 'text-green-600 hover:bg-green-50 border-green-200',
    purple: 'text-purple-600 hover:bg-purple-50 border-purple-200'
  };

  return (
    <button
      onClick={onClick}
      className={`bg-white rounded-lg shadow-md p-8 border-2 transition cursor-pointer ${colorClasses[color]}`}
    >
      <div className="flex flex-col items-center text-center gap-4">
        {icon}
        <h3 className="text-xl font-bold text-gray-800">{title}</h3>
        <p className="text-gray-600">{description}</p>
      </div>
    </button>
  );
};

const Step = ({ number, text }) => (
  <div className="flex items-center gap-4">
    <div className="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold">
      {number}
    </div>
    <p className="text-gray-700">{text}</p>
  </div>
);

export default App;