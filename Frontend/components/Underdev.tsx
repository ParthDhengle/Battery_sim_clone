import React from 'react';
import { Wrench, Sparkles, Code2 } from 'lucide-react';

export default function UnderDevelopment() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center p-4">
      <div className="relative">
        {/* Animated background circles */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-64 h-64 bg-white/10 rounded-full animate-ping" style={{ animationDuration: '3s' }}></div>
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-48 h-48 bg-white/10 rounded-full animate-pulse" style={{ animationDuration: '2s' }}></div>
        </div>
        
        {/* Main content card */}
        <div className="relative bg-white/95 backdrop-blur-lg rounded-3xl shadow-2xl p-12 max-w-md text-center">
          {/* Animated icons */}
          <div className="flex justify-center gap-4 mb-8">
            <div className="animate-bounce" style={{ animationDelay: '0s', animationDuration: '2s' }}>
              <Wrench className="w-12 h-12 text-indigo-600" />
            </div>
            <div className="animate-bounce" style={{ animationDelay: '0.2s', animationDuration: '2s' }}>
              <Code2 className="w-12 h-12 text-purple-600" />
            </div>
            <div className="animate-bounce" style={{ animationDelay: '0.4s', animationDuration: '2s' }}>
              <Sparkles className="w-12 h-12 text-pink-600" />
            </div>
          </div>
          
          {/* Title with gradient text */}
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">
            Under Development
          </h1>
          
          {/* Description */}
          <p className="text-gray-600 text-lg mb-6">
            We're crafting something amazing for you. This feature is currently in the works and will be available soon!
          </p>
          
          {/* Animated progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-2 mb-6 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-full animate-pulse" style={{ width: '65%' }}></div>
          </div>
          
          {/* Status text */}
          <p className="text-sm text-gray-500 flex items-center justify-center gap-2">
            <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            Development in progress
          </p>
        </div>
        
        {/* Floating particles */}
        <div className="absolute top-0 left-0 w-4 h-4 bg-yellow-300 rounded-full animate-ping" style={{ animationDuration: '4s' }}></div>
        <div className="absolute bottom-0 right-0 w-3 h-3 bg-blue-300 rounded-full animate-ping" style={{ animationDuration: '3.5s' }}></div>
        <div className="absolute top-1/4 right-0 w-2 h-2 bg-pink-300 rounded-full animate-ping" style={{ animationDuration: '5s' }}></div>
      </div>
    </div>
  );
}