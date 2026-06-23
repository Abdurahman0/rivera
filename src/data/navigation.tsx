import { FiArchive, FiClock, FiDollarSign, FiGrid, FiPackage, FiShoppingBag, FiUsers } from 'react-icons/fi';
import type { PageId } from '../types/crm';

export const navItems: Array<{ id: PageId; icon: typeof FiGrid }> = [
  { id: 'dashboard', icon: FiGrid },
  { id: 'clients', icon: FiUsers },
  { id: 'orders', icon: FiShoppingBag },
  { id: 'products', icon: FiPackage },
  { id: 'warehouse', icon: FiArchive },
  { id: 'staff', icon: FiClock },
  { id: 'finance', icon: FiDollarSign },
];
