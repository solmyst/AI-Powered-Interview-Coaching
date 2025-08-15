import React from 'react';
import { ArrowLeft, CheckCircle, Star, Zap } from 'lucide-react';
import { User as AppUser } from '../services/authService';

interface PricingPageProps {
  user: AppUser;
  onBack: () => void;
}

export function PricingPage({ user, onBack }: PricingPageProps) {
  const plans = [
    {
      name: "Free",
      price: "$0",
      period: "/month",
      description: "Perfect for getting started",
      features: [
        "3 practice sessions per month",
        "Basic speech feedback",
        "Generic interview questions",
        "Simple progress tracking"
      ],
      cta: "Current Plan",
      popular: false,
      current: user.subscription === 'free'
    },
    {
      name: "Premium",
      price: "$19.99",
      period: "/month",
      description: "For serious job seekers",
      features: [
        "Unlimited practice sessions",
        "Full multi-modal feedback",
        "Industry-specific questions",
        "Detailed analytics",
        "Resume-based questions",
        "Progress improvement plans"
      ],
      cta: "Upgrade to Premium",
      popular: true,
      current: user.subscription === 'premium'
    },
    {
      name: "Professional",
      price: "$39.99",
      period: "/month",
      description: "Complete interview mastery",
      features: [
        "Everything in Premium",
        "1-on-1 AI coaching sessions",
        "Mock panel interviews",
        "Custom question sets",
        "Priority support",
        "Interview scheduling assistant"
      ],
      cta: "Go Professional",
      popular: false,
      current: user.subscription === 'professional'
    }
  ];

  const handleUpgrade = (planName: string) => {
    // In a real app, this would integrate with a payment processor like Stripe
    alert(`Upgrade to ${planName} - Payment integration would go here`);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-gray-800">Choose Your Plan</h1>
          <div className="w-24"></div>
        </div>

        {/* Current Plan Info */}
        <div className="bg-white rounded-xl p-6 shadow-lg mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">Current Plan</h2>
              <p className="text-gray-600">
                You're currently on the <span className="font-semibold capitalize">{user.subscription}</span> plan
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-600 capitalize">{user.subscription}</div>
              <div className="text-sm text-gray-500">
                {user.subscription === 'free' ? 'Free forever' : 
                 user.subscription === 'premium' ? '$19.99/month' : '$39.99/month'}
              </div>
            </div>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          {plans.map((plan, index) => (
            <div key={index} className={`relative p-8 rounded-2xl ${
              plan.popular ? 'ring-2 ring-blue-600 bg-white shadow-xl' : 
              plan.current ? 'ring-2 ring-green-600 bg-white shadow-xl' :
              'bg-white border border-gray-200 shadow-lg'
            }`}>
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-medium flex items-center gap-1">
                    <Star className="w-4 h-4" />
                    Most Popular
                  </span>
                </div>
              )}
              
              {plan.current && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-green-600 text-white px-4 py-2 rounded-full text-sm font-medium flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" />
                    Current Plan
                  </span>
                </div>
              )}
              
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                <div className="flex items-center justify-center">
                  <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                  <span className="text-gray-500 ml-1">{plan.period}</span>
                </div>
                <p className="text-gray-600 mt-2">{plan.description}</p>
              </div>
              
              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-center space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>
              
              <button 
                onClick={() => handleUpgrade(plan.name)}
                disabled={plan.current}
                className={`w-full py-3 rounded-xl font-semibold transition-colors ${
                  plan.current 
                    ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                    : plan.popular 
                      ? 'bg-blue-600 text-white hover:bg-blue-700' 
                      : 'border-2 border-gray-300 text-gray-700 hover:border-gray-400'
                }`}
              >
                {plan.current ? 'Current Plan' : plan.cta}
              </button>
            </div>
          ))}
        </div>

        {/* Features Comparison */}
        <div className="bg-white rounded-xl p-8 shadow-lg">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Feature Comparison</h2>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-4 px-4 font-semibold text-gray-800">Features</th>
                  <th className="text-center py-4 px-4 font-semibold text-gray-800">Free</th>
                  <th className="text-center py-4 px-4 font-semibold text-gray-800">Premium</th>
                  <th className="text-center py-4 px-4 font-semibold text-gray-800">Professional</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {[
                  { feature: 'Practice Sessions', free: '3/month', premium: 'Unlimited', pro: 'Unlimited' },
                  { feature: 'Speech Analysis', free: 'Basic', premium: 'Advanced', pro: 'Advanced' },
                  { feature: 'Body Language Analysis', free: '❌', premium: '✅', pro: '✅' },
                  { feature: 'Industry-Specific Questions', free: '❌', premium: '✅', pro: '✅' },
                  { feature: 'Detailed Analytics', free: '❌', premium: '✅', pro: '✅' },
                  { feature: 'Resume-Based Questions', free: '❌', premium: '✅', pro: '✅' },
                  { feature: 'AI Coaching Sessions', free: '❌', premium: '❌', pro: '✅' },
                  { feature: 'Panel Interviews', free: '❌', premium: '❌', pro: '✅' },
                  { feature: 'Priority Support', free: '❌', premium: '❌', pro: '✅' },
                ].map((row, index) => (
                  <tr key={index}>
                    <td className="py-4 px-4 font-medium text-gray-800">{row.feature}</td>
                    <td className="py-4 px-4 text-center text-gray-600">{row.free}</td>
                    <td className="py-4 px-4 text-center text-gray-600">{row.premium}</td>
                    <td className="py-4 px-4 text-center text-gray-600">{row.pro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-12 bg-white rounded-xl p-8 shadow-lg">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Frequently Asked Questions</h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-semibold text-gray-800 mb-2">Can I cancel anytime?</h3>
              <p className="text-gray-600 text-sm">Yes, you can cancel your subscription at any time. You'll continue to have access until the end of your billing period.</p>
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-800 mb-2">Is my data secure?</h3>
              <p className="text-gray-600 text-sm">Absolutely. We use enterprise-grade security and never share your practice sessions with third parties.</p>
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-800 mb-2">Do you offer refunds?</h3>
              <p className="text-gray-600 text-sm">We offer a 30-day money-back guarantee if you're not satisfied with your subscription.</p>
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-800 mb-2">Can I upgrade or downgrade?</h3>
              <p className="text-gray-600 text-sm">Yes, you can change your plan at any time. Changes take effect immediately with prorated billing.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}