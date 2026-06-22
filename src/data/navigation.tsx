import { FiClock, FiDollarSign, FiFileText, FiGrid, FiPackage, FiShoppingBag, FiTruck, FiUsers } from 'react-icons/fi';
import type { PageId } from '../types/crm';

export const navItems: Array<{ id: PageId; icon: typeof FiGrid }> = [
  { id: 'dashboard', icon: FiGrid },
  { id: 'clients', icon: FiUsers },
  { id: 'orders', icon: FiShoppingBag },
  { id: 'products', icon: FiPackage },
  { id: 'suppliers', icon: FiTruck },
  { id: 'staff', icon: FiClock },
  { id: 'finance', icon: FiDollarSign },
  { id: 'reports', icon: FiFileText },
];
