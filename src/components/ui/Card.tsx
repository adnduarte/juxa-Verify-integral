import React from 'react';
import { shellClasses } from '../../config/brand';

export type CardProps = React.HTMLAttributes<HTMLDivElement>;

export const Card: React.FC<CardProps> = ({ className = '', children, ...props }) => (
  <div className={`${shellClasses.surfaceCard} p-6 ${className}`.trim()} {...props}>
    {children}
  </div>
);
