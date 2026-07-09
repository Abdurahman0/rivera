import { FiArchive, FiCheckCircle, FiClock, FiCpu, FiDollarSign, FiGrid, FiLayers, FiPackage, FiSettings, FiShoppingBag, FiUsers } from 'react-icons/fi';
import type { PageId } from '../types/crm';

export const navItems: Array<{ id: PageId; icon: typeof FiGrid }> = [
  { id: 'dashboard', icon: FiGrid },
  { id: 'clients', icon: FiUsers },
  { id: 'orders', icon: FiShoppingBag },
  { id: 'production', icon: FiCpu },
  { id: 'materials', icon: FiLayers },
  { id: 'products', icon: FiPackage },
  { id: 'warehouse', icon: FiArchive },
  { id: 'staff', icon: FiClock },
  { id: 'finance', icon: FiDollarSign },
  { id: 'approvals', icon: FiCheckCircle },
  { id: 'system', icon: FiSettings },
];
