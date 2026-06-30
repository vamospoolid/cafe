export const getCapacitor = (): any => {
  return (window as any).Capacitor || null;
};

export const isNativeAndroid = (): boolean => {
  const cap = getCapacitor();
  return !!cap && cap.getPlatform() === 'android';
};

export const enableKioskMode = async (): Promise<void> => {
  const cap = getCapacitor();
  if (!isNativeAndroid()) {
    throw new Error('Kiosk Mode hanya tersedia di perangkat native Android.');
  }

  try {
    await cap.Plugins.KioskPlugin.enableKiosk();
  } catch (err: any) {
    console.error('Error enabling kiosk mode:', err);
    throw err;
  }
};

export const disableKioskMode = async (): Promise<void> => {
  const cap = getCapacitor();
  if (!isNativeAndroid()) {
    throw new Error('Kiosk Mode hanya tersedia di perangkat native Android.');
  }

  try {
    await cap.Plugins.KioskPlugin.disableKiosk();
  } catch (err: any) {
    console.error('Error disabling kiosk mode:', err);
    throw err;
  }
};
