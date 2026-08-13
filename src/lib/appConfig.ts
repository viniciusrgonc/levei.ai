export const IS_DEV_MODE = import.meta.env.VITE_APP_ENV !== 'production';

export const appConfig = {
  IS_DEV_MODE,
  strictCpfValidation: !IS_DEV_MODE,
  requireEmailConfirmation: false,
};
