'use client';

import React from 'react';
import {
  Briefcase,
  TrendingUp,
  Laptop,
  DollarSign,
  Gift,
  PlusCircle,
  Utensils,
  Home,
  Car,
  Zap,
  ShoppingBag,
  Activity,
  Film,
  BookOpen,
  MinusCircle,
  Tag,
  CreditCard,
  Coffee,
  Heart,
  Plane,
  Smartphone,
  LucideIcon
} from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  Briefcase,
  TrendingUp,
  Laptop,
  DollarSign,
  Gift,
  PlusCircle,
  Utensils,
  Home,
  Car,
  Zap,
  ShoppingBag,
  Activity,
  Film,
  BookOpen,
  MinusCircle,
  Tag,
  CreditCard,
  Coffee,
  Heart,
  Plane,
  Smartphone,
};

interface CategoryIconProps {
  name: string;
  className?: string;
}

export function CategoryIcon({ name, className = 'w-5 h-5' }: CategoryIconProps) {
  const IconComponent = iconMap[name] || Tag;
  return <IconComponent className={className} />;
}

export const availableIcons = [
  'Briefcase', 'TrendingUp', 'Laptop', 'DollarSign', 'Gift', 'PlusCircle',
  'Utensils', 'Home', 'Car', 'Zap', 'ShoppingBag', 'Activity',
  'Film', 'BookOpen', 'CreditCard', 'Coffee', 'Heart', 'Plane', 'Smartphone', 'Tag'
];

