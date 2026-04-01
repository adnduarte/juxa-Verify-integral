import React from 'react';
import { useAuthStatus } from '../contexts/AuthContext';
import { resolveMainDashboard } from '../config/productRegistry';

export const Dashboard: React.FC = () => {
  const { role, clientProfile, organizationId, user } = useAuthStatus();
  return (
    <>
      {resolveMainDashboard({
        role,
        clientProfile,
        organizationId,
        userEmail: user?.email ?? null,
      })}
    </>
  );
};
