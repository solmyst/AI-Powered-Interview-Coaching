import { CarModel, RouteOption, TripExpenses } from '../types';

export const calculateTripExpenses = (
  car: CarModel,
  route: RouteOption,
  travelers: number = 2
): TripExpenses => {
  // Fuel calculation
  const fuelNeeded = route.distance / car.mileage; // liters or kWh
  let fuelPricePerUnit = 96.50; // Default petrol price
  
  switch (car.fuelType) {
    case 'Diesel':
      fuelPricePerUnit = 89.30;
      break;
    case 'CNG':
      fuelPricePerUnit = 75.20;
      break;
    case 'Electric':
      fuelPricePerUnit = 8.00; // per kWh
      break;
    default:
      fuelPricePerUnit = 96.50; // Petrol
  }
  
  if (route.fuelStops.length > 0) {
    const avgPrice = route.fuelStops.reduce((sum, stop) => {
      switch (car.fuelType) {
        case 'Diesel':
          return sum + stop.dieselPrice;
        case 'CNG':
          return sum + (stop.cngPrice || 75.20);
        default:
          return sum + stop.petrolPrice;
      }
    }, 0) / route.fuelStops.length;
    fuelPricePerUnit = avgPrice;
  }
  
  const fuelCost = fuelNeeded * fuelPricePerUnit;
  
  // Toll calculation
  const tollCost = route.tolls.reduce((sum, toll) => sum + toll.cost, 0);
  
  // Food calculation based on trip duration and travelers
  const durationHours = route.duration / 60;
  let mealsNeeded = 0;
  
  if (durationHours > 4) mealsNeeded += 1; // Lunch
  if (durationHours > 8) mealsNeeded += 1; // Dinner
  if (durationHours > 12) mealsNeeded += 1; // Breakfast next day
  
  const avgMealCost = 250; // per person
  const foodCost = mealsNeeded * travelers * avgMealCost;
  
  return {
    fuel: {
      cost: Math.round(fuelCost),
      liters: Math.round(fuelNeeded * 100) / 100,
      pricePerLiter: Math.round(fuelPricePerUnit * 100) / 100
    },
    tolls: {
      cost: tollCost,
      count: route.tolls.length
    },
    food: {
      cost: foodCost,
      meals: mealsNeeded
    },
    total: Math.round(fuelCost + tollCost + foodCost)
  };
};

export const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
};

export const formatDistance = (km: number): string => {
  if (km >= 1000) {
    return `${(km / 1000).toFixed(1)}k km`;
  }
  return `${km} km`;
};

export const getDifficultyColor = (difficulty: string): string => {
  switch (difficulty) {
    case 'Easy': return 'text-green-600 bg-green-100';
    case 'Moderate': return 'text-yellow-600 bg-yellow-100';
    case 'Challenging': return 'text-red-600 bg-red-100';
    default: return 'text-gray-600 bg-gray-100';
  }
};