import React from 'react';
import { MapPin, Navigation } from 'lucide-react';
import { Location, RouteOption } from '../types';

interface RouteMapProps {
  from: Location;
  to: Location;
  route: RouteOption;
}

const RouteMap: React.FC<RouteMapProps> = ({ from, to, route }) => {
  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
      {/* Map Header */}
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Route Map</h2>
          <div className="flex items-center space-x-4 text-sm text-gray-600">
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span>Start</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span>End</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span>Toll</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
              <span>Fuel</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mock Map Display */}
      <div className="relative h-80 bg-gradient-to-br from-blue-100 via-green-50 to-blue-100">
        {/* Mock road path */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 300">
          <path
            d="M50 150 Q200 50 350 150"
            stroke="#6B7280"
            strokeWidth="4"
            fill="none"
            strokeDasharray="8,4"
            className="opacity-60"
          />
          <path
            d="M50 150 Q200 50 350 150"
            stroke="#2563EB"
            strokeWidth="3"
            fill="none"
          />
        </svg>

        {/* Start Point */}
        <div className="absolute top-1/2 left-12 transform -translate-y-1/2 flex flex-col items-center">
          <div className="w-6 h-6 bg-green-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center">
            <MapPin className="w-3 h-3 text-white" />
          </div>
          <div className="mt-2 bg-white px-2 py-1 rounded shadow text-xs font-medium text-gray-900 whitespace-nowrap">
            {from.city}
          </div>
        </div>

        {/* End Point */}
        <div className="absolute top-1/2 right-12 transform -translate-y-1/2 flex flex-col items-center">
          <div className="w-6 h-6 bg-red-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center">
            <MapPin className="w-3 h-3 text-white" />
          </div>
          <div className="mt-2 bg-white px-2 py-1 rounded shadow text-xs font-medium text-gray-900 whitespace-nowrap">
            {to.city}
          </div>
        </div>

        {/* Toll Points */}
        {route.tolls.map((toll, index) => (
          <div
            key={toll.id}
            className="absolute"
            style={{
              left: `${30 + (index + 1) * 70}px`,
              top: `${120 - Math.sin((index + 1) * 0.5) * 30}px`
            }}
          >
            <div className="w-5 h-5 bg-blue-500 rounded-full border-2 border-white shadow-lg"></div>
            <div className="mt-1 bg-white px-1.5 py-0.5 rounded shadow text-xs text-gray-900 whitespace-nowrap">
              ₹{toll.cost}
            </div>
          </div>
        ))}

        {/* Fuel Stops */}
        {route.fuelStops.map((stop, index) => (
          <div
            key={stop.id}
            className="absolute"
            style={{
              left: `${60 + index * 90}px`,
              top: `${160 + Math.cos(index * 0.7) * 20}px`
            }}
          >
            <div className="w-4 h-4 bg-orange-500 rounded-full border-2 border-white shadow-lg"></div>
          </div>
        ))}

        {/* Direction indicator */}
        <div className="absolute top-4 right-4 bg-white rounded-lg p-2 shadow-lg">
          <Navigation className="w-5 h-5 text-blue-500" />
        </div>
      </div>

      {/* Route Details */}
      <div className="p-4 bg-gray-50 border-t">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-gray-500">Distance</div>
            <div className="font-medium text-gray-900">{route.distance} km</div>
          </div>
          <div>
            <div className="text-gray-500">Duration</div>
            <div className="font-medium text-gray-900">{Math.floor(route.duration / 60)}h {route.duration % 60}m</div>
          </div>
          <div>
            <div className="text-gray-500">Tolls</div>
            <div className="font-medium text-gray-900">{route.tolls.length} points</div>
          </div>
          <div>
            <div className="text-gray-500">Fuel Stops</div>
            <div className="font-medium text-gray-900">{route.fuelStops.length} available</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RouteMap;