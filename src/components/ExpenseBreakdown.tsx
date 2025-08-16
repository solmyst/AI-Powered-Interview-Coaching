import React, { useState } from 'react';
import { Fuel, CreditCard, UtensilsCrossed, ChevronDown, ChevronUp, MapPin, Info } from 'lucide-react';
import { TripExpenses, RouteOption, CarModel } from '../types';

interface ExpenseBreakdownProps {
  expenses: TripExpenses;
  route: RouteOption;
  car: CarModel;
  travelers: number;
}

const ExpenseBreakdown: React.FC<ExpenseBreakdownProps> = ({
  expenses,
  route,
  car,
  travelers
}) => {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Detailed Expense Breakdown</h2>
        <div className="text-2xl font-bold text-green-600">₹{expenses.total}</div>
      </div>

      <div className="space-y-4">
        {/* Fuel Expenses */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('fuel')}
            className="w-full p-4 text-left hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Fuel className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Fuel Expenses</h3>
                  <p className="text-sm text-gray-500">Based on {car.brand} {car.model} ({car.mileage} km/l)</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <span className="text-lg font-semibold text-gray-900">₹{expenses.fuel.cost}</span>
                {expandedSection === 'fuel' ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </div>
            </div>
          </button>
          
          {expandedSection === 'fuel' && (
            <div className="p-4 bg-gray-50 border-t">
              <div className="grid md:grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{expenses.fuel.liters}L</div>
                  <div className="text-sm text-gray-500">Fuel Needed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">₹{expenses.fuel.pricePerLiter}</div>
                  <div className="text-sm text-gray-500">Per Liter</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{route.distance} km</div>
                  <div className="text-sm text-gray-500">Total Distance</div>
                </div>
              </div>
              
              {route.fuelStops.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Available Fuel Stops</h4>
                  <div className="space-y-2">
                    {route.fuelStops.map((stop) => (
                      <div key={stop.id} className="flex items-center justify-between p-3 bg-white rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900">{stop.name}</p>
                          <p className="text-sm text-gray-500">{stop.location}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">₹{stop.petrolPrice}/L</p>
                          <div className="flex space-x-2 text-xs">
                            {stop.amenities.slice(0, 2).map((amenity) => (
                              <span key={amenity} className="px-1 py-0.5 bg-gray-100 rounded text-gray-600">
                                {amenity}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Toll Expenses */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('tolls')}
            className="w-full p-4 text-left hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Toll Expenses</h3>
                  <p className="text-sm text-gray-500">{route.tolls.length} toll{route.tolls.length !== 1 ? 's' : ''} on this route</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <span className="text-lg font-semibold text-gray-900">₹{expenses.tolls.cost}</span>
                {expandedSection === 'tolls' ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </div>
            </div>
          </button>
          
          {expandedSection === 'tolls' && (
            <div className="p-4 bg-gray-50 border-t">
              {route.tolls.length > 0 ? (
                <div className="space-y-3">
                  {route.tolls.map((toll) => (
                    <div key={toll.id} className="flex items-center justify-between p-3 bg-white rounded-lg">
                      <div className="flex items-center space-x-3">
                        <MapPin className="w-4 h-4 text-gray-500" />
                        <div>
                          <p className="font-medium text-gray-900">{toll.name}</p>
                          <p className="text-sm text-gray-500">{toll.location}</p>
                        </div>
                      </div>
                      <span className="font-semibold text-orange-600">₹{toll.cost}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No tolls on this route!</p>
                  <p className="text-sm text-gray-400">Save money with this toll-free path</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Food Expenses */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('food')}
            className="w-full p-4 text-left hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <UtensilsCrossed className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Food Expenses</h3>
                  <p className="text-sm text-gray-500">Estimated for {travelers} traveler{travelers !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <span className="text-lg font-semibold text-gray-900">₹{expenses.food.cost}</span>
                {expandedSection === 'food' ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </div>
            </div>
          </button>
          
          {expandedSection === 'food' && (
            <div className="p-4 bg-gray-50 border-t">
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{expenses.food.meals}</div>
                  <div className="text-sm text-gray-500">Meals Required</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">₹250</div>
                  <div className="text-sm text-gray-500">Avg. per Person</div>
                </div>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                  <Info className="w-4 h-4 text-blue-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="text-blue-800 font-medium">Food Cost Calculation</p>
                    <p className="text-blue-700 mt-1">
                      Based on journey duration of {Math.floor(route.duration / 60)} hours and {route.duration % 60} minutes. 
                      Includes {expenses.food.meals} meal{expenses.food.meals !== 1 ? 's' : ''} at highway restaurants.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="mt-6 p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Total Trip Cost</h3>
            <p className="text-sm text-gray-600">All expenses included</p>
          </div>
          <div className="text-3xl font-bold text-green-600">₹{expenses.total}</div>
        </div>
      </div>
    </div>
  );
};

export default ExpenseBreakdown;