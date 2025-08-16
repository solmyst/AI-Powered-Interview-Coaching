import React, { useState } from 'react';
import { ArrowLeft, Phone, Shield, Wrench, Heart, MapPin, Clock, Search } from 'lucide-react';
import { EmergencyContact } from '../types';
import { emergencyContacts } from '../data/mockData';

interface EmergencyServicesProps {
  onBack: () => void;
}

const EmergencyServices: React.FC<EmergencyServicesProps> = ({ onBack }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');

  const contactTypes = [
    { id: 'all', label: 'All Services', icon: Shield },
    { id: 'ambulance', label: 'Ambulance', icon: Heart },
    { id: 'police', label: 'Police', icon: Shield },
    { id: 'mechanic', label: 'Mechanic', icon: Wrench },
    { id: 'roadside', label: 'Roadside', icon: MapPin }
  ];

  const filteredContacts = emergencyContacts.filter(contact => {
    const matchesSearch = 
      contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = selectedType === 'all' || contact.type === selectedType;
    
    return matchesSearch && matchesType;
  });

  const getContactIcon = (type: string) => {
    switch (type) {
      case 'ambulance': return Heart;
      case 'police': return Shield;
      case 'mechanic': return Wrench;
      case 'roadside': return MapPin;
      default: return Phone;
    }
  };

  const getContactColor = (type: string) => {
    switch (type) {
      case 'ambulance': return 'bg-red-100 text-red-600';
      case 'police': return 'bg-blue-100 text-blue-600';
      case 'mechanic': return 'bg-orange-100 text-orange-600';
      case 'roadside': return 'bg-green-100 text-green-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const handleCall = (number: string) => {
    window.open(`tel:${number}`, '_self');
  };

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
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <Shield className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Emergency Services</h1>
                  <p className="text-sm text-gray-600">Quick access to help when you need it</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Emergency Banner */}
        <div className="bg-red-600 text-white rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">In Case of Emergency</h2>
              <p className="text-red-100">Call immediately. Don't hesitate if you're in danger.</p>
            </div>
            <div className="text-right">
              <button
                onClick={() => handleCall('112')}
                className="bg-white text-red-600 font-bold text-xl px-6 py-3 rounded-xl hover:bg-red-50 transition-colors shadow-lg"
              >
                Call 112
              </button>
              <p className="text-red-100 text-sm mt-1">National Emergency</p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-4 gap-8">
          {/* Filters Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-8">
              {/* Search */}
              <div className="mb-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search services..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Service Types */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-4">Service Types</h3>
                <div className="space-y-2">
                  {contactTypes.map((type) => {
                    const Icon = type.icon;
                    return (
                      <button
                        key={type.id}
                        onClick={() => setSelectedType(type.id)}
                        className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                          selectedType === type.id
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span>{type.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Services List */}
          <div className="lg:col-span-3">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Available Services</h2>
                <span className="text-gray-500">{filteredContacts.length} service{filteredContacts.length !== 1 ? 's' : ''} found</span>
              </div>

              <div className="grid gap-4">
                {filteredContacts.map((contact) => {
                  const Icon = getContactIcon(contact.type);
                  return (
                    <div
                      key={contact.id}
                      className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-4">
                          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${getContactColor(contact.type)}`}>
                            <Icon className="w-6 h-6" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <h3 className="text-lg font-semibold text-gray-900">{contact.name}</h3>
                              {contact.available24x7 && (
                                <div className="flex items-center space-x-1 px-2 py-1 bg-green-100 text-green-600 rounded-full text-xs font-medium">
                                  <Clock className="w-3 h-3" />
                                  <span>24x7</span>
                                </div>
                              )}
                            </div>
                            <p className="text-gray-600 mb-3">{contact.description}</p>
                            <div className="text-2xl font-bold text-gray-900">{contact.number}</div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleCall(contact.number)}
                          className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors font-semibold flex items-center space-x-2 shadow-lg hover:shadow-xl"
                        >
                          <Phone className="w-5 h-5" />
                          <span>Call Now</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {filteredContacts.length === 0 && (
                <div className="text-center py-12">
                  <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No services found</h3>
                  <p className="text-gray-500">Try adjusting your search criteria</p>
                </div>
              )}
            </div>

            {/* Safety Tips */}
            <div className="mt-8 bg-blue-50 border border-blue-200 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-4">Safety Tips for Road Travelers</h3>
              <div className="grid md:grid-cols-2 gap-4 text-sm text-blue-800">
                <ul className="space-y-2">
                  <li>• Keep emergency numbers saved in your phone</li>
                  <li>• Share your route with family/friends</li>
                  <li>• Carry a first aid kit in your vehicle</li>
                  <li>• Keep your fuel tank at least 1/4 full</li>
                </ul>
                <ul className="space-y-2">
                  <li>• Check tire pressure before long trips</li>
                  <li>• Carry extra water and snacks</li>
                  <li>• Have a flashlight and basic tools</li>
                  <li>• Know your vehicle insurance details</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default EmergencyServices;