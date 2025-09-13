import React from 'react';
import { User as AppUser } from '../services/authService';

interface AuthDebugProps {
  user: AppUser | null;
}

export function AuthDebug({ user }: AuthDebugProps) {
  if (!import.meta.env.DEV) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white p-3 rounded-lg text-xs max-w-xs">
      <div className="font-bold mb-2">Auth Debug:</div>
      {user ? (
        <div>
          <div>ID: {user.id}</div>
          <div>Name: {user.name}</div>
          <div>Email: {user.email}</div>
          <div>Subscription: {user.subscription}</div>
          <div className={user.id.startsWith('demo_') ? 'text-red-400' : 'text-green-400'}>
            {user.id.startsWith('demo_') ? '⚠️ DEMO USER' : '✅ REAL USER'}
          </div>
        </div>
      ) : (
        <div>Not authenticated</div>
      )}
    </div>
  );
}