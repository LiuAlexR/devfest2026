import { publicAnonKey, projectId } from '../../../utils/supabase/info';

export const initializeSpots = async () => {
  try {
    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-386acec3/init-spots`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();
    console.log('Spots initialization response:', data);
    return response.ok;
  } catch (error) {
    console.error('Error initializing spots:', error);
    return false;
  }
};
