import { CarModel, Location, RouteOption, EmergencyContact, TollInfo, FuelStop } from '../types';

export const popularLocations: Location[] = [
  {
    id: 'del-1',
    name: 'India Gate',
    city: 'New Delhi',
    state: 'Delhi',
    coordinates: { lat: 28.6129, lng: 77.2295 }
  },
  {
    id: 'mum-1',
    name: 'Gateway of India',
    city: 'Mumbai',
    state: 'Maharashtra',
    coordinates: { lat: 19.0728, lng: 72.8826 }
  },
  {
    id: 'ban-1',
    name: 'Cubbon Park',
    city: 'Bangalore',
    state: 'Karnataka',
    coordinates: { lat: 12.9716, lng: 77.5946 }
  },
  {
    id: 'chen-1',
    name: 'Marina Beach',
    city: 'Chennai',
    state: 'Tamil Nadu',
    coordinates: { lat: 13.0827, lng: 80.2707 }
  },
  {
    id: 'pune-1',
    name: 'Shaniwar Wada',
    city: 'Pune',
    state: 'Maharashtra',
    coordinates: { lat: 18.5196, lng: 73.8553 }
  }
];

export const carModels: CarModel[] = [
  {
    id: 'swift-2023',
    brand: 'Maruti Suzuki',
    model: 'Swift',
    year: 2023,
    mileage: 23.20,
    fuelType: 'Petrol'
  },
  {
    id: 'city-2023',
    brand: 'Honda',
    model: 'City',
    year: 2023,
    mileage: 17.8,
    fuelType: 'Petrol'
  },
  {
    id: 'verna-2023',
    brand: 'Hyundai',
    model: 'Verna',
    year: 2023,
    mileage: 18.45,
    fuelType: 'Petrol'
  },
  {
    id: 'innova-2023',
    brand: 'Toyota',
    model: 'Innova Crysta',
    year: 2023,
    mileage: 15.6,
    fuelType: 'Diesel'
  },
  {
    id: 'ertiga-2023',
    brand: 'Maruti Suzuki',
    model: 'Ertiga',
    year: 2023,
    mileage: 26.08,
    fuelType: 'CNG'
  },
  {
    id: 'nexon-ev',
    brand: 'Tata',
    model: 'Nexon EV',
    year: 2023,
    mileage: 4.5, // km/kWh equivalent
    fuelType: 'Electric'
  }
];

export const sampleTolls: TollInfo[] = [
  {
    id: 'toll-1',
    name: 'Kherki Daula Toll Plaza',
    location: 'NH-8, Gurgaon',
    cost: 65,
    coordinates: { lat: 28.4089, lng: 76.9709 }
  },
  {
    id: 'toll-2',
    name: 'Panvel Toll Plaza',
    location: 'Mumbai-Pune Expressway',
    cost: 110,
    coordinates: { lat: 18.9894, lng: 73.1162 }
  }
];

export const sampleFuelStops: FuelStop[] = [
  {
    id: 'fuel-1',
    name: 'Indian Oil Petrol Pump',
    location: 'NH-8, Manesar',
    petrolPrice: 96.50,
    dieselPrice: 89.30,
    cngPrice: 75.20,
    coordinates: { lat: 28.3670, lng: 76.9301 },
    amenities: ['Restroom', 'Food Court', 'ATM', 'Car Wash']
  },
  {
    id: 'fuel-2',
    name: 'HP Petrol Station',
    location: 'Mumbai-Pune Expressway',
    petrolPrice: 98.20,
    dieselPrice: 91.15,
    coordinates: { lat: 19.0433, lng: 73.0297 },
    amenities: ['Restroom', 'Snacks', 'Tire Air']
  }
];

export const emergencyContacts: EmergencyContact[] = [
  {
    id: 'emergency-1',
    type: 'ambulance',
    name: 'National Emergency Services',
    number: '108',
    description: 'Free emergency ambulance service available 24x7',
    available24x7: true
  },
  {
    id: 'emergency-2',
    type: 'police',
    name: 'Police Emergency',
    number: '100',
    description: 'National police emergency number',
    available24x7: true
  },
  {
    id: 'emergency-3',
    type: 'roadside',
    name: 'Highway Police',
    number: '1033',
    description: 'Highway patrol and roadside assistance',
    available24x7: true
  },
  {
    id: 'emergency-4',
    type: 'mechanic',
    name: 'Maruti Roadside Assistance',
    number: '1800-103-1600',
    description: 'Maruti Suzuki authorized roadside assistance',
    available24x7: true
  },
  {
    id: 'emergency-5',
    type: 'mechanic',
    name: 'Hyundai Road Assistance',
    number: '1800-11-4645',
    description: 'Hyundai authorized roadside assistance',
    available24x7: true
  }
];

export const generateMockRoutes = (from: Location, to: Location): RouteOption[] => {
  const baseDistance = Math.floor(Math.random() * 500) + 100;
  
  return [
    {
      id: 'route-1',
      name: 'Fastest Route (via Highway)',
      distance: baseDistance,
      duration: Math.floor(baseDistance / 60) * 60,
      tolls: sampleTolls,
      fuelStops: sampleFuelStops,
      isPopular: true,
      difficulty: 'Easy'
    },
    {
      id: 'route-2',
      name: 'Scenic Route (via State Highway)',
      distance: baseDistance + 50,
      duration: Math.floor((baseDistance + 50) / 45) * 60,
      tolls: [sampleTolls[0]],
      fuelStops: sampleFuelStops,
      isPopular: false,
      difficulty: 'Moderate'
    },
    {
      id: 'route-3',
      name: 'Economic Route (Toll-Free)',
      distance: baseDistance + 30,
      duration: Math.floor((baseDistance + 30) / 50) * 60,
      tolls: [],
      fuelStops: [sampleFuelStops[1]],
      isPopular: false,
      difficulty: 'Easy'
    }
  ];
};