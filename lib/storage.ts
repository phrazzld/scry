export const safeStorage = {
  getItem(key: string): string | null {
    try {
      return typeof window !== 'undefined' 
        ? localStorage.getItem(key) 
        : null;
    } catch (error) {
      console.error('Storage access failed:', error);
      return null;
    }
  },
  
  setItem(key: string, value: string): boolean {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(key, value);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Storage write failed:', error);
      return false;
    }
  },
  
  removeItem(key: string): void {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(key);
      }
    } catch (error) {
      console.error('Storage remove failed:', error);
    }
  }
};