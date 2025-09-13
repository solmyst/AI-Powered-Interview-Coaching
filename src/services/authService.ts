import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  signOut,
  updateProfile,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, googleProvider, db } from '../config/firebase';

export interface User {
  id: string;
  name: string;
  email: string;
  subscription: 'free' | 'premium' | 'professional';
  avatar?: string;
  createdAt?: Date;
  lastLoginAt?: Date;
  sessionsCount?: number;
  totalPracticeTime?: number;
}

export class AuthService {
  // Sign up with email and password
  static async signUpWithEmail(email: string, password: string, name: string): Promise<User> {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      // Update the user's display name
      await updateProfile(firebaseUser, { displayName: name });

      // Create user document in Firestore
      const userData: User = {
        id: firebaseUser.uid,
        name,
        email: firebaseUser.email!,
        subscription: 'free',
        avatar: firebaseUser.photoURL || undefined,
        createdAt: new Date(),
        lastLoginAt: new Date(),
        sessionsCount: 0,
        totalPracticeTime: 0
      };

      try {
        await setDoc(doc(db, 'users', firebaseUser.uid), {
          ...userData,
          createdAt: serverTimestamp(),
          lastLoginAt: serverTimestamp()
        });
      } catch (error) {
        console.warn('Failed to create user document in Firestore (possibly offline):', error);
        // Continue with basic user data even if Firestore fails
      }

      return userData;
    } catch (error: unknown) {
      throw new Error(error instanceof Error ? error.message : 'Failed to create account');
    }
  }

  // Sign in with email and password
  static async signInWithEmail(email: string, password: string): Promise<User> {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      // Update last login time (ignore if offline)
      try {
        await updateDoc(doc(db, 'users', firebaseUser.uid), {
          lastLoginAt: serverTimestamp()
        });
      } catch (error) {
        console.warn('Failed to update last login time (possibly offline):', error);
      }

      return await this.getUserData(firebaseUser);
    } catch (error: unknown) {
      throw new Error(error instanceof Error ? error.message : 'Failed to sign in');
    }
  }

  // Sign in with Google
  static async signInWithGoogle(): Promise<User> {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const firebaseUser = result.user;

      // Check if user exists in Firestore (handle offline gracefully)
      try {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        
        if (!userDoc.exists()) {
          // Create new user document
          const userData: User = {
            id: firebaseUser.uid,
            name: firebaseUser.displayName || 'User',
            email: firebaseUser.email!,
            subscription: 'free',
            avatar: firebaseUser.photoURL || undefined,
            createdAt: new Date(),
            lastLoginAt: new Date(),
            sessionsCount: 0,
            totalPracticeTime: 0
          };

          try {
            await setDoc(doc(db, 'users', firebaseUser.uid), {
              ...userData,
              createdAt: serverTimestamp(),
              lastLoginAt: serverTimestamp()
            });
          } catch (error) {
            console.warn('Failed to create user document (possibly offline):', error);
          }

          return userData;
        } else {
          // Update last login time for existing user
          try {
            await updateDoc(doc(db, 'users', firebaseUser.uid), {
              lastLoginAt: serverTimestamp()
            });
          } catch (error) {
            console.warn('Failed to update last login time (possibly offline):', error);
          }

          return await this.getUserData(firebaseUser);
        }
      } catch (error) {
        console.warn('Failed to access Firestore, using basic user data:', error);
        // Return basic user data if Firestore is completely unavailable
        return {
          id: firebaseUser.uid,
          name: firebaseUser.displayName || 'User',
          email: firebaseUser.email!,
          subscription: 'free',
          avatar: firebaseUser.photoURL || undefined,
          sessionsCount: 0,
          totalPracticeTime: 0
        };
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.message.includes('auth/configuration-not-found')) {
          throw new Error('Firebase Authentication is not configured. Please enable Authentication in Firebase Console.');
        }
        throw new Error(error.message);
      }
      throw new Error('Failed to sign in with Google');
    }
  }

  // Get user data from Firestore
  static async getUserData(firebaseUser: FirebaseUser): Promise<User> {
    try {
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      
      if (userDoc.exists()) {
        const data = userDoc.data();
        return {
          id: firebaseUser.uid,
          name: data.name || firebaseUser.displayName || 'User',
          email: data.email || firebaseUser.email!,
          subscription: data.subscription || 'free',
          avatar: data.avatar || firebaseUser.photoURL || undefined,
          createdAt: data.createdAt?.toDate(),
          lastLoginAt: data.lastLoginAt?.toDate(),
          sessionsCount: data.sessionsCount || 0,
          totalPracticeTime: data.totalPracticeTime || 0
        };
      } else {
        // Return basic user data if Firestore document doesn't exist
        return {
          id: firebaseUser.uid,
          name: firebaseUser.displayName || 'User',
          email: firebaseUser.email!,
          subscription: 'free',
          avatar: firebaseUser.photoURL || undefined,
          sessionsCount: 0,
          totalPracticeTime: 0
        };
      }
    } catch (error) {
      console.warn('Failed to get user data from Firestore, using basic data:', error);
      // Return basic user data if offline or Firestore fails
      return {
        id: firebaseUser.uid,
        name: firebaseUser.displayName || 'User',
        email: firebaseUser.email!,
        subscription: 'free',
        avatar: firebaseUser.photoURL || undefined,
        sessionsCount: 0,
        totalPracticeTime: 0
      };
    }
  }

  // Sign out
  static async signOut(): Promise<void> {
    try {
      await signOut(auth);
    } catch (error: unknown) {
      throw new Error(error instanceof Error ? error.message : 'Failed to sign out');
    }
  }

  // Update user subscription
  static async updateSubscription(userId: string, subscription: 'free' | 'premium' | 'professional'): Promise<void> {
    try {
      await updateDoc(doc(db, 'users', userId), {
        subscription,
        updatedAt: serverTimestamp()
      });
    } catch (error: unknown) {
      throw new Error(error instanceof Error ? error.message : 'Failed to update subscription');
    }
  }

  // Update session count
  static async incrementSessionCount(userId: string): Promise<void> {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const currentCount = userDoc.data().sessionsCount || 0;
        await updateDoc(doc(db, 'users', userId), {
          sessionsCount: currentCount + 1,
          updatedAt: serverTimestamp()
        });
      }
    } catch (error: unknown) {
      console.error('Failed to update session count:', error);
    }
  }

  // Update practice time
  static async addPracticeTime(userId: string, minutes: number): Promise<void> {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const currentTime = userDoc.data().totalPracticeTime || 0;
        await updateDoc(doc(db, 'users', userId), {
          totalPracticeTime: currentTime + minutes,
          updatedAt: serverTimestamp()
        });
      }
    } catch (error: unknown) {
      console.error('Failed to update practice time:', error);
    }
  }
}