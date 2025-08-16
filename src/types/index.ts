export interface Location {
  id: string;
  name: string;
  city: string;
  state: string;
  coordinates: {
    lat: number;
    lng: number;
  };
}

export interface CarModel {
  id: string;
  brand: string;
  model: string;
  year: number;
  mileage: number; // km/l
  fuelType: 'Petrol' | 'Diesel' | 'CNG' | 'Electric';
}

export interface RouteOption {
  id: string;
  name: string;
  distance: number; // km
  duration: number; // minutes
  tolls: TollInfo[];
  fuelStops: FuelStop[];
  isPopular: boolean;
  difficulty: 'Easy' | 'Moderate' | 'Challenging';
}

export interface TollInfo {
  id: string;
  name: string;
  location: string;
  cost: number;
  coordinates: {
    lat: number;
    lng: number;
  };
}

export interface FuelStop {
  id: string;
  name: string;
  location: string;
  petrolPrice: number;
  dieselPrice: number;
  cngPrice?: number;
  coordinates: {
    lat: number;
    lng: number;
  };
  amenities: string[];
}

export interface TripExpenses {
  fuel: {
    cost: number;
    liters: number;
    pricePerLiter: number;
  };
  tolls: {
    cost: number;
    count: number;
  };
  food: {
    cost: number;
    meals: number;
  };
  total: number;
}

export interface Trip {
  id: string;
  from: Location;
  to: Location;
  car: CarModel;
  travelers: number;
  selectedRoute: RouteOption;
  expenses: TripExpenses;
  date: Date;
}

export interface EmergencyContact {
  id: string;
  type: 'ambulance' | 'police' | 'mechanic' | 'roadside';
  name: string;
  number: string;
  description: string;
  available24x7: boolean;
}

export interface UserFeedback {
  id: string;
  tripId: string;
  rating: number;
  issues: string[];
  comments?: string;
  date: Date;
}