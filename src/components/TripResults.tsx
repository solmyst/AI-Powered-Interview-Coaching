import React, { useState } from 'react';
import { ArrowLeft, MapPin, Car, Clock, Route, Fuel, CreditCard, UtensilsCrossed, AlertTriangle } from 'lucide-react';
import { Location, CarModel, RouteOption, TripExpenses } from '../types';
import { formatDuration, formatDistance, getDifficultyColor, calculateTripExpenses } from '../utils/calculations';
import { generateMockRoutes } from '../data/mockData';
import RouteMap from './RouteMap';
import ExpenseBreakdown from './ExpenseBreakdown';
import FeedbackSection from './FeedbackSection';

interface TripResultsProps {
  from: Location;
  to: Location;
  car: CarModel;
  travelers: number;
  onBack: () => void;
}

const TripResults: React.FC<TripResultsProps> = ({
  from,
  to,
  car,
  travelers,
  onBack
}) => {
  const [selectedRoute, setSelectedRoute] = useState<RouteOption | null>(null);
  const [showExpenseDetails, setShowExpenseDetails] = useState(false);
  
  const routes = generateMockRoutes(from, to);
  const currentRoute = selectedRoute || routes[0];
  const expenses = calculateTripExpenses(car, currentRoute, travelers);

  React.useEffect(() => {
    if (!selectedRoute && routes.length > 0) {
      setSelectedRoute(routes[0]);
    }
  }, [routes, selectedRoute]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={onBack}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2 text-lg font-semibold text-gray-900">
                  <span>{from.city}</span>
                  <Route className="w-5 h-5 text-gray-400" />
                  <span>{to.city}</span>
                </div>
                <div className="text-sm text-gray-500">
                  {formatDistance(currentRoute.distance)} • {formatDuration(currentRoute.duration)}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-green-600">₹{expenses.total}</div>
              <div className="text-sm text-gray-500">Total Cost</div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Map */}
            <RouteMap from={from} to={to} route={currentRoute} />

            {/* Route Options */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Route Options</h2>
              <div className="space-y-4">
                {routes.map((route) => {
                  const routeExpenses = calculateTripExpenses(car, route, travelers);
                  const isSelected = selectedRoute?.id === route.id;
                  
                  return (
                    <div
                      key={route.id}
                      onClick={() => setSelectedRoute(route)}
                      className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <h3 className="font-semibold text-gray-900">{route.name}</h3>
                          <span className={`px-2 py-1 text-xs rounded-full font-medium ${getDifficultyColor(route.difficulty)}`}>
                            {route.difficulty}
                          </span>
                          {route.isPopular && (
                            <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-600 rounded-full font-medium">
                              Popular
                            </span>
                          )}
                        </div>
                        <div className="text-lg font-bold text-green-600">₹{routeExpenses.total}</div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="flex items-center space-x-2">
                          <Route className="w-4 h-4 text-gray-500" />
                          <span className="text-gray-600">{formatDistance(route.distance)}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Clock className="w-4 h-4 text-gray-500" />
                          <span className="text-gray-600">{formatDuration(route.duration)}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <CreditCard className="w-4 h-4 text-gray-500" />
                          <span className="text-gray-600">{route.tolls.length} Tolls</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Fuel className="w-4 h-4 text-gray-500" />
                          <span className="text-gray-600">{route.fuelStops.length} Fuel Stops</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Expense Details */}
            <ExpenseBreakdown 
              expenses={expenses}
              route={currentRoute}
              car={car}
              travelers={travelers}
            />

            {/* Feedback Section */}
            <FeedbackSection tripId={`${from.id}-${to.id}`} />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Trip Summary */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Trip Summary</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Car className="w-5 h-5 text-gray-500" />
                    <span className="text-gray-700">Vehicle</span>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-gray-900">{car.brand} {car.model}</div>
                    <div className="text-sm text-gray-500">{car.mileage} km/l</div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-5 h-5 text-gray-500" />
                    <span className="text-gray-700">Distance</span>
                  </div>
                  <span className="font-medium text-gray-900">{formatDistance(currentRoute.distance)}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-5 h-5 text-gray-500" />
                    <span className="text-gray-700">Duration</span>
                  </div>
                  <span className="font-medium text-gray-900">{formatDuration(currentRoute.duration)}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <UtensilsCrossed className="w-5 h-5 text-gray-500" />
                    <span className="text-gray-700">Travelers</span>
                  </div>
                  <span className="font-medium text-gray-900">{travelers} {travelers === 1 ? 'Person' : 'People'}</span>
                </div>
              </div>
            </div>

            {/* Cost Breakdown Quick View */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Cost Breakdown</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span className="text-gray-700">Fuel</span>
                  </div>
                  <span className="font-medium">₹{expenses.fuel.cost}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                    <span className="text-gray-700">Tolls</span>
                  </div>
                  <span className="font-medium">₹{expenses.tolls.cost}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-gray-700">Food</span>
                  </div>
                  <span className="font-medium">₹{expenses.food.cost}</span>
                </div>
                <div className="border-t pt-3 flex items-center justify-between text-lg font-semibold">
                  <span>Total</span>
                  <span className="text-green-600">₹{expenses.total}</span>
                </div>
              </div>
            </div>

            {/* Important Notes */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
              <div className="flex items-start space-x-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-amber-800 mb-2">Important Notes</h3>
                  <ul className="text-sm text-amber-700 space-y-1">
                    <li>• Fuel prices may vary by location</li>
                    <li>• Toll rates are subject to change</li>
                    <li>• Food costs are estimated averages</li>
                    <li>• Check traffic conditions before departure</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TripResults;