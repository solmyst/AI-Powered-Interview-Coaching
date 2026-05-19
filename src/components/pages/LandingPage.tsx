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
    <div className="min-h-screen bg-parchment font-sans text-ash">
      {/* Navigation for guest landing page */}
      <nav className="fixed top-0 w-full bg-parchment/90 backdrop-blur-md border-b border-mist/20 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2 group cursor-pointer" onClick={onStart}>
              <div className="w-10 h-10 bg-clay/10 rounded-xl flex items-center justify-center group-hover:bg-clay/20 transition-colors">
                <Brain className="h-6 w-6 text-clay" />
              </div>
              <span className="text-2xl font-bold font-serif text-void tracking-tight">InterviewAce</span>
            </div>
            
            <div className="flex items-center space-x-4">
              <button 
                onClick={onStart}
                className="bg-clay text-parchment px-5 py-2.5 rounded-xl hover:bg-clay/90 hover:scale-105 active:scale-95 transition-all font-semibold text-sm shadow-md shadow-clay/10"
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-36 pb-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Subtle decorative background blur */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-clay/5 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left Content */}
            <div className="text-left">
              <div className="inline-flex items-center space-x-2 mb-6">
                <span className="bg-clay/10 text-clay border border-clay/10 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider">
                  AI-Powered Interview Coaching
                </span>
              </div>
              
              <h1 className="text-5xl sm:text-6xl font-extrabold font-serif text-void mb-6 leading-[1.1] tracking-tight">
                Master Your Next Interview with 
                <span className="text-clay italic block sm:inline sm:ml-3">AI Coaching</span>
              </h1>
              
              <p className="text-lg sm:text-xl text-ash/90 mb-8 leading-relaxed max-w-lg">
                Practice with our local AI interviewer that analyzes your speech, body language, and answers 
                in real-time. Get instant feedback and land your dream job with confidence.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <button 
                  onClick={onStart}
                  className="bg-clay text-parchment px-8 py-4 rounded-xl hover:bg-clay/95 hover:scale-105 active:scale-95 transition-all duration-300 font-bold text-lg flex items-center justify-center space-x-3 shadow-lg shadow-clay/15 w-full sm:w-auto group"
                >
                  <Play className="h-5 w-5 fill-current" />
                  <span>Start Practicing Now</span>
                  <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
              
              <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-mist">
                <div className="flex items-center space-x-1.5">
                  <CheckCircle className="h-4 w-4 text-clay" />
                  <span>100% Free & Local</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <CheckCircle className="h-4 w-4 text-clay" />
                  <span>No API keys needed</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <CheckCircle className="h-4 w-4 text-clay" />
                  <span>Real-time AI feedback</span>
                </div>
              </div>
            </div>
            
            {/* Right Graphic Preview (Simulated Immersive AI Workspace) */}
            <div className="relative">
              <div className="bg-gradient-to-br from-void to-carbon rounded-3xl p-6 sm:p-8 shadow-2xl border border-clay-pale/10 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-clay-pale/[0.03] to-transparent pointer-events-none" />
                
                {/* Simulated Video Feed Section */}
                <div className="bg-void/90 rounded-2xl p-5 border border-mist/20 relative z-10">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-clay-pale/10 rounded-xl flex items-center justify-center border border-clay-pale/20">
                        <Brain className="h-5 w-5 text-clay-pale" />
                      </div>
                      <div className="text-left">
                        <div className="h-3.5 w-28 bg-parchment/80 rounded-md"></div>
                        <div className="h-2 w-16 bg-mist/40 rounded mt-2"></div>
                      </div>
                    </div>
                    <div className="h-2.5 w-2.5 rounded-full bg-clay-pale animate-pulse shadow-[0_0_10px_rgba(229,168,138,0.6)]" />
                  </div>
                  
                  {/* Simulated Metrics inside Dark Visual Card */}
                  <div className="space-y-4 pt-2">
                    <div>
                      <div className="flex justify-between text-xs text-parchment/70 font-semibold mb-1">
                        <span>Speech Clarity</span>
                        <span className="text-clay-pale">92%</span>
                      </div>
                      <div className="w-full bg-void/60 border border-mist/20 rounded-full h-2">
                        <div className="bg-clay-pale h-1.8 rounded-full" style={{ width: '92%' }} />
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-xs text-parchment/70 font-semibold mb-1">
                        <span>Eye Contact</span>
                        <span className="text-clay-pale">88%</span>
                      </div>
                      <div className="w-full bg-void/60 border border-mist/20 rounded-full h-2">
                        <div className="bg-clay-pale h-1.8 rounded-full" style={{ width: '88%' }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs text-parchment/70 font-semibold mb-1">
                        <span>Confidence Score</span>
                        <span className="text-clay-pale">85%</span>
                      </div>
                      <div className="w-full bg-void/60 border border-mist/20 rounded-full h-2">
                        <div className="bg-clay-pale h-1.8 rounded-full" style={{ width: '85%' }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Floating micro feedback cards */}
              <div className="absolute -top-4 -right-4 bg-vellum p-3.5 rounded-xl shadow-lg border border-mist/30 flex items-center space-x-2 z-20 animate-bounce duration-1000" style={{ animationDuration: '3s' }}>
                <TrendingUp className="h-4 w-4 text-clay" />
                <span className="text-xs font-bold text-void">+15% improvement</span>
              </div>
              
              <div className="absolute -bottom-4 -left-4 bg-vellum p-3.5 rounded-xl shadow-lg border border-mist/30 flex items-center space-x-2 z-20 animate-pulse">
                <Star className="h-4 w-4 text-clay fill-clay/20" />
                <span className="text-xs font-bold text-void">Confidence boost</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-vellum/35 border-y border-mist/15 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-3xl sm:text-4xl font-bold font-serif text-void mb-4">
              Everything You Need to Ace Your Interview
            </h2>
            <p className="text-lg text-ash/80 max-w-2xl mx-auto">
              Our AI-powered platform provides comprehensive, privacy-first feedback across all aspects of your interview performance.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: Brain,
                title: "AI Interviewer",
                description: "Practice with our smart local AI that adapts questions based on your responses and specific industry."
              },
              {
                icon: Video,
                title: "Real-time Analysis",
                description: "Get instant telemetry on eye contact, posture, speaking rate, and filler words as you talk."
              },
              {
                icon: TrendingUp,
                title: "Progress Tracking",
                description: "Monitor your key improvement statistics and historical performance with beautiful charts."
              },
              {
                icon: Users,
                title: "Industry-Specific",
                description: "Practice with questions customized for your domain — technology, healthcare, finance, or soft skills."
              },
              {
                icon: Zap,
                title: "Instant Feedback",
                description: "Receive intermediate suggestions during practice and a highly comprehensive dashboard report afterwards."
              },
              {
                icon: Shield,
                title: "Privacy First — Runs Locally",
                description: "All speech and vision tracking runs on-device using MediaPipe and Whisper. No video or audio leaves your device."
              }
            ].map((feature, index) => (
              <div key={index} className="p-8 rounded-2xl bg-vellum/50 border border-mist/20 hover:border-clay/40 hover:shadow-md transition-all duration-300 group text-left">
                <div className="w-12 h-12 bg-clay/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-clay/20 transition-colors">
                  <feature.icon className="h-6 w-6 text-clay" />
                </div>
                <h3 className="text-xl font-bold font-serif text-void mb-3">{feature.title}</h3>
                <p className="text-ash/90 text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 bg-parchment">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-3xl sm:text-4xl font-bold font-serif text-void mb-4">
              How It Works
            </h2>
            <p className="text-lg text-mist max-w-xl mx-auto">
              Three simple steps to significantly refine your interview performance.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-12 max-w-5xl mx-auto">
            {[
              {
                step: '1',
                title: 'Start a Session',
                description: 'Choose your desired interview style — quick practice, technical coding, behavioral focus, or full mock.'
              },
              {
                step: '2',
                title: 'Practice with AI',
                description: 'Speak naturally. Our local browser engines will capture and analyze visual telemetry and speech cues live.'
              },
              {
                step: '3',
                title: 'Review & Adapt',
                description: 'Explore the complete dashboard review showing filler counts, pace scores, strengths, and smart actionable tips.'
              }
            ].map((item, index) => (
              <div key={index} className="text-center group">
                <div className="w-16 h-16 bg-clay text-parchment rounded-full flex items-center justify-center text-2xl font-bold font-serif mx-auto mb-6 shadow-md shadow-clay/15 group-hover:scale-110 transition-transform">
                  {item.step}
                </div>
                <h3 className="text-xl font-bold font-serif text-void mb-3">{item.title}</h3>
                <p className="text-ash/90 text-sm leading-relaxed max-w-xs mx-auto">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section (Stunning Dark Immersive Contrast Card) */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto bg-gradient-to-br from-void via-carbon to-void rounded-3xl p-8 sm:p-16 text-center border border-clay-pale/10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-clay-pale/5 rounded-full blur-[100px] pointer-events-none" />
          
          <div className="relative z-10 max-w-2xl mx-auto">
            <h2 className="text-4xl sm:text-5xl font-bold font-serif text-parchment mb-6 tracking-tight">
              Ready to Land Your Dream Job?
            </h2>
            <p className="text-lg text-mist mb-10 leading-relaxed">
              Join thousands of professionals who have significantly polished their presentation and communication skills with InterviewAce.
            </p>
            
            <button 
              onClick={onStart}
              className="bg-clay-pale text-void px-8 py-4 rounded-xl hover:bg-clay-pale/90 active:scale-95 transition-all font-bold text-lg inline-flex items-center space-x-3 shadow-lg shadow-clay-pale/10"
            >
              <span>Start Practicing — It's 100% Free</span>
              <ArrowRight className="h-5 w-5" />
            </button>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mt-12 text-sm text-mist font-medium">
              <div className="flex items-center space-x-2">
                <Award className="h-5 w-5 text-clay-pale" />
                <span>50,000+ interviews simulated</span>
              </div>
              <div className="flex items-center space-x-2">
                <Star className="h-5 w-5 text-clay-pale fill-clay-pale/20" />
                <span>4.9/5 user rating</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-void text-mist py-16 border-t border-carbon">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12 text-left mb-12">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center space-x-2 mb-4 group cursor-pointer" onClick={onStart}>
                <div className="w-8 h-8 bg-clay-pale/15 rounded-lg flex items-center justify-center">
                  <Brain className="h-5 w-5 text-clay-pale" />
                </div>
                <span className="text-xl font-bold font-serif text-parchment">InterviewAce</span>
              </div>
              <p className="text-sm text-mist/70 leading-relaxed max-w-xs">
                AI-powered interview coaching running entirely in the safety of your browser.
              </p>
            </div>
            
            <div>
              <h4 className="font-bold text-parchment mb-4 uppercase tracking-wider text-xs">Product</h4>
              <ul className="space-y-2.5 text-sm">
                <li><span className="hover:text-clay-pale transition-colors cursor-pointer" onClick={onStart}>Features</span></li>
                <li><span className="hover:text-clay-pale transition-colors cursor-pointer" onClick={onStart}>How It Works</span></li>
                <li><span className="hover:text-clay-pale transition-colors cursor-pointer" onClick={onStart}>Security Policy</span></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-bold text-parchment mb-4 uppercase tracking-wider text-xs">Resources</h4>
              <ul className="space-y-2.5 text-sm">
                <li><span className="hover:text-clay-pale transition-colors cursor-pointer" onClick={onStart}>Interview Tips</span></li>
                <li><span className="hover:text-clay-pale transition-colors cursor-pointer" onClick={onStart}>STAR Method Guide</span></li>
                <li><span className="hover:text-clay-pale transition-colors cursor-pointer" onClick={onStart}>Documentation</span></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-bold text-parchment mb-4 uppercase tracking-wider text-xs">Security</h4>
              <ul className="space-y-2.5 text-sm font-medium">
                <li className="text-clay-pale/80">🔒 100% Local Processing</li>
                <li className="text-clay-pale/80">🛡️ No Audio Uploaded</li>
                <li className="text-clay-pale/80">👤 Anonymous & Secure</li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-carbon pt-8 text-center text-xs text-mist/40">
            <p>&copy; 2026 InterviewAce. All rights reserved. Made beautiful with the Terroir Palette.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}