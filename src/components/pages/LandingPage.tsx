import { 
  Video, 
  Brain, 
  TrendingUp, 
  Users, 
  Star,
  CheckCircle,
  Play,
  ArrowRight,
  Zap,
  Shield,
  Award
} from 'lucide-react';

interface LandingPageProps {
  onStart: () => void;
}

export function LandingPage({ onStart }: LandingPageProps) {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <nav className="fixed top-0 w-full bg-white/95 backdrop-blur-sm border-b border-gray-200 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <Brain className="h-8 w-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">InterviewAce</span>
            </div>
            
            <div className="flex items-center space-x-4">
              <button 
                onClick={onStart}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      </nav>

      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="flex items-center space-x-2 mb-6">
                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                  AI-Powered Interview Coaching
                </span>
              </div>
              
              <h1 className="text-5xl font-bold text-gray-900 mb-6 leading-tight">
                Master Your Next Interview with 
                <span className="text-blue-600"> AI Coaching</span>
              </h1>
              
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                Practice with our AI interviewer that analyzes your speech, body language, and answers 
                in real-time. Get instant feedback and land your dream job with confidence.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <button 
                  onClick={onStart}
                  className="bg-blue-600 text-white px-8 py-4 rounded-xl hover:bg-blue-700 transition-all duration-300 font-semibold text-lg flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl w-full sm:w-auto"
                >
                  <Play className="h-5 w-5" />
                  <span>Start Practicing Now</span>
                </button>
              </div>
              
              <div className="flex items-center space-x-6 text-sm text-gray-500">
                <div className="flex items-center space-x-1">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>100% Free & Local</span>
                </div>
                <div className="flex items-center space-x-1">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>No API keys needed</span>
                </div>
                <div className="flex items-center space-x-1">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Real-time AI feedback</span>
                </div>
              </div>
            </div>
            
            <div className="relative">
              <div className="bg-gradient-to-br from-blue-600 to-purple-700 rounded-2xl p-8 shadow-2xl">
                <div className="bg-white rounded-xl p-6">
                  <div className="flex items-center space-x-4 mb-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <Brain className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <div className="h-3 w-24 bg-gray-200 rounded"></div>
                      <div className="h-2 w-16 bg-gray-100 rounded mt-2"></div>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-600">Speech Analysis: 92%</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span className="text-sm text-gray-600">Body Language: 88%</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                      <span className="text-sm text-gray-600">Content Quality: 85%</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Floating feedback cards */}
              <div className="absolute -top-4 -right-4 bg-white p-3 rounded-lg shadow-lg border">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span className="text-xs font-medium">+15% improvement</span>
                </div>
              </div>
              
              <div className="absolute -bottom-4 -left-4 bg-white p-3 rounded-lg shadow-lg border">
                <div className="flex items-center space-x-2">
                  <Star className="h-4 w-4 text-yellow-500" />
                  <span className="text-xs font-medium">Confidence boost</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Everything You Need to Ace Your Interview
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Our AI-powered platform provides comprehensive feedback across all aspects of your interview performance.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: Brain,
                title: "AI Interviewer",
                description: "Practice with our smart AI that adapts questions based on your responses and industry.",
                color: "bg-blue-100 text-blue-600"
              },
              {
                icon: Video,
                title: "Real-time Analysis",
                description: "Get instant feedback on eye contact, posture, speech patterns, and facial expressions.",
                color: "bg-green-100 text-green-600"
              },
              {
                icon: TrendingUp,
                title: "Progress Tracking",
                description: "Monitor your improvement over time with detailed analytics and performance metrics.",
                color: "bg-purple-100 text-purple-600"
              },
              {
                icon: Users,
                title: "Industry-Specific",
                description: "Practice with questions tailored to your field - tech, finance, healthcare, and more.",
                color: "bg-orange-100 text-orange-600"
              },
              {
                icon: Zap,
                title: "Instant Feedback",
                description: "Receive immediate coaching tips during practice and detailed reports after sessions.",
                color: "bg-yellow-100 text-yellow-600"
              },
              {
                icon: Shield,
                title: "Privacy First — Runs Locally",
                description: "All AI analysis runs in your browser using MediaPipe & Web Speech API. No data leaves your device.",
                color: "bg-red-100 text-red-600"
              }
            ].map((feature, index) => (
              <div key={index} className="p-6 rounded-xl border border-gray-200 hover:shadow-lg transition-shadow">
                <div className={`w-12 h-12 ${feature.color} rounded-lg flex items-center justify-center mb-4`}>
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              How It Works
            </h2>
            <p className="text-lg text-gray-600">
              Three simple steps to improve your interview performance.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              {
                step: '1',
                title: 'Start a Session',
                description: 'Choose your interview type — quick practice, technical, behavioral, or full mock interview.'
              },
              {
                step: '2',
                title: 'Practice with AI',
                description: 'Answer questions while our AI analyzes your eye contact, speech patterns, body language, and filler words in real-time.'
              },
              {
                step: '3',
                title: 'Review & Improve',
                description: 'Get a detailed report with scores, transcript, and personalized tips. Track your progress across sessions.'
              }
            ].map((item, index) => (
              <div key={index} className="text-center">
                <div className="w-14 h-14 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-blue-600">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Land Your Dream Job?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join thousands of professionals who have improved their interview skills with InterviewAce.
          </p>
          
          <button 
            onClick={onStart}
            className="bg-white text-blue-600 px-8 py-4 rounded-xl hover:bg-gray-50 transition-colors font-semibold text-lg inline-flex items-center space-x-2"
          >
            <span>Start Practicing — It's Free</span>
            <ArrowRight className="h-5 w-5" />
          </button>
          
          <div className="flex items-center justify-center space-x-8 mt-8 text-blue-100">
            <div className="flex items-center space-x-2">
              <Award className="h-5 w-5" />
              <span>50,000+ interviews practiced</span>
            </div>
            <div className="flex items-center space-x-2">
              <Star className="h-5 w-5" />
              <span>4.9/5 user rating</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Brain className="h-6 w-6 text-blue-400" />
                <span className="text-xl font-bold">InterviewAce</span>
              </div>
              <p className="text-gray-400">
                AI-powered interview coaching that helps you land your dream job.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-gray-400">
                <li>Features</li>
                <li>How It Works</li>
                <li>Open Source</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Resources</h4>
              <ul className="space-y-2 text-gray-400">
                <li>Blog</li>
                <li>Help Center</li>
                <li>Interview Tips</li>
                <li>Career Guide</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li>About Us</li>
                <li>Careers</li>
                <li>Contact</li>
                <li>Privacy Policy</li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2026 InterviewAce. All rights reserved. Powered by MediaPipe & Web Speech API.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}