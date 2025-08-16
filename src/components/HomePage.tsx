import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, Car, Users, Search, Clock, Star } from 'lucide-react';
import { Location, CarModel, Trip } from '../types';
import { popularLocations, carModels } from '../data/mockData';
import { useGeolocation } from '../hooks/useGeolocation';
import CarSelection from './CarSelection';

interface HomePageProps {
  onPlanTrip: (from: Location, to: Location, car: CarModel, travelers: number) => void;
  previousTrips?: Trip[];
}

const HomePage: React.FC<HomePageProps> = ({ onPlanTrip, previousTrips = [] }) => {
  const [fromLocation, setFromLocation] = useState<Location | null>(null);
  const [toLocation, setToLocation] = useState<Location | null>(null);
  const [selectedCar, setSelectedCar] = useState<CarModel>(carModels[0]);
  const [travelers, setTravelers] = useState(2);
  const [showCarSelection, setShowCarSelection] = useState(false);
  const [errors, setErrors] = useState<{ from?: string; to?: string; general?: string }>({});
  
  const { loading: locationLoading, getCurrentLocation } = useGeolocation();

  const handleLocationSearch = (query: string, isFrom: boolean) => {
    if (!query.trim()) return;
    
    const matchedLocation = popularLocations.find(loc => 
      loc.name.toLowerCase().includes(query.toLowerCase()) ||
      loc.city.toLowerCase().includes(query.toLowerCase())
    );
    
    if (matchedLocation) {
      if (isFrom) {
        setFromLocation(matchedLocation);
        setErrors(prev => ({ ...prev, from: undefined }));
      } else {
        setToLocation(matchedLocation);
        setErrors(prev => ({ ...prev, to: undefined }));
      }
    }
  };

  const handleCurrentLocation = () => {
    getCurrentLocation();
    // In a real app, we'd reverse geocode the coordinates
    const currentLoc: Location = {
      id: 'current',
      name: 'Current Location',
      city: 'Your Location',
      state: '',
      coordinates: { lat: 28.6139, lng: 77.2090 }
    };
    setFromLocation(currentLoc);
    setErrors(prev => ({ ...prev, from: undefined }));
  };

  const validateAndPlanTrip = () => {
    const newErrors: { from?: string; to?: string; general?: string } = {};
    
    if (!fromLocation) {
      newErrors.from = 'Please select a starting location';
    }
    
    if (!toLocation) {
      newErrors.to = 'Please select a destination';
    }
    
    if (fromLocation && toLocation && fromLocation.id === toLocation.id) {
      newErrors.general = 'Starting location and destination cannot be the same';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    onPlanTrip(fromLocation!, toLocation!, selectedCar, travelers);
  };

  const popularRoutes = [
    { from: 'New Delhi', to: 'Agra', duration: '3h 30m', popular: true },
    { from: 'Mumbai', to: 'Pune', duration: '3h 15m', popular: true },
    { from: 'Bangalore', to: 'Mysore', duration: '2h 45m', popular: true },
    { from: 'Chennai', to: 'Pondicherry', duration: '2h 30m', popular: true }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-green-600 rounded-xl flex items-center justify-center">
                <Navigation className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
                Trip Helper
              </h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Planning Form */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Plan Your Road Trip</h2>
                <p className="text-gray-600">Get accurate cost estimates and route details for your journey</p>
              </div>

              {/* Error Messages */}
              {errors.general && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-600 font-medium">{errors.general}</p>
                </div>
              )}

              {/* Location Inputs */}
              <div className="space-y-6 mb-8">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">From</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Enter starting location"
                      className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        errors.from ? 'border-red-300' : 'border-gray-300'
                      }`}
                      value={fromLocation?.name || ''}
                      onChange={(e) => handleLocationSearch(e.target.value, true)}
                    />
                    <button
                      onClick={handleCurrentLocation}
                      disabled={locationLoading}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                      title="Use current location"
                    >
                      <Navigation className={`w-4 h-4 ${locationLoading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                  {errors.from && <p className="mt-1 text-sm text-red-600">{errors.from}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">To</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Enter destination"
                      className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        errors.to ? 'border-red-300' : 'border-gray-300'
                      }`}
                      value={toLocation?.name || ''}
                      onChange={(e) => handleLocationSearch(e.target.value, false)}
                    />
                  </div>
                  {errors.to && <p className="mt-1 text-sm text-red-600">{errors.to}</p>}
                </div>
              </div>

              {/* Quick Location Suggestions */}
              <div className="mb-8">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Popular Destinations</h3>
                <div className="flex flex-wrap gap-2">
                  {popularLocations.slice(0, 5).map((location) => (
                    <button
                      key={location.id}
                      onClick={() => {
                        setToLocation(location);
                        setErrors(prev => ({ ...prev, to: undefined }));
                      }}
                      className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                    >
                      {location.city}
                    </button>
                  ))}
                </div>
              </div>

              {/* Car and Travelers Selection */}
              <div className="grid md:grid-cols-2 gap-6 mb-8">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Your Car</label>
                  <button
                    onClick={() => setShowCarSelection(true)}
                    className="w-full flex items-center justify-between p-3 border border-gray-300 rounded-lg hover:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <Car className="w-5 h-5 text-gray-600" />
                      <div className="text-left">
                        <p className="font-medium text-gray-900">{selectedCar.brand} {selectedCar.model}</p>
                        <p className="text-sm text-gray-500">{selectedCar.mileage} km/l • {selectedCar.fuelType}</p>
                      </div>
                    </div>
                    <Search className="w-5 h-5 text-gray-400" />
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Travelers</label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <select
                      value={travelers}
                      onChange={(e) => setTravelers(Number(e.target.value))}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                        <option key={num} value={num}>{num} {num === 1 ? 'Person' : 'People'}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Plan Trip Button */}
              <button
                onClick={validateAndPlanTrip}
                className="w-full bg-gradient-to-r from-blue-600 to-green-600 text-white font-semibold py-4 px-6 rounded-xl hover:from-blue-700 hover:to-green-700 transform hover:scale-[1.02] transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                Calculate My Trip
              </button>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Popular Routes */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex items-center space-x-2 mb-4">
                <Star className="w-5 h-5 text-yellow-500" />
                <h3 className="text-lg font-semibold text-gray-900">Popular Routes</h3>
              </div>
              <div className="space-y-3">
                {popularRoutes.map((route, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                    <div>
                      <p className="font-medium text-gray-900">{route.from} → {route.to}</p>
                      <div className="flex items-center space-x-1 text-sm text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span>{route.duration}</span>
                      </div>
                    </div>
                    {route.popular && (
                      <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-600 rounded-full">Popular</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Previous Trips */}
            {previousTrips.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Trips</h3>
                <div className="space-y-3">
                  {previousTrips.slice(0, 3).map((trip) => (
                    <div key={trip.id} className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                      <p className="font-medium text-gray-900">
                        {trip.from.city} → {trip.to.city}
                      </p>
                      <p className="text-sm text-gray-500">₹{trip.expenses.total}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Car Selection Modal */}
      {showCarSelection && (
        <CarSelection
          cars={carModels}
          selectedCar={selectedCar}
          onSelect={(car) => {
            setSelectedCar(car);
            setShowCarSelection(false);
          }}
          onClose={() => setShowCarSelection(false)}
        />
      )}
    </div>
  );
};

export default HomePage;