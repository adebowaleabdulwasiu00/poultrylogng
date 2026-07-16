import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import type { Bank, PaymentMethodRecord, ProductCategoryRecord, UnitRecord, Setting } from '@/db/types';

export function useSettings() {
  const settings = useLiveQuery(() => db.settings.toArray()) || [];
  const banks = useLiveQuery(() => db.banks.where('status').equals('active').sortBy('sortOrder')) || [];
  const allBanks = useLiveQuery(() => db.banks.toArray()) || [];
  const paymentMethods = useLiveQuery(() => db.paymentMethods.where('status').equals('active').sortBy('sortOrder')) || [];
  const allPaymentMethods = useLiveQuery(() => db.paymentMethods.toArray()) || [];
  const productCategories = useLiveQuery(() => db.productCategories.where('status').equals('active').sortBy('sortOrder')) || [];
  const allCategories = useLiveQuery(() => db.productCategories.toArray()) || [];
  const units = useLiveQuery(() => db.units.where('status').equals('active').sortBy('sortOrder')) || [];
  const allUnits = useLiveQuery(() => db.units.toArray()) || [];

  function getSettingValue(key: string, defaultValue = ''): string {
    const record = settings.find(s => s.key === key);
    return record?.value ?? defaultValue;
  }

  function getCompanyInfo() {
    return {
      farmName: getSettingValue('farm_name', 'My Poultry Farm'),
      businessName: getSettingValue('business_name', 'PoultryLog NG'),
      address: getSettingValue('address'),
      phoneNumbers: getSettingValue('phone_numbers'),
      email: getSettingValue('email'),
      website: getSettingValue('website'),
      taxId: getSettingValue('tax_id'),
      registrationNumber: getSettingValue('registration_number'),
      currency: getSettingValue('currency', 'NGN'),
      currencySymbol: getSettingValue('currency_symbol', '\u20a6'),
      timezone: getSettingValue('timezone', 'Africa/Lagos'),
      country: getSettingValue('country', 'Nigeria'),
      state: getSettingValue('state'),
      logo: getSettingValue('logo'),
    };
  }

  function getBankNames(): string[] {
    return banks.map(b => b.bankName);
  }

  function getPaymentMethodNames(): string[] {
    return paymentMethods.map(m => m.methodName);
  }

  function getCategoryNames(): string[] {
    return productCategories.map(c => c.categoryName);
  }

  function getUnitNames(): string[] {
    return units.map(u => u.abbreviation || u.unitName);
  }

  return {
    settings, banks, allBanks, paymentMethods, allPaymentMethods,
    productCategories, allCategories, units, allUnits,
    getSettingValue, getCompanyInfo,
    getBankNames, getPaymentMethodNames, getCategoryNames, getUnitNames,
  };
}

export type UseSettingsReturn = ReturnType<typeof useSettings>;
